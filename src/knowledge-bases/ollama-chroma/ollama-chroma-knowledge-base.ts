import { ChromaClient } from 'chromadb';
import { OllamaEmbeddings, Ollama } from '@langchain/ollama';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

import {
    KnowledgeBase,
    StartSyncProps,
    StartSyncResponse,
    SyncStatusResponse,
    SyncStatus,
    QueryProps,
    QueryResponse,
    QueryCitation,
} from '../knowledge-base';
import { generateUUID } from '../../obsidian-functions';

export class OllamaChromaKnowledgeBase extends KnowledgeBase {
    private chromaClient: ChromaClient;
    private collection: any;
    private embeddings: OllamaEmbeddings;
    private textSplitter: RecursiveCharacterTextSplitter;
    private syncStatuses: Map<string, SyncStatusResponse>;

    constructor() {
        super();
        this.chromaClient = new ChromaClient();
        this.embeddings = new OllamaEmbeddings({
            model: 'llama3.2',
            baseUrl: 'http://localhost:11434',
        });
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        this.syncStatuses = new Map();
    }

    private async getCollection() {
        if (!this.collection) {
            this.collection = await this.chromaClient.getOrCreateCollection({
                name: 'obsidian-kb',
            });
        }
        return this.collection;
    }

    private async syncKnowledgeBase({
        changedFiles,
        deletedFiles,
    }: StartSyncProps) {
        const collection = await this.getCollection();

        // Handle deleted files
        await Promise.all(
            deletedFiles.map(async (filePath) => {
                const existing = await collection.get({
                    where: { source: filePath },
                });
                if (existing.ids.length > 0) {
                    await collection.delete({ ids: existing.ids });
                }
            })
        );

        // Process changed files
        await Promise.all(
            changedFiles.map(async (file) => {
                const content = await file.vault.read(file);
                const docs = await this.textSplitter.createDocuments(
                    [content],
                    [{ source: file.path }],
                    { chunkHeader: `SOURCE: ${file.path}\n\n` }
                );

                const embeddings = await this.embeddings.embedDocuments(
                    docs.map(({ pageContent }) => pageContent)
                );
                await collection.add({
                    ids: docs.map((_, i) => `${file.path}-${i}`),
                    metadatas: docs.map(({ metadata }) => metadata),
                    documents: docs.map(({ pageContent }) => pageContent),
                    embeddings,
                });
            })
        );
    }

    async startSync(props: StartSyncProps): Promise<StartSyncResponse> {
        const syncId = generateUUID();
        this.syncStatuses.set(syncId, {
            syncId,
            status: SyncStatus.IN_PROGRESS,
        });

        this.syncKnowledgeBase(props)
            .then(() => {
                this.syncStatuses.set(syncId, {
                    syncId,
                    status: SyncStatus.SUCCEED,
                });
            })
            .catch((error) => {
                console.error(
                    'Sync Ollama Chroma Knowledge Base failed:',
                    error
                );
                this.syncStatuses.set(syncId, {
                    syncId,
                    status: SyncStatus.FAILED,
                });
            });

        return { syncId };
    }

    async getSyncStatus({
        syncId,
    }: StartSyncResponse): Promise<SyncStatusResponse> {
        return (
            this.syncStatuses.get(syncId) || {
                syncId,
                status: SyncStatus.FAILED,
            }
        );
    }

    async query({
        text,
        numberOfResults = 3,
    }: QueryProps): Promise<QueryResponse> {
        const collection = await this.getCollection();
        const queryEmbedding = await this.embeddings.embedQuery(text);

        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: numberOfResults,
        });

        const documents = results.documents[0] as string[];
        const metadatas = results.metadatas[0] as Array<{ source: string }>;

        const context = documents
            .map((doc, i) => `Source: ${metadatas[i].source}\n${doc}`)
            .join('\n\n');

        const model = new Ollama({
            model: 'llama3.2',
            baseUrl: 'http://localhost:11434',
        });

        const response = await model.invoke(
            `Answer using context below. Cite sources using [source] notation.\n\nContext:\n${context}\n\nQuestion: ${text}\nAnswer:`
        );

        // Simple citation extraction (improve this in production)
        const citations: QueryCitation[] = [];
        const sourceRegex = /\[source: (.+?)\]/g;
        let match;

        while ((match = sourceRegex.exec(response)) !== null) {
            citations.push({
                messagePart: {
                    start: match.index,
                    end: match.index + match[0].length,
                },
                references: [{ fileName: match[1] }],
            });
        }

        return {
            text: response.replace(sourceRegex, '').trim(),
            citations,
        };
    }

    async *queryStream(
        props: QueryProps
    ): AsyncGenerator<QueryResponse, void, unknown> {
        const response = await this.query(props);
        yield response;
    }

    async deleteAllData(): Promise<void> {
        try {
            await this.chromaClient.deleteCollection({ name: 'obsidian-kb' });
            this.collection = null;
        } catch (error) {
            console.error('Failed to delete collection:', error);
            throw error;
        }
    }
}
