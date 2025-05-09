import { Setting } from 'obsidian';
import KnowledgeBasePlugin from '../../main';
import { refreshAwsCredentials } from './aws-credentials-functions';
import { BedrockClient } from '@aws-sdk/client-bedrock';
import { AWSBedrockKnowledgeBaseConfiguration } from './aws-bedrock-knowledge-base';
import { listFoundationalModels } from './aws-bedrock-functions';
// @ts-ignore
import path from 'path';

export class AWSBedrockSetting {
    private bedrockClient: BedrockClient;

    // Configuration needed for AWS credentials
    constructor(private configuration: AWSBedrockKnowledgeBaseConfiguration) {}

    private download = async (
        plugin: KnowledgeBasePlugin,
        pathElements: string[]
    ) => {
        const json = await plugin.app.vault.adapter.read(
            path.join(plugin.manifest.dir, ...pathElements)
        );
        const url = URL.createObjectURL(
            new Blob([json], {
                type: 'application/json',
            })
        );

        const a = document.createElement('a');
        a.style.display = 'none';
        document.body.appendChild(a);
        a.href = url;
        a.download = 'template.yml';
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    @refreshAwsCredentials('default')
    private refreshCredentials() {
        // TODO: need to change the credentials decorator
    }

    render(containerEl: HTMLElement, plugin: KnowledgeBasePlugin) {
        new Setting(containerEl).setName('AWS Bedrock').setHeading();

        try {
            this.refreshCredentials();
        } catch (e) {
            new Setting(containerEl).setDesc(
                'Cannot find AWS credentials file on .aws/credentials'
            );

            return;
        }

        new Setting(containerEl)
            .setName('Region')
            .setDesc(
                'The region of the AWS Account containing the knowledge base'
            )
            .addText((text) =>
                text
                    .setPlaceholder('us-west-2')
                    .setValue(
                        (
                            plugin.data.settings
                                .providerConfiguration as AWSBedrockKnowledgeBaseConfiguration
                        ).region
                    )
                    .onChange(async (value) => {
                        (
                            plugin.data.settings
                                .providerConfiguration as AWSBedrockKnowledgeBaseConfiguration
                        ).region = value;
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
                        (
                            plugin.data.settings
                                .providerConfiguration as AWSBedrockKnowledgeBaseConfiguration
                        ).knowledgeBaseId
                    )
                    .onChange(async (value) => {
                        (
                            plugin.data.settings
                                .providerConfiguration as AWSBedrockKnowledgeBaseConfiguration
                        ).knowledgeBaseId = value;
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
                                [model.modelArn ?? '']: model.modelName,
                            }),
                            {}
                        )
                    )
                    .onChange(async (value) => {
                        (
                            plugin.data.settings
                                .providerConfiguration as AWSBedrockKnowledgeBaseConfiguration
                        ).modelArn = value;
                        await plugin.savePluginData();
                    })
                    .setValue(
                        (
                            plugin.data.settings
                                .providerConfiguration as AWSBedrockKnowledgeBaseConfiguration
                        ).modelArn
                    )
            );
        });

        new Setting(containerEl)
            .setName('Download CloudFormation template')
            .setDesc(
                'Download the CloudFormation template to deploy the AWS Kendra Knowledge Base'
            )
            .addButton((button) =>
                button
                    .setButtonText('Download')
                    .onClick(() =>
                        this.download(plugin, [
                            'attachments',
                            'aws-cloudformation-template.yml',
                        ])
                    )
                    .setClass('mod-cta')
            );
    }
}
