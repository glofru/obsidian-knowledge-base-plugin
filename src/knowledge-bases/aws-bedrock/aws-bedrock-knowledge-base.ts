import { BedrockAgentClient } from '@aws-sdk/client-bedrock-agent';
import { S3Client } from '@aws-sdk/client-s3';
import {
    KnowledgeBase,
    QueryProps,
    QueryResponse,
    StartSyncProps,
    StartSyncResponse,
    SyncStatus,
    SyncStatusResponse,
} from '../knowledge-base';

import { uploadChangesToS3 } from './aws-s3-functions';
import { DataSourceSyncJobStatus, KendraClient } from '@aws-sdk/client-kendra';
import {
    getDataSourcesStatus,
    getKnowledgeBaseS3BucketName,
    syncKnowledgeBase,
} from './aws-knowledge-base-functions';
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import { refreshAwsCredentials } from './aws-credentials-functions';
import {
    citationEventToQueryCitation,
    retrieveAndGenerateStream,
} from './aws-bedrock-runtime-functions';

export interface AWSBedrockKnowledgeBaseConfiguration {
    profile: string;
    region: string;
    knowledgeBaseId: string;
    modelArn: string;
}

export class AWSBedrockKnowledgeBase extends KnowledgeBase {
    allowQueryWhenNotSynced = true;

    private bedrockAgentClient: BedrockAgentClient;
    private bedrockRuntimeClient: BedrockAgentRuntimeClient;
    private kendraClient: KendraClient;
    private s3Client: S3Client;

    private chatToSessionId = new Map<string, string>();

    constructor(private configuration: AWSBedrockKnowledgeBaseConfiguration) {
        super();
    }

    @refreshAwsCredentials()
    deleteAllData(): Promise<void> {
        return Promise.resolve(undefined);
    }

    @refreshAwsCredentials()
    async getSyncStatus({
        syncId,
    }: StartSyncResponse): Promise<SyncStatusResponse> {
        const statuses = await getDataSourcesStatus(
            {
                bedrockAgentClient: this.bedrockAgentClient,
                kendraClient: this.kendraClient,
                knowledgeBaseId: this.configuration.knowledgeBaseId,
            },
            syncId
        );

        if (
            statuses.includes(DataSourceSyncJobStatus.SYNCING) ||
            statuses.includes(DataSourceSyncJobStatus.SYNCING_INDEXING)
        ) {
            return { syncId, status: SyncStatus.IN_PROGRESS };
        }

        if (
            statuses.includes(DataSourceSyncJobStatus.FAILED) ||
            statuses.includes(DataSourceSyncJobStatus.ABORTED)
        ) {
            return { syncId, status: SyncStatus.FAILED };
        }

        return { syncId, status: SyncStatus.SUCCEED };
    }

    @refreshAwsCredentials()
    async *queryStream({
        text,
        chatId,
        numberOfResults,
    }: QueryProps): AsyncGenerator<QueryResponse, void, unknown> {
        const sessionId = this.chatToSessionId.get(chatId);

        const { stream, sessionId: newSessionId } =
            await retrieveAndGenerateStream({
                knowledgeBaseId: this.configuration.knowledgeBaseId,
                bedrockRuntimeClient: this.bedrockRuntimeClient,
                modelArn: this.configuration.modelArn,
                numberOfResults,
                sessionId,
                text,
            });

        if (!stream) {
            console.error('No response stream received from Bedrock Runtime');
            throw 'No response stream from Bedrock Runtime';
        }

        this.chatToSessionId.set(chatId, newSessionId ?? sessionId ?? '');

        for await (const { output, citation } of stream) {
            yield {
                text: output?.text ?? '',
                citations: citation
                    ? [citationEventToQueryCitation(citation)]
                    : [],
            };
        }
    }

    @refreshAwsCredentials()
    async startSync(props: StartSyncProps): Promise<StartSyncResponse> {
        const { knowledgeBaseId } = this.configuration;

        const s3BucketName = await getKnowledgeBaseS3BucketName({
            bedrockAgentClient: this.bedrockAgentClient,
            kendraClient: this.kendraClient,
            knowledgeBaseId,
        });

        await uploadChangesToS3({
            ...props,
            s3Client: this.s3Client,
            bucketName: s3BucketName,
        });

        const syncId = await syncKnowledgeBase({
            knowledgeBaseId,
            bedrockAgentClient: this.bedrockAgentClient,
            kendraClient: this.kendraClient,
        });

        return {
            syncId,
        };
    }
}
