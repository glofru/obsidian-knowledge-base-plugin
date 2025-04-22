import { AWSBedrockKnowledgeBaseConfiguration } from './aws-bedrock';
import { OllamaKnowledgeBaseConfiguration } from './ollama';

export {
    KnowledgeBase,
    KnowledgeBaseProvider,
    SyncStatus,
} from './knowledge-base';
export type {
    QueryResponse,
    QueryCitation,
    QueryCitationReference,
    QueryProps,
    StartSyncProps,
    SyncStatusResponse,
    StartSyncResponse,
} from './knowledge-base';
export { knowledgeBaseFactory } from './knowledge-base-factory';

export type KnowledgeBaseConfigurations =
    | AWSBedrockKnowledgeBaseConfiguration
    | OllamaKnowledgeBaseConfiguration;
