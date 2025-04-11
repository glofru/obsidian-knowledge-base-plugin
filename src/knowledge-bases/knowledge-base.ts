import { TFile } from 'obsidian';

export enum KnowledgeBaseProvider {
    AWS_BEDROCK = 'AWS Bedrock',
}

export interface StartSyncProps {
    changedFiles: TFile[];
    deletedFiles: string[];
}

export interface StartSyncResponse {
    syncId: string;
}

export enum SyncStatus {
    SUCCEED = 'SUCCEED',
    IN_PROGRESS = 'IN_PROGRESS',
    FAILED = 'FAILED',
}

export interface SyncStatusResponse {
    syncId: string;
    status: SyncStatus;
}

export abstract class KnowledgeBase {
    abstract startSync(props: StartSyncProps): Promise<StartSyncResponse>;
    abstract getSyncStatus(syncId: string): Promise<SyncStatusResponse>;

    abstract query(text: string): string;

    abstract deleteAllData(): Promise<void>;
}
