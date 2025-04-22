import { Setting } from 'obsidian';
import KnowledgeBasePlugin from '../../main';
import { OllamaKnowledgeBaseConfiguration } from './ollama-knowledge-base';

export class OllamaSetting {
    render(containerEl: HTMLElement, plugin: KnowledgeBasePlugin) {
        new Setting(containerEl).setName('Ollama').setHeading();

        new Setting(containerEl)
            .setName('Response generation model')
            .setDesc(
                'The model to generate the response from the knowledge base'
            )
            .addText((text) =>
                text
                    .setPlaceholder('llama3.2')
                    .setValue(
                        (
                            plugin.data.settings
                                .providerConfiguration as OllamaKnowledgeBaseConfiguration
                        ).generationModel
                    )
                    .onChange(async (value) => {
                        (
                            plugin.data.settings
                                .providerConfiguration as OllamaKnowledgeBaseConfiguration
                        ).generationModel = value;
                        await plugin.savePluginData();
                    })
            );
    }
}
