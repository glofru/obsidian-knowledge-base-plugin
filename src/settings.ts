import { App, PluginSettingTab, Setting } from 'obsidian';
import KnowledgeBasePlugin from './main';
import {
    KnowledgeBaseConfigurations,
    KnowledgeBaseProvider,
} from './knowledge-bases';
import { awsBedrockSettings } from './knowledge-bases/aws-bedrock';

export interface KBPluginSettings {
    provider: KnowledgeBaseProvider;
    providerConfiguration: KnowledgeBaseConfigurations;
    syncConfiguration: {
        syncFrequency: number; // in minutes
        excludedFolders: string[];
        excludedFileExtensions: string[];
    };
    behaviourConfiguration: {
        createNewChatOnRibbonClick: boolean;
    };
}

export const DEFAULT_SETTINGS: KBPluginSettings = {
    provider: KnowledgeBaseProvider.AWS_BEDROCK,
    providerConfiguration: {
        region: 'us-west-2',
        knowledgeBaseId: '',
    },
    syncConfiguration: {
        syncFrequency: 60,
        excludedFolders: [],
        excludedFileExtensions: [],
    },
    behaviourConfiguration: {
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
            .setName('Sync Configuration')
            .setHeading();

        new Setting(containerEl)
            .setName('Refresh Frequency')
            .setDesc(
                'The frequency at which to sync with the knowledge base (minutes)'
            )
            .addText((text) =>
                text
                    .setPlaceholder('60')
                    .setValue(
                        this.plugin.data.settings.syncConfiguration.syncFrequency.toString()
                    )
                    .onChange(async (value) => {
                        this.plugin.data.settings.syncConfiguration.syncFrequency =
                            parseInt(value);
                        await this.plugin.savePluginData();
                    })
            );

        new Setting(containerEl)
            .setName('Excluded Folders')
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
            .setName('Excluded File Extensions')
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
            .setName('Sync Now')
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
            .setName('Behaviour Configuration')
            .setHeading();

        new Setting(containerEl)
            .setName('Create New Chat on Icon Click')
            .setDesc('Create a new chat when clicking on the ribbon icon')
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
            .setName('Knowledge Base Provider')
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
            awsBedrockSettings(containerEl, this.plugin);
        }

        this.generateSyncConfiguration(containerEl);

        this.generateBehaviourConfiguration(containerEl);
    }
}
