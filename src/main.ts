import { Plugin } from 'obsidian';
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

    private syncInterval = {
        intervalRefreshId: 0,
        statusRefreshId: 0,
        value: 0,
    };

    async onload() {
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
            value: this.data.settings.syncConfiguration.syncFrequency,
        };
        await this.updateSyncInformation(this.data.sync);

        // // This creates an icon in the left ribbon.
        // const ribbonIconEl = this.addRibbonIcon(
        //     'dice',
        //     'Sample Plugin',
        //     (evt: MouseEvent) => {
        //         // Called when the user clicks the icon.
        //         new Notice('This is a notice!');
        //     }
        // );
        // // Perform additional things with the ribbon
        // ribbonIconEl.addClass('my-plugin-ribbon-class');
        //
        // // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        // const statusBarItemEl = this.addStatusBarItem();
        // statusBarItemEl.setText('Status Bar Text');
        //
        // // This adds a simple command that can be triggered anywhere
        // this.addCommand({
        //     id: 'open-sample-modal-simple',
        //     name: 'Open sample modal (simple)',
        //     callback: () => {
        //         new SampleModal(this.app).open();
        //     },
        // });
        // // This adds an editor command that can perform some operation on the current editor instance
        // this.addCommand({
        //     id: 'sample-editor-command',
        //     name: 'Sample editor command',
        //     editorCallback: (editor: Editor, view: MarkdownView) => {
        //         console.log(editor.getSelection());
        //         editor.replaceSelection('Sample Editor Command');
        //     },
        // });
        // // This adds a complex command that can check whether the current state of the app allows execution of the command
        // this.addCommand({
        //     id: 'open-sample-modal-complex',
        //     name: 'Open sample modal (complex)',
        //     checkCallback: (checking: boolean) => {
        //         // Conditions to check
        //         const markdownView =
        //             this.app.workspace.getActiveViewOfType(MarkdownView);
        //         if (markdownView) {
        //             // If checking is true, we're simply "checking" if the command can be run.
        //             // If checking is false, then we want to actually perform the operation.
        //             if (!checking) {
        //                 new SampleModal(this.app).open();
        //             }
        //
        //             // This command will only show up in Command Palette when the check function returns true
        //             return true;
        //         }
        //     },
        // });

        // // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
        // // Using this function will automatically remove the event listener when this plugin is disabled.
        // this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
        //     console.log('click', evt);
        // });
        //
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

        // TODO: implement props allVault
        console.log('Syncing Knowledge Base');
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

        console.log(`Start syncing Knowledge Base: ${syncId}`);

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
                    console.log('Sync status', status);
                    if (status === SyncStatus.SUCCEED) {
                        await this.updateSyncInformation({
                            isSyncing: false,
                        });
                        window.clearInterval(this.syncInterval.statusRefreshId);
                    }
                }, 2 * 1000)
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
                this.data.settings.syncConfiguration.syncFrequency * 60 * 1000
            )
        );
    }

    async savePluginData() {
        // Register a new interval if the sync frequency changes
        if (
            this.data.settings.syncConfiguration.syncFrequency !=
            this.syncInterval.value
        ) {
            window.clearInterval(this.syncInterval.intervalRefreshId);
            this.syncInterval.value =
                this.data.settings.syncConfiguration.syncFrequency;
            this.syncInterval.intervalRefreshId = this.setIntervalRefresh();
        }

        await this.saveData(this.data);
    }

    private createKnowledgeBase() {
        this.knowledgeBase = knowledgeBaseFactory(this.data.settings);
    }
}
