import { DropdownComponent, Setting } from 'obsidian';
import KnowledgeBasePlugin from '../../main';
import {
    AWSCredential,
    CredentialProfileNotFoundError,
    CredentialsFileNotFoundError,
    getCredentials,
    refreshAwsCredentials,
} from './aws-credentials-functions';
import { BedrockClient } from '@aws-sdk/client-bedrock';
import { AWSBedrockKnowledgeBaseConfiguration } from './aws-bedrock-knowledge-base';
import { listFoundationalModels } from './aws-bedrock-functions';
// @ts-ignore
import path from 'path';
import {
    listKnowledgeBases,
    listRegions,
} from './aws-knowledge-base-functions';
import { BedrockAgentClient } from '@aws-sdk/client-bedrock-agent';
import { Pricing } from '@aws-sdk/client-pricing';

export class AWSBedrockSetting {
    private bedrockClient: BedrockClient;
    private bedrockAgentClient: BedrockAgentClient;
    private pricingClient: Pricing;

    private configuration: AWSBedrockKnowledgeBaseConfiguration;

    private profilesDropdown: DropdownComponent | undefined;
    private regionsDropdown: DropdownComponent | undefined;
    private knowledgeBasesDropdown: DropdownComponent | undefined;
    private modelsDropdown: DropdownComponent | undefined;

    // Configuration needed for AWS credentials
    constructor(private plugin: KnowledgeBasePlugin) {
        this.configuration = plugin.data.settings
            .providerConfiguration as AWSBedrockKnowledgeBaseConfiguration;
    }

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

    @refreshAwsCredentials()
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private refreshCredentials() {}

    refreshProfiles = () => {
        if (!this.profilesDropdown) {
            return;
        }

        const credentials = getCredentials() as AWSCredential[];
        this.profilesDropdown.selectEl.options.length = 0;
        this.profilesDropdown.setDisabled(credentials.length === 0).addOptions(
            credentials.reduce(
                (acc, { profile }) => ({
                    ...acc,
                    [profile]: profile,
                }),
                {}
            )
        );

        if (
            credentials.find(
                ({ profile }) => profile === this.configuration.profile
            )
        ) {
            this.profilesDropdown.setValue(this.configuration.profile);
        }
    };

    refreshRegions = () => {
        listRegions({ pricingClient: this.pricingClient }).then((regions) => {
            if (!this.regionsDropdown) {
                return;
            }

            this.regionsDropdown.selectEl.options.length = 0;

            this.regionsDropdown.setDisabled(regions.length === 0).addOptions(
                regions.reduce(
                    (acc, { name, code }) => ({
                        ...acc,
                        [code]: `${name} (${code})`,
                    }),
                    {}
                )
            );

            if (
                regions.find(({ code }) => code === this.configuration.region)
            ) {
                this.regionsDropdown.setValue(this.configuration.region);
            }
        });
    };

    refreshKnowledgeBases = () => {
        listKnowledgeBases({
            bedrockAgentClient: this.bedrockAgentClient,
        }).then((knowledgeBases) => {
            if (!this.knowledgeBasesDropdown) {
                return;
            }
            this.knowledgeBasesDropdown.selectEl.options.length = 0;
            this.knowledgeBasesDropdown
                .setDisabled(knowledgeBases.length === 0)
                .addOptions(
                    knowledgeBases.reduce(
                        (acc, { knowledgeBaseId, name }) => ({
                            ...acc,
                            [knowledgeBaseId ?? '']:
                                `${name} (${knowledgeBaseId})`,
                        }),
                        {}
                    )
                );

            if (
                knowledgeBases.find(
                    ({ knowledgeBaseId }) =>
                        knowledgeBaseId === this.configuration.knowledgeBaseId
                )
            ) {
                this.knowledgeBasesDropdown.setValue(
                    this.configuration.knowledgeBaseId
                );
            } else {
                this.knowledgeBasesDropdown.setValue('');
            }
        });
    };

    refreshModels = () => {
        listFoundationalModels({
            bedrockClient: this.bedrockClient,
        }).then((models) => {
            if (!this.modelsDropdown) {
                return;
            }
            this.modelsDropdown.selectEl.options.length = 0;
            this.modelsDropdown.setDisabled(models.length === 0).addOptions(
                models.reduce(
                    (acc, { modelArn, modelName }) => ({
                        ...acc,
                        [modelArn ?? '']: modelName,
                    }),
                    {}
                )
            );

            if (
                models.find(
                    ({ modelArn }) => modelArn === this.configuration.modelArn
                )
            ) {
                this.modelsDropdown.setValue(this.configuration.modelArn);
            } else {
                this.modelsDropdown.setValue('');
            }
        });
    };

