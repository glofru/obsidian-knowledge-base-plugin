import { App, PluginSettingTab, Setting } from 'obsidian';
import KnowledgeBasePlugin from './main';
import {
    KnowledgeBaseConfigurations,
    KnowledgeBaseProvider,
} from './knowledge-bases';

export interface KBPluginSettings {
    provider: KnowledgeBaseProvider;
    providerConfiguration: KnowledgeBaseConfigurations;
    syncConfiguration: {
        refreshFrequency: number; // in minutes
        excludedFolders: string[];
        excludedFileExtensions: string[];
    };
}

export const DEFAULT_SETTINGS: KBPluginSettings = {
    provider: KnowledgeBaseProvider.AWS_BEDROCK,
    providerConfiguration: {
        region: 'us-west-2',
        knowledgeBaseId: '',
        s3BucketName: '',
        s3Prefix: '',
    },
    syncConfiguration: {
        refreshFrequency: 60,
        excludedFolders: [],
        excludedFileExtensions: [],
    },
};

export class KBSettingTab extends PluginSettingTab {
    plugin: KnowledgeBasePlugin;

    constructor(app: App, plugin: KnowledgeBasePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private generateAWSBedrockConfiguration(containerEl: HTMLElement): void {
        new Setting(this.containerEl).setName('AWS Bedrock').setHeading();

        new Setting(containerEl)
            .setName('Region')
            .setDesc(
                'The region of the AWS Account containing the knowledge base'
            )
            .addText((text) =>
                text
                    .setPlaceholder('us-west-2')
                    .setValue(this.plugin.settings.providerConfiguration.region)
                    .onChange(async (value) => {
                        this.plugin.settings.providerConfiguration.region =
                            value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Knowledge Base ID')
            .setDesc('The ID of the knowledge base')
            .addText((text) =>
                text
                    .setPlaceholder('0123456789')
                    .setValue(
                        this.plugin.settings.providerConfiguration
                            .knowledgeBaseId
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.providerConfiguration.knowledgeBaseId =
                            value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('S3 Bucket Name')
            .setDesc(
                'The name of the S3 bucket where to store the data for the knowledge base'
            )
            .addText((text) =>
                text
                    .setPlaceholder('my-knowledge-base-data')
                    .setValue(
                        this.plugin.settings.providerConfiguration.s3BucketName
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.providerConfiguration.s3BucketName =
                            value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('S3 Prefix')
            .setDesc(
                'The prefix of the folder in the S3 bucket where to store the data'
            )
            .addText((text) =>
                text
                    .setPlaceholder('data/...')
                    .setValue(
                        this.plugin.settings.providerConfiguration.s3Prefix
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.providerConfiguration.s3Prefix =
                            value;
                        await this.plugin.saveSettings();
                    })
            );
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
                        this.plugin.settings.syncConfiguration.refreshFrequency.toString()
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.syncConfiguration.refreshFrequency =
                            parseInt(value);
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Excluded Folders')
            .setDesc('Folders to exclude from syncing (separated by comma)')
            .addText((text) =>
                text
                    .setPlaceholder('secret_folder, keys, ...')
                    .setValue(
                        this.plugin.settings.syncConfiguration.excludedFolders.join(
                            ', '
                        )
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.syncConfiguration.excludedFolders =
                            value.split(', ');
                        await this.plugin.saveSettings();
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
                        this.plugin.settings.syncConfiguration.excludedFileExtensions.join(
                            ', '
                        )
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.syncConfiguration.excludedFileExtensions =
                            value.split(', ');
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Sync Now')
            .setDesc('Manually trigger a sync with the knowledge base')
            .addButton((button) =>
                button.setButtonText('Sync').onClick(async () => {
                    await this.plugin.sync({ allVault: true });
                })
            );
    }

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
                    .setValue(this.plugin.settings.provider)
                    .onChange(async (value: KnowledgeBaseProvider) => {
                        this.plugin.settings.provider = value;
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });

        if (
            this.plugin.settings.provider === KnowledgeBaseProvider.AWS_BEDROCK
        ) {
            this.generateAWSBedrockConfiguration(containerEl);
        }

        this.generateSyncConfiguration(containerEl);
    }
}
