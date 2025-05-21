import { TFile } from 'obsidian';

export enum KnowledgeBaseProvider {
    AWS_BEDROCK = 'AWS Bedrock',
    OLLAMA = 'Ollama (local)',
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
    numberOfResults?: number;
    chatId: string;
}

export interface QueryCitationReference {
    fileName: string;
    text?: string;
}

export interface QueryCitation {
    messagePart: { start?: number; end?: number };
    references: QueryCitationReference[];
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

    abstract queryStream(
        props: QueryProps
    ): AsyncGenerator<QueryResponse, void, unknown>;

    abstract deleteAllData(): Promise<void>;

    abstract allowQueryWhenNotSynced: boolean;
}
