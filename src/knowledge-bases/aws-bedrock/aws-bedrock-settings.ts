import { Setting } from 'obsidian';
import KnowledgeBasePlugin from '../../main';
import { refreshAwsCredentials } from './aws-credentials-functions';
import { BedrockClient } from '@aws-sdk/client-bedrock';
import { AWSBedrockKnowledgeBaseConfiguration } from './aws-bedrock-knowledge-base';
import { listFoundationalModels } from './aws-bedrock-functions';

export class AWSBedrockSetting {
    private bedrockClient: BedrockClient;

    // Configuration needed for AWS credentials
    constructor(private configuration: AWSBedrockKnowledgeBaseConfiguration) {}

    @refreshAwsCredentials('default')
    render(containerEl: HTMLElement, plugin: KnowledgeBasePlugin) {
        new Setting(containerEl).setName('AWS Bedrock').setHeading();

        new Setting(containerEl)
            .setName('Region')
            .setDesc(
                'The region of the AWS Account containing the knowledge base'
            )
            .addText((text) =>
                text
                    .setPlaceholder('us-west-2')
                    .setValue(plugin.data.settings.providerConfiguration.region)
                    .onChange(async (value) => {
                        plugin.data.settings.providerConfiguration.region =
                            value;
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
                        plugin.data.settings.providerConfiguration
                            .knowledgeBaseId
                    )
                    .onChange(async (value) => {
                        plugin.data.settings.providerConfiguration.knowledgeBaseId =
                            value;
                        await plugin.savePluginData();
                    })
            );

        const modelSetting = new Setting(containerEl)
            .setName('Generation model')
            .setDesc('The model for the Knowledge Base answer generation');

        listFoundationalModels({
            bedrockClient: this.bedrockClient,
        }).then((models) => {
            modelSetting.addDropdown((dropdown) =>
                dropdown
                    .setDisabled(models.length === 0)
                    .addOptions(
                        models.reduce(
                            (acc, model) => ({
                                ...acc,
                                [model.modelArn!]: model.modelName,
                            }),
                            {}
                        )
                    )
                    .onChange(async (value) => {
                        plugin.data.settings.providerConfiguration.modelArn =
                            value;
                        await plugin.savePluginData();
                    })
                    .setValue(
                        plugin.data.settings.providerConfiguration.modelArn
                    )
            );
        });
    }
}
