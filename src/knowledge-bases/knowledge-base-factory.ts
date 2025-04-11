import { KBPluginSettings } from '../settings';
import { KnowledgeBase, KnowledgeBaseProvider } from './knowledge-base';
import { AWSBedrockKnowledgeBase } from './aws-bedrock-knowledge-base';

export const knowledgeBaseFactory = ({
    provider,
    providerConfiguration,
}: KBPluginSettings): KnowledgeBase => {
    switch (provider) {
        case KnowledgeBaseProvider.AWS_BEDROCK:
            return new AWSBedrockKnowledgeBase(providerConfiguration);
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
};
