import { App, PluginSettingTab, Setting } from 'obsidian';
import KnowledgeBasePlugin from './main';
import {
    KnowledgeBaseConfigurations,
    KnowledgeBaseProvider,
} from './knowledge-bases';
import { AWSBedrockSetting } from './knowledge-bases/aws-bedrock';

export interface KBPluginSettings {
    provider: KnowledgeBaseProvider;
    providerConfiguration: KnowledgeBaseConfigurations;
    syncConfiguration: {
        syncFrequencyMinutes: number;
        excludedFolders: string[];
        excludedFileExtensions: string[];
    };
    behaviourConfiguration: {
        numberOfResults: number;
        createNewChatOnRibbonClick: boolean;
    };
}

export const DEFAULT_SETTINGS: KBPluginSettings = {
    provider: KnowledgeBaseProvider.AWS_BEDROCK,
    providerConfiguration: {
        region: 'us-west-2',
        knowledgeBaseId: '',
        modelArn: '',
    },
    syncConfiguration: {
        syncFrequencyMinutes: 60,
        excludedFolders: [],
        excludedFileExtensions: [],
    },
    behaviourConfiguration: {
        numberOfResults: 5,
        createNewChatOnRibbonClick: true,
    },
};

export class KBSettingTab extends PluginSettingTab {
    plugin: KnowledgeBasePlugin;

    constructor(app: App, plugin: KnowledgeBasePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private generateSyncConfiguration(containerEl: HTMLElement): void {
        new Setting(this.containerEl)
            .setName('Sync configuration')
            .setHeading();

        new Setting(containerEl)
            .setName('Refresh frequency')
            .setDesc(
                'The frequency at which to sync with the knowledge base (minutes)'
            )
            .addText((text) =>
                text
                    .setPlaceholder('60')
                    .setValue(
                        this.plugin.data.settings.syncConfiguration.syncFrequencyMinutes.toString()
                    )
                    .onChange(async (value) => {
                        this.plugin.data.settings.syncConfiguration.syncFrequencyMinutes =
                            parseInt(value);
                        await this.plugin.savePluginData();
                    })
            );

        new Setting(containerEl)
            .setName('Excluded folders')
            .setDesc('Folders to exclude from syncing (separated by comma)')
            .addText((text) =>
                text
                    .setPlaceholder('secret_folder, keys, ...')
                    .setValue(
                        this.plugin.data.settings.syncConfiguration.excludedFolders.join(
                            ', '
                        )
                    )
                    .onChange(async (value) => {
                        this.plugin.data.settings.syncConfiguration.excludedFolders =
                            value.split(', ');
                        await this.plugin.savePluginData();
                    })
            );

        new Setting(containerEl)
            .setName('Excluded file extensions')
            .setDesc(
                'File extensions to exclude from syncing (separated by comma)'
            )
            .addText((text) =>
                text
                    .setPlaceholder('csv, txt, ...')
                    .setValue(
                        this.plugin.data.settings.syncConfiguration.excludedFileExtensions.join(
                            ', '
                        )
                    )
                    .onChange(async (value) => {
                        this.plugin.data.settings.syncConfiguration.excludedFileExtensions =
                            value.split(', ');
                        await this.plugin.savePluginData();
                    })
            );

        new Setting(containerEl)
            .setName('Sync now')
            .setDesc('Manually trigger a sync with the knowledge base')
            .addButton((button) =>
                button
                    .setButtonText('Sync')
                    .onClick(async () => {
                        button.setDisabled(true);
                        await this.plugin.startSyncing({ allVault: true });
                        button.setDisabled(this.plugin.data.sync.isSyncing);
                    })
                    .setClass('mod-cta')
                    .setDisabled(this.plugin.data.sync.isSyncing)
            );
    }

    private generateBehaviourConfiguration = (containerEl: HTMLElement) => {
        new Setting(this.containerEl)
            .setName('Behaviour configuration')
            .setHeading();

        new Setting(containerEl)
            .setName('Number of results')
            .setDesc(
                'The number of results to the knowledge base considers when querying'
            )
            .addText((text) =>
                text
                    .setPlaceholder('5')
                    .setValue(
                        this.plugin.data.settings.behaviourConfiguration.numberOfResults?.toString()
                    )
                    .onChange(async (value) => {
                        this.plugin.data.settings.behaviourConfiguration.numberOfResults =
                            parseInt(value);
                        await this.plugin.savePluginData();
                    })
            );

        new Setting(containerEl)
            .setName('Create new chat when opening a chat')
            .setDesc(
                'Create always a new chat when chat when given the command of opening a chat'
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(
                        this.plugin.data.settings.behaviourConfiguration
                            .createNewChatOnRibbonClick
                    )
                    .onChange(async (value) => {
                        this.plugin.data.settings.behaviourConfiguration.createNewChatOnRibbonClick =
                            value;
                        await this.plugin.savePluginData();
                    })
            );
    };

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Knowledge Base provider')
            .setDesc('The Knowledge Base service to sync with Obsidian')
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions(
                        Object.entries(KnowledgeBaseProvider).reduce(
                            (acc, [_, value]) => ({
                                ...acc,
                                [value]: value,
                            }),
                            {}
                        )
                    )
                    .setValue(this.plugin.data.settings.provider)
                    .onChange(async (value: KnowledgeBaseProvider) => {
                        this.plugin.data.settings.provider = value;
                        await this.plugin.savePluginData();
                        this.display();
                    });
            });

        if (
            this.plugin.data.settings.provider ===
            KnowledgeBaseProvider.AWS_BEDROCK
        ) {
            new AWSBedrockSetting(
                this.plugin.data.settings.providerConfiguration
            ).render(containerEl, this.plugin);
        }

        this.generateSyncConfiguration(containerEl);

        this.generateBehaviourConfiguration(containerEl);
    }
}
