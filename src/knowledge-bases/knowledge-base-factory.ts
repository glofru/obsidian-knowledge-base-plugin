import { KBPluginSettings } from '../settings';
import { KnowledgeBase, KnowledgeBaseProvider } from './knowledge-base';
import { AWSBedrockKnowledgeBase } from './aws-bedrock';
import { OllamaChromaKnowledgeBase } from './ollama-chroma';

export const knowledgeBaseFactory = ({
    provider,
    providerConfiguration,
}: KBPluginSettings): KnowledgeBase => {
    switch (provider) {
        case KnowledgeBaseProvider.AWS_BEDROCK:
            return new AWSBedrockKnowledgeBase(providerConfiguration);
        case KnowledgeBaseProvider.OLLAMA_CHROMA:
            return new OllamaChromaKnowledgeBase();
        default:
            throw `Unknown provider: ${provider}`;
    }
};