    private profileSetting(containerEl: HTMLElement): void {
        const profileSetting = new Setting(containerEl)
            .setName('Profile')
            .setDesc(
                'The profile of the AWS credentials accessing the knowledge base AWS account'
            );
        profileSetting.addDropdown((dropdown) => {
            this.profilesDropdown = dropdown;
            return dropdown
                .setDisabled(true)
                .onChange(async (value) => {
                    this.configuration.profile = value;
                    await this.plugin.savePluginData();
                    containerEl.empty();
                    this.render(containerEl);
                })
                .setValue(this.configuration.profile);
        });
        profileSetting.addButton((button) =>
            button
                .setIcon('refresh-cw')
                .setClass('mod-cta')
                .onClick(this.refreshProfiles)
        );
        this.refreshProfiles();
    }

    private regionSetting(containerEl: HTMLElement): void {
        const regionSetting = new Setting(containerEl)
            .setName('Region')
            .setDesc(
                'The region of the AWS Account containing the knowledge base'
            );
        regionSetting.addDropdown((dropdown) => {
            this.regionsDropdown = dropdown;
            return dropdown
                .setDisabled(true)
                .onChange(async (value) => {
                    this.configuration.region = value;
                    await this.plugin.savePluginData();
                    containerEl.empty();
                    this.render(containerEl);
                })
                .setValue(this.configuration.profile);
        });
        regionSetting.addButton((button) =>
            button
                .setIcon('refresh-cw')
                .setClass('mod-cta')
                .onClick(this.refreshRegions)
        );
        this.refreshRegions();
    }

    private knowledgeBaseSetting(containerEl: HTMLElement): void {
        const knowledgeBaseSetting = new Setting(containerEl)
            .setName('Knowledge Base')
            .setDesc('The ID of the Knowledge Base');
        knowledgeBaseSetting.addDropdown((dropdown) => {
            this.knowledgeBasesDropdown = dropdown;
            return dropdown
                .setDisabled(true)
                .onChange(async (value) => {
                    this.configuration.knowledgeBaseId = value;
                    await this.plugin.savePluginData();
                })
                .setValue(this.configuration.knowledgeBaseId);
        });
        knowledgeBaseSetting.addButton((button) =>
            button
                .setIcon('refresh-cw')
                .setClass('mod-cta')
                .onClick(this.refreshKnowledgeBases)
        );
        this.refreshKnowledgeBases();
    }

    private modelSetting(containerEl: HTMLElement): void {
        const modelSetting = new Setting(containerEl)
            .setName('Generation model')
            .setDesc('The model for the Knowledge Base answer generation');
        modelSetting.addDropdown((dropdown) => {
            this.modelsDropdown = dropdown;
            return dropdown
                .setDisabled(true)
                .onChange(async (value) => {
                    this.configuration.modelArn = value;
                    await this.plugin.savePluginData();
                })
                .setValue(this.configuration.modelArn);
        });
        modelSetting.addButton((button) =>
            button
                .setIcon('refresh-cw')
                .setClass('mod-cta')
                .onClick(this.refreshModels)
        );
        this.refreshModels();
    }

    render(container: HTMLElement) {
        const containerEl = container.createDiv();

        new Setting(containerEl).setName('AWS Bedrock').setHeading();

        try {
            this.refreshCredentials();
        } catch (e) {
            if (e instanceof CredentialsFileNotFoundError) {
                new Setting(containerEl)
                    .setDesc(
                        `Cannot find the AWS credentials file on .aws/credentials`
                    )
                    .addButton((button) =>
                        button
                            .setIcon('refresh-cw')
                            .setClass('mod-cta')
                            // eslint-disable-next-line no-unused-vars
                            .onClick((_) => {
                                containerEl.empty();
                                this.render(containerEl);
                            })
                    );

                return;
            } else if (e instanceof CredentialProfileNotFoundError) {
                new Setting(containerEl).setDesc(
                    `Cannot find the profile ${this.configuration.profile} in the AWS credentials file on .aws/credentials`
                );

                this.profileSetting(containerEl);

                return;
            }
        }

        this.profileSetting(containerEl);

        this.regionSetting(containerEl);

        this.knowledgeBaseSetting(containerEl);

        this.modelSetting(containerEl);

        new Setting(containerEl)
            .setName('Download CloudFormation template')
            .setDesc(
                'Download the CloudFormation template to deploy the AWS Kendra Knowledge Base'
            )
            .addButton((button) =>
                button
                    .setButtonText('Download')
                    .onClick(() =>
                        this.download(this.plugin, [
                            'attachments',
                            'aws-cloudformation-template.yml',
                        ])
                    )
                    .setClass('mod-cta')
            );
    }
}
