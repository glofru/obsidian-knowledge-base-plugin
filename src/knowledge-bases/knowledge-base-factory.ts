import { KBPluginSettings } from '../settings';
import { KnowledgeBase, KnowledgeBaseProvider } from './knowledge-base';
import {
    AWSBedrockKnowledgeBase,
    AWSBedrockKnowledgeBaseConfiguration,
} from './aws-bedrock';
import {
    OllamaKnowledgeBase,
    OllamaKnowledgeBaseConfiguration,
} from './ollama';

export const knowledgeBaseFactory = ({
    provider,
    providerConfiguration,
}: KBPluginSettings): KnowledgeBase => {
    switch (provider) {
        case KnowledgeBaseProvider.AWS_BEDROCK:
            return new AWSBedrockKnowledgeBase(
                providerConfiguration as AWSBedrockKnowledgeBaseConfiguration
            );
        case KnowledgeBaseProvider.OLLAMA:
            return new OllamaKnowledgeBase(
                providerConfiguration as OllamaKnowledgeBaseConfiguration
            );
        default:
            throw `Unknown provider: ${provider}`;
    }
};
