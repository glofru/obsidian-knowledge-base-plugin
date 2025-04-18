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
import { KendraClient, DataSourceSyncJobStatus } from '@aws-sdk/client-kendra';
import {
    getDataSourcesStatus,
    getKnowledgeBaseS3BucketName,
    syncKnowledgeBase,
} from './aws-knowledge-base-functions';
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import { refreshAwsCredentials } from './aws-credentials-functions';
import {
    citationEventToQueryCitation,
    retrieveAndGenerate,
    retrieveAndGenerateStream,
} from './aws-bedrock-runtime-functions';

export interface AWSBedrockKnowledgeBaseConfiguration {
    region: string;
    knowledgeBaseId: string;
    modelArn: string;
}

export class AWSBedrockKnowledgeBase extends KnowledgeBase {
    private bedrockAgentClient: BedrockAgentClient;
    private bedrockRuntimeClient: BedrockAgentRuntimeClient;
    private kendraClient: KendraClient;
    private s3Client: S3Client;

    private chatToSessionId = new Map<string, string>();

    constructor(private configuration: AWSBedrockKnowledgeBaseConfiguration) {
        super();
    }

    @refreshAwsCredentials('default')
    deleteAllData(): Promise<void> {
        return Promise.resolve(undefined);
    }

    @refreshAwsCredentials('default')
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

    @refreshAwsCredentials('default')
    async query({
        text,
        chatId,
        numberOfResults,
    }: QueryProps): Promise<QueryResponse> {
        const sessionId = this.chatToSessionId.get(chatId);

        const {
            output,
            citations,
            sessionId: newSessionId,
        } = await retrieveAndGenerate({
            knowledgeBaseId: this.configuration.knowledgeBaseId,
            bedrockRuntimeClient: this.bedrockRuntimeClient,
            modelArn: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            numberOfResults,
            sessionId,
            text,
        });

        if (!output || !output.text) {
            console.error('No response output received from Bedrock Runtime');
            throw 'No response output from Bedrock Runtime';
        }

        this.chatToSessionId.set(chatId, newSessionId ?? sessionId ?? '');

        console.log(citations);

        return {
            text: output.text,
            citations: citations?.map(citationEventToQueryCitation) ?? [],
        };
    }

    @refreshAwsCredentials('default')
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
                modelArn: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
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

    @refreshAwsCredentials('default')
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

    //
    // @refreshAwsCredentials()
    // async startIngestionJob(s3Path: string): Promise<string> {
    //     try {
    //         const command = new StartIngestionJobCommand({
    //             knowledgeBaseId: this.configuration.knowledgeBaseId,
    //             dataSourceId: 'id',
    //         });
    //
    //         const response = await this.bedrockAgentClient.send(command);
    //
    //         const ingestionJobId = response.ingestionJob?.ingestionJobId;
    //         if (!ingestionJobId) {
    //             throw new Error('Failed to start ingestion job');
    //         }
    //
    //         return ingestionJobId;
    //     } catch (error) {
    //         console.error('Error starting ingestion job:', error);
    //         throw error;
    //     }
    // }
    //
    // @refreshAwsCredentials()
    // async getIngestionJobStatus(ingestionJobId: string) {
    //     try {
    //         const command = new GetIngestionJobCommand({
    //             knowledgeBaseId: this.configuration.knowledgeBaseId,
    //             ingestionJobId: ingestionJobId,
    //             dataSourceId: 'id',
    //         });
    //
    //         return await this.bedrockAgentClient.send(command);
    //     } catch (error) {
    //         console.error('Error getting ingestion job status:', error);
    //         throw error;
    //     }
    // }
    //
    // // async listIngestionJobs() {
    // //     try {
    // //         const command = new ListIngestionJobsCommand({
    // //             knowledgeBaseId: this.configuration.knowledgeBaseId,
    // //         });
    // //
    // //         return await this.bedrockAgentClient.send(command);
    // //     } catch (error) {
    // //         console.error('Error listing ingestion jobs:', error);
    // //         throw error;
    // //     }
    // // }
    //
    // @refreshAwsCredentials()
    // async queryKnowledgeBase(
    //     queryText: string,
    //     numberOfResults = 5
    // ): Promise<any[]> {
    //     const retrieveCommand = new RetrieveCommand({
    //         knowledgeBaseId: this.configuration.knowledgeBaseId,
    //         retrievalQuery: {
    //             text: queryText,
    //         },
    //         retrievalConfiguration: {
    //             vectorSearchConfiguration: {
    //                 numberOfResults,
    //             },
    //         },
    //     });
    //
    //     const response = await this.bedrockRuntimeClient.send(retrieveCommand);
    //     return response.retrievalResults || [];
    // }
    //
    // // async listKnowledgeBases() {
    // //     try {
    // //         const command = new ListKnowledgeBasesCommand({});
    // //         return await this.bedrockAgentClient.send(command);
    // //     } catch (error) {
    // //         console.error('Error listing Knowledge Bases:', error);
    // //         throw error;
    // //     }
    // // }
    //
    // @refreshAwsCredentials()
    // async deleteKnowledgeBase(knowledgeBaseId: string) {
    //     try {
    //         const command = new DeleteKnowledgeBaseCommand({
    //             knowledgeBaseId: knowledgeBaseId,
    //         });
    //         return await this.bedrockAgentClient.send(command);
    //     } catch (error) {
    //         console.error('Error deleting Knowledge Base:', error);
    //         throw error;
    //     }
    // }
}
