import { Notice, Plugin, Vault } from 'obsidian';
import { DEFAULT_SETTINGS, KBPluginSettings, KBSettingTab } from './settings';
import { FileChangesTracker } from './file-changes-tracker';
import {
    KnowledgeBase,
    knowledgeBaseFactory,
    StartSyncResponse,
    SyncStatus,
} from './knowledge-bases';
import { generateUUID, tryCatchInNotice } from './obsidian-functions';
import { ChatView, ChatSyncInformation, VIEW_TYPE_CHAT } from './chat';
import cacheManager from '@type-cacheable/core';

export interface SyncProps {
    allVault?: boolean; // Default: false
}

type SyncInformation = ChatSyncInformation & StartSyncResponse;

export interface KBPluginData {
    sync: SyncInformation;
    settings: KBPluginSettings;
}

export default class KnowledgeBasePlugin extends Plugin {
    data: KBPluginData;
    fileChangesTracker: FileChangesTracker;
    knowledgeBase: KnowledgeBase;

    static vault: Vault;

    private syncInterval = {
        intervalRefreshId: 0,
        statusRefreshId: 0,
        value: 0,
    };

    async onload() {
        KnowledgeBasePlugin.vault = this.app.vault;

        cacheManager.setOptions({
            ttlSeconds: 30,
        });
        await this.loadPluginData();
        this.createKnowledgeBase();
        this.fileChangesTracker = new FileChangesTracker(this.app.vault);

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new KBSettingTab(this.app, this));

        this.registerView(
            VIEW_TYPE_CHAT,
            (leaf) =>
                new ChatView(leaf, {
                    knowledgeBase: this.knowledgeBase,
                    syncInformation: this.data.sync,
                })
        );

        this.addRibbonIcon('brain', `Open ${ChatView.TITLE}`, () => {
            this.activateChatView();
        });

        this.syncInterval = {
            statusRefreshId: 0,
            intervalRefreshId: this.setIntervalRefresh(),
            value: this.data.settings.syncConfiguration.syncFrequencyMinutes,
        };
        await this.updateSyncInformation(this.data.sync);

        this.addCommand({
            id: 'open-kb-chat',
            name: `Open ${ChatView.TITLE}`,
            callback: () => {
                this.activateChatView();
            },
        });

        this.addCommand({
            id: 'sync-kb',
            name: `Sync Knowledge Base`,
            callback: () => {
                this.startSyncing();
            },
        });
    }

    private async activateChatView() {
        // Don't create a new chat if enabled in settings and chat available
        if (
            !this.data.settings.behaviourConfiguration
                .createNewChatOnRibbonClick
        ) {
            const existingLeaf =
                this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0];

            if (existingLeaf) {
                await this.app.workspace.revealLeaf(existingLeaf);
                return;
            }
        }

        // Create new chat
        const leaf = this.app.workspace.getRightLeaf(false);

        if (!leaf) {
            return;
        }

        await leaf.setViewState({
            type: VIEW_TYPE_CHAT,
            active: true,
            state: {
                chatId: generateUUID(),
                messages: [],
            },
        });

        await this.app.workspace.revealLeaf(leaf);
    }

    @tryCatchInNotice('Error syncing Knowledge Base')
    async startSyncing(props?: SyncProps) {
        if (this.data.sync.isSyncing) {
            throw 'Knowledge Base already syncing';
        }

        new Notice('Starting Knowledge Base syncing...');

        // TODO: implement props allVault
        const { syncId } = await this.knowledgeBase.startSync({
            changedFiles: this.fileChangesTracker
                .getChangedFiles()
                .filter(
                    ({ extension, path }) =>
                        !this.data.settings.syncConfiguration.excludedFileExtensions.contains(
                            extension
                        ) &&
                        !this.data.settings.syncConfiguration.excludedFolders.contains(
                            path
                        )
                ),
            deletedFiles: this.fileChangesTracker
                .getDeletePaths()
                .filter(
                    (path) =>
                        !this.data.settings.syncConfiguration.excludedFolders.contains(
                            path
                        )
                ),
        });
        this.fileChangesTracker.reset();

        new Notice('Syncing Knowledge Base started');

        await this.updateSyncInformation({
            lastSync: new Date().toISOString(),
            isSyncing: true,
            syncId,
        });
    }

    private async updateSyncInformation(
        syncInformation: Partial<SyncInformation>
    ) {
        const { isSyncing, syncId } = syncInformation;
        if (isSyncing && syncId) {
            this.syncInterval.statusRefreshId = this.registerInterval(
                window.setInterval(async () => {
                    const { status } = await this.knowledgeBase.getSyncStatus({
                        syncId,
                    });

                    switch (status) {
                        case SyncStatus.IN_PROGRESS:
                            break;
                        case SyncStatus.SUCCEED:
                            new Notice('Knowledge Base sync succeeded');
                            await this.updateSyncInformation({
                                isSyncing: false,
                            });
                            window.clearInterval(
                                this.syncInterval.statusRefreshId
                            );
                            break;
                        case SyncStatus.FAILED:
                            new Notice('Knowledge Base sync failed');
                            await this.updateSyncInformation({
                                isSyncing: false,
                            });
                            window.clearInterval(
                                this.syncInterval.statusRefreshId
                            );
                            break;
                    }
                }, 10 * 1000)
            );
        }

        this.data.sync = {
            ...this.data.sync,
            ...syncInformation,
        };

        await this.savePluginData();
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT)) {
            if (!leaf.view) {
                continue;
            }

            if (!(leaf.view instanceof ChatView)) {
                continue;
            }

            (leaf.view as ChatView).updateSyncInformation(this.data.sync);
        }
    }

    @tryCatchInNotice('Error deleting Knowledge Base')
    async deleteAllData() {
        // TODO
    }

    private async loadPluginData() {
        this.data = Object.assign(
            {},
            { settings: DEFAULT_SETTINGS, sync: { isSyncing: false } },
            await this.loadData()
        );
    }

    private setIntervalRefresh(): number {
        return this.registerInterval(
            window.setInterval(
                () => this.startSyncing(),
                this.data.settings.syncConfiguration.syncFrequencyMinutes *
                    60 *
                    1000
            )
        );
    }

    async savePluginData() {
        // Register a new interval if the sync frequency changes
        if (
            this.data.settings.syncConfiguration.syncFrequencyMinutes !=
            this.syncInterval.value
        ) {
            window.clearInterval(this.syncInterval.intervalRefreshId);
            this.syncInterval.value =
                this.data.settings.syncConfiguration.syncFrequencyMinutes;
            this.syncInterval.intervalRefreshId = this.setIntervalRefresh();
        }

        await this.saveData(this.data);
    }

    createKnowledgeBase() {
        this.knowledgeBase = knowledgeBaseFactory(this.data.settings);
        this.data.sync = {
            syncId: '',
            isSyncing: false,
        };
    }
}
