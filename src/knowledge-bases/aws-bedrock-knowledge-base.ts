import { BedrockAgentClient } from '@aws-sdk/client-bedrock-agent';
import {
    DeleteObjectCommandInput,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from '@aws-sdk/client-s3';
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import {
    KnowledgeBase,
    StartSyncProps,
    StartSyncResponse,
    SyncStatus,
    SyncStatusResponse,
} from './knowledge-base';
import { TFile } from 'obsidian';

import * as fs from 'fs';
import * as os from 'os';
import { AwsCredentialIdentity } from '@aws-sdk/types';
import * as path from 'path';

/**
 * Decorator factory that refreshes AWS credentials before method execution
 */
function refreshAwsCredentials(profile: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            // Refresh the credentials before method execution
            const credentials = await refreshCredentials(profile);

            // Refresh Bedrock client
            this.bedrockClient = new BedrockAgentClient({
                region: this.configuration.region,
                credentials: credentials,
            });

            // Refresh Bedrock Runtime client
            this.bedrockRuntimeClient = new BedrockAgentRuntimeClient({
                region: this.configuration.region,
                credentials: credentials,
            });

            // Refresh S3 client
            this.s3Client = new S3Client({
                region: this.configuration.region,
                credentials: credentials,
            });

            // Execute the original method with the refreshed credentials
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

const parseIni = (
    input: string
): {
    [key: string]: string | { [key: string]: string };
} => {
    const result: { [key: string]: string | { [key: string]: string } } = {};
    let section = result;

    input.split('\n').forEach((line) => {
        let match;
        if ((match = line.match(/^\s*\[\s*([^\]]*)\s*\]\s*$/))) {
            section = result[match[1]] = {};
        } else if ((match = line.match(/^\s*([^=]+?)\s*=\s*(.*?)\s*$/))) {
            section[match[1]] = match[2];
        }
    });

    return result;
};

/**
 * Refresh AWS credentials using the AWS SDK
 */
function refreshCredentials(profile: string): AwsCredentialIdentity {
    const filePath = path.join(os.homedir(), '.aws', 'credentials'); // TODO: make it setting

    if (!fs.existsSync(filePath)) {
        throw 'Cannot find AWS credentials file';
    }

    const content = fs.readFileSync(filePath).toString('utf8');
    const credentialsContent = parseIni(content);

    for (const [profileName, data] of Object.entries(credentialsContent)) {
        if (profileName !== profile) {
            continue;
        }

        const credentialsData = data as any;

        return {
            accessKeyId: credentialsData.aws_access_key_id,
            secretAccessKey: credentialsData.aws_secret_access_key,
            sessionToken: credentialsData.aws_session_token,
        };
    }

    throw new Error('Cannot find profile in credentials file');
}

export interface AWSBedrockKnowledgeBaseConfiguration {
    region: string;
    knowledgeBaseId: string;
    s3BucketName: string;
    s3Prefix: string;
}

export class AWSBedrockKnowledgeBase extends KnowledgeBase {
    private bedrockClient: BedrockAgentClient;
    private bedrockRuntimeClient: BedrockAgentRuntimeClient;
    private s3Client: S3Client;

    constructor(private configuration: AWSBedrockKnowledgeBaseConfiguration) {
        super();
    }

    @refreshAwsCredentials('default')
    deleteAllData(): Promise<void> {
        return Promise.resolve(undefined);
    }

    @refreshAwsCredentials('default')
    getSyncStatus(syncId: string): Promise<SyncStatusResponse> {
        return Promise.resolve({
            syncId: 'test',
            status: SyncStatus.SUCCEED,
        });
    }

    @refreshAwsCredentials('default')
    query(text: string): string {
        return '';
    }

    private async prepareS3Deletions(
        paths: string[]
    ): Promise<DeleteObjectCommandInput[]> {
        const deletions: DeleteObjectCommandInput[] = [];

        for (const path in paths) {
            deletions.push({
                Bucket: this.configuration.s3BucketName,
                Key: path,
            });
        }

        return deletions;
    }

    private async prepareS3Changes(
        files: TFile[]
    ): Promise<PutObjectCommandInput[]> {
        const uploads: PutObjectCommandInput[] = [];

        for (const file of files) {
            const content = await file.vault.read(file);
            uploads.push({
                Bucket: this.configuration.s3BucketName,
                Key: file.path,
                Body: content,
            });
        }

        return uploads;
    }

    private async uploadChangesToS3({
        changedFiles,
        deletedFiles,
    }: StartSyncProps) {
        const deletions = await this.prepareS3Deletions(deletedFiles);
        const deletionPromises = deletions.map((deletion) =>
            this.s3Client.send(new PutObjectCommand(deletion))
        );

        try {
            await Promise.all(deletionPromises);
            console.log(
                `Successfully deleted ${deletions.length} files from S3`
            );
        } catch (error) {
            console.error(`Error deleting files from S3:`, error);
            throw new Error(`Error deleting files from S3: ${error.message}`);
        }

        const uploads = await this.prepareS3Changes(changedFiles);

        const uploadPromises = uploads.map((upload) =>
            this.s3Client.send(new PutObjectCommand(upload))
        );

        try {
            await Promise.all(uploadPromises);
            console.log(`Successfully uploaded ${uploads.length} files to S3`);
        } catch (error) {
            console.error(`Error uploading files to S3:`, error);
            throw new Error(`Error uploading files to S3: ${error.message}`);
        }
    }

    @refreshAwsCredentials('default')
    async startSync(props: StartSyncProps): Promise<StartSyncResponse> {
        await this.uploadChangesToS3(props);

        return Promise.resolve({
            syncId: 'test',
        });
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
    //             knowledgeBaseId: this.configuration.knowledgeBaseId,
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
    // //             knowledgeBaseId: this.configuration.knowledgeBaseId,
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
