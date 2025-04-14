import { KBPluginSettings } from '../settings';
import { KnowledgeBase, KnowledgeBaseProvider } from './knowledge-base';
import { AWSBedrockKnowledgeBase } from './aws-bedrock';

export const knowledgeBaseFactory = ({
    provider,
    providerConfiguration,
}: KBPluginSettings): KnowledgeBase => {
    switch (provider) {
        case KnowledgeBaseProvider.AWS_BEDROCK:
            return new AWSBedrockKnowledgeBase(providerConfiguration);
        default:
            throw `Unknown provider: ${provider}`;
    }
};
