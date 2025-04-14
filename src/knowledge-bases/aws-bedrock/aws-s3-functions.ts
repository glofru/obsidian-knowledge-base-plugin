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
        const content = await file.vault.read(file);
        uploads.push({
            Bucket: bucketName,
            Key: file.path,
            Body: content,
        });
    }

    return uploads;
};

export interface S3UploadChangesProps extends StartSyncProps {
    s3Client: S3Client;
    bucketName: string;
}

export const uploadChangesToS3 = async ({
    changedFiles,
    bucketName,
    deletedFiles,
    s3Client,
}: S3UploadChangesProps) => {
    const deletions = prepareS3Deletions(deletedFiles, bucketName);
    const deletionPromises = deletions.map((deletion) =>
        s3Client.send(new DeleteObjectCommand(deletion))
    );

    try {
        await Promise.all(deletionPromises);

        console.log(`Successfully deleted ${deletions.length} files from S3`);
    } catch (error) {
        console.error(`Error deleting files from S3:`, error);
        throw new Error(`Error deleting files from S3: ${error.message}`);
    }

    const uploads = await prepareS3Changes(changedFiles, bucketName);

    const uploadPromises = uploads.map((upload) =>
        s3Client.send(new PutObjectCommand(upload))
    );

    try {
        await Promise.all(uploadPromises);
        console.log(`Successfully uploaded ${uploads.length} files to S3`);
    } catch (error) {
        console.error(`Error uploading files to S3:`, error);
        throw new Error(`Error uploading files to S3: ${error.message}`);
    }
};
