import {
    BedrockAgentClient,
    DeleteKnowledgeBaseCommand,
    GetIngestionJobCommand,
    StartIngestionJobCommand,
} from '@aws-sdk/client-bedrock-agent';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { fromEnv } from '@aws-sdk/credential-providers';
import { AwsCredentialIdentity } from '@aws-sdk/types';
import {
    BedrockAgentRuntimeClient,
    RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
    KnowledgeBase,
    StartSyncProps,
    StartSyncResponse,
    SyncStatus,
    SyncStatusResponse,
} from './knowledge-base';

/**
 * Decorator factory that refreshes AWS credentials before method execution
 */
function refreshAwsCredentials(
    options: {
        // Optional configuration for credential refresh
        profile?: string;
        region?: string;
        // Add other options as needed
    } = {}
) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            // Refresh the credentials before method execution
            const credentials = await refreshCredentials(options);

            // Refresh Bedrock client
            this.bedrockClient = new BedrockAgentClient({
                region: this.settings.awsRegion,
                credentials: credentials,
            });

            // Refresh Bedrock Runtime client
            this.bedrockRuntimeClient = new BedrockAgentRuntimeClient({
                region: this.settings.awsRegion,
                credentials: credentials,
            });

            // Refresh S3 client
            this.s3Client = new S3Client({
                region: this.settings.awsRegion,
                credentials: credentials,
            });

            // Execute the original method with the refreshed credentials
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

/**
 * Refresh AWS credentials using the AWS SDK
 */
async function refreshCredentials(options: {
    profile?: string;
    region?: string;
}): Promise<AwsCredentialIdentity> {
    try {
        // Try loading from environment variables first (useful in Lambda, ECS, etc.)
        const envCredentials = await fromEnv()();
        if (!envCredentials.accessKeyId) {
            throw new Error('Failed to load credentials from environment');
        }

        console.log('AWS credentials loaded from environment');
        return envCredentials;
    } catch (error) {
        console.log('Failed to load credentials from environment:', error);
        throw new Error(`Failed to refresh AWS credentials: ${error.message}`);
    }
}

export interface AwsKnowledgeBaseSettings {
    awsRegion: string;
    knowledgeBaseId: string;
    s3Bucket: string;
    s3Prefix: string;
}

export class AWSBedrockKnowledgeBase extends KnowledgeBase {
    private bedrockClient: BedrockAgentClient;
    private bedrockRuntimeClient: BedrockAgentRuntimeClient;
    private s3Client: S3Client;
    private settings: AwsKnowledgeBaseSettings;

    deleteAllData(): Promise<void> {
        return Promise.resolve(undefined);
    }

    getSyncStatus(syncId: string): Promise<SyncStatusResponse> {
        return Promise.resolve({
            syncId: 'test',
            status: SyncStatus.SUCCEED,
        });
    }

    query(text: string): string {
        return '';
    }

    startSync(props: StartSyncProps): Promise<StartSyncResponse> {
        return Promise.resolve({
            syncId: 'test',
        });
    }

    // constructor(settings: AwsKnowledgeBaseSettings) {
    //     this.settings = settings;
    // }
    //
    // updateSettings(settings: AwsKnowledgeBaseSettings) {
    //     this.settings = settings;
    // }
    //
    // private async uploadDocumentToS3(
    //     text: string,
    //     fileName: string,
    //     metadata: Record<string, string>
    // ): Promise<string> {
    //     try {
    //         // Create a unique key for the document in S3
    //         const key = `${this.settings.s3Prefix}/${Date.now()}-${fileName}.txt`;
    //
    //         // Upload the document to S3
    //         const command = new PutObjectCommand({
    //             Bucket: this.settings.s3Bucket,
    //             Key: key,
    //             Body: text,
    //             Metadata: metadata,
    //         });
    //
    //         await this.s3Client.send(command);
    //         return `s3://${this.settings.s3Bucket}/${key}`;
    //     } catch (error) {
    //         console.error('Error uploading document to S3:', error);
    //         throw error;
    //     }
    // }
    //
    // @refreshAwsCredentials()
    // async startIngestionJob(s3Path: string): Promise<string> {
    //     try {
    //         const command = new StartIngestionJobCommand({
    //             knowledgeBaseId: this.settings.knowledgeBaseId,
    //             dataSourceId: 'id',
    //         });
    //
    //         const response = await this.bedrockClient.send(command);
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
    //             knowledgeBaseId: this.settings.knowledgeBaseId,
    //             ingestionJobId: ingestionJobId,
    //             dataSourceId: 'id',
    //         });
    //
    //         return await this.bedrockClient.send(command);
    //     } catch (error) {
    //         console.error('Error getting ingestion job status:', error);
    //         throw error;
    //     }
    // }
    //
    // // async listIngestionJobs() {
    // //     try {
    // //         const command = new ListIngestionJobsCommand({
    // //             knowledgeBaseId: this.settings.knowledgeBaseId,
    // //         });
    // //
    // //         return await this.bedrockClient.send(command);
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
    //         knowledgeBaseId: this.settings.knowledgeBaseId,
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
    // //         return await this.bedrockClient.send(command);
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
    //         return await this.bedrockClient.send(command);
    //     } catch (error) {
    //         console.error('Error deleting Knowledge Base:', error);
    //         throw error;
    //     }
    // }
}
