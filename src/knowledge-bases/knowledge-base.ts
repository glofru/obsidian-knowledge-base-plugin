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

export interface QueryProps {
    text: string;
    chatId: string;
}

export interface QueryCitation {
    messagePart: { start?: number; end?: number };
    references: {
        fileName: string;
    }[];
}

export interface QueryResponse {
    text: string;
    citations: QueryCitation[];
}

export abstract class KnowledgeBase {
    abstract startSync(props: StartSyncProps): Promise<StartSyncResponse>;
    abstract getSyncStatus(
        props: StartSyncResponse
    ): Promise<SyncStatusResponse>;

    abstract query(props: QueryProps): Promise<QueryResponse>;
    abstract queryStream(
        props: QueryProps
    ): AsyncGenerator<QueryResponse, void, unknown>;

    abstract deleteAllData(): Promise<void>;
}
