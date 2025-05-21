import {
    DeleteObjectCommand,
    DeleteObjectCommandInput,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from '@aws-sdk/client-s3';
import { TFile } from 'obsidian';
import { StartSyncProps } from '../knowledge-base';

const prepareS3Deletions = (
    paths: string[],
    bucketName: string
): DeleteObjectCommandInput[] => {
    const deletions: DeleteObjectCommandInput[] = [];

    for (const path of paths) {
        deletions.push({
            Bucket: bucketName,
            Key: path,
        });
    }

    return deletions;
};

const prepareS3Changes = async (
    files: TFile[],
    bucketName: string
): Promise<PutObjectCommandInput[]> => {
    const uploads: PutObjectCommandInput[] = [];

    for (const file of files) {
        try {
            const content = await file.vault.read(file);
            uploads.push({
                Bucket: bucketName,
                Key: file.path,
                Body: content,
            });
        } catch (error) {
            console.error(`Error reading file ${file.path}: ${error}`);
        }
    }

    return uploads;
};

export interface S3UploadChangesProps extends StartSyncProps {
    s3Client: S3Client;
    bucketName: string;
}

// Helper function to split an array into chunks
const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
};

export const uploadChangesToS3 = async ({
    changedFiles,
    bucketName,
    deletedFiles,
    s3Client,
}: S3UploadChangesProps) => {
    const BATCH_SIZE = 50;

    // Process deletions in batches
    const deletions = prepareS3Deletions(deletedFiles, bucketName);
    const deletionBatches = chunkArray(deletions, BATCH_SIZE);

    try {
        for (const batch of deletionBatches) {
            await Promise.all(
                batch.map((deletion) =>
                    s3Client.send(new DeleteObjectCommand(deletion))
                )
            );
        }
        console.log(
            `Successfully deleted all ${deletions.length} files from S3`
        );
    } catch (error) {
        console.error('Error deleting files:', error);
        throw `Error deleting files: ${error.message}`;
    }

    // Process uploads in batches
    const uploads = await prepareS3Changes(changedFiles, bucketName);
    const uploadBatches = chunkArray(uploads, BATCH_SIZE);

    try {
        for (const batch of uploadBatches) {
            await Promise.all(
                batch.map((upload) =>
                    s3Client.send(new PutObjectCommand(upload))
                )
            );
        }
        console.log(`Successfully uploaded all ${uploads.length} files to S3`);
    } catch (error) {
        console.error('Error uploading files:', error);
        throw `Error uploading files: ${error.message}`;
    }
};
