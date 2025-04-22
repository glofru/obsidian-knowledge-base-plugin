import { KBPluginSettings } from '../settings';
import { KnowledgeBase, KnowledgeBaseProvider } from './knowledge-base';
import { AWSBedrockKnowledgeBase } from './aws-bedrock';
import { OllamaKnowledgeBase } from './ollama';

export const knowledgeBaseFactory = ({
    provider,
    providerConfiguration,
}: KBPluginSettings): KnowledgeBase => {
    switch (provider) {
        case KnowledgeBaseProvider.AWS_BEDROCK:
            return new AWSBedrockKnowledgeBase(providerConfiguration);
        case KnowledgeBaseProvider.OLLAMA:
            return new OllamaKnowledgeBase();
        default:
            throw `Unknown provider: ${provider}`;
    }
};
