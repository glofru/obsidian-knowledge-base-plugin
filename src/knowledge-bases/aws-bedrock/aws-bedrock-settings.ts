import { Setting } from 'obsidian';
import KnowledgeBasePlugin from '../../main';

export const awsBedrockSettings = (
    containerEl: HTMLElement,
    plugin: KnowledgeBasePlugin
) => {
    new Setting(containerEl).setName('AWS Bedrock').setHeading();

    new Setting(containerEl)
        .setName('Region')
        .setDesc('The region of the AWS Account containing the knowledge base')
        .addText((text) =>
            text
                .setPlaceholder('us-west-2')
                .setValue(plugin.data.settings.providerConfiguration.region)
                .onChange(async (value) => {
                    plugin.data.settings.providerConfiguration.region = value;
                    await plugin.savePluginData();
                })
        );

    new Setting(containerEl)
        .setName('Knowledge Base ID')
        .setDesc('The ID of the knowledge base')
        .addText((text) =>
            text
                .setPlaceholder('0123456789')
                .setValue(
                    plugin.data.settings.providerConfiguration.knowledgeBaseId
                )
                .onChange(async (value) => {
                    plugin.data.settings.providerConfiguration.knowledgeBaseId =
                        value;
                    await plugin.savePluginData();
                })
        );
};
