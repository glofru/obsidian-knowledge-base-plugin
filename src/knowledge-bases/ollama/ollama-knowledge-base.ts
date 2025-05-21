import { OllamaEmbeddings } from '@langchain/ollama';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

import {
    KnowledgeBase,
    QueryProps,
    QueryResponse,
    StartSyncProps,
    StartSyncResponse,
    SyncStatus,
    SyncStatusResponse,
} from '../knowledge-base';
import { generateUUID } from '../../obsidian-functions';
import { OllamaVectorDatabase } from './ollama-vector-database';
import { OllamaResponseGenerator } from './ollama-response-generator';
import { getCitationSegments } from './ollama-functions';

const EMBEDDING_MODEL = 'nomic-embed-text';
const EMBEDDING_SIZE = 768;

export interface OllamaKnowledgeBaseConfiguration {
    generationModel: string;
}

export class OllamaKnowledgeBase extends KnowledgeBase {
    allowQueryWhenNotSynced = false;

    private embeddings: OllamaEmbeddings;
    private database: OllamaVectorDatabase;
    private responseGenerator: OllamaResponseGenerator;
    private textSplitter: RecursiveCharacterTextSplitter;
    private syncStatuses: Map<string, SyncStatusResponse>;
    private chatMessages: Map<string, string[]>;

    constructor({ generationModel }: OllamaKnowledgeBaseConfiguration) {
        super();
        this.embeddings = new OllamaEmbeddings({
            model: EMBEDDING_MODEL,
            baseUrl: 'http://localhost:11434',
        });
        this.database = new OllamaVectorDatabase(EMBEDDING_SIZE);
        this.responseGenerator = new OllamaResponseGenerator(generationModel);
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        this.syncStatuses = new Map();
        this.chatMessages = new Map();
    }

    private async syncKnowledgeBase({
        changedFiles,
        deletedFiles,
    }: StartSyncProps) {
        // Handle deleted files
        this.database.delete(deletedFiles);

        // Process changed files
        const total = changedFiles.length;
        let done = 0;
        await Promise.all(
            changedFiles.map(async (file) => {
                if (file.extension != 'md') {
                    done += 1;
                    return Promise.resolve();
                }

                const content = await file.vault.read(file);
                const docs = await this.textSplitter.createDocuments(
                    [content],
                    [{ source: file.path }],
                    { chunkHeader: `SOURCE: ${file.path}\n\n` }
                );

                // Wait 100 ms
                await new Promise((resolve) => setTimeout(resolve, 100));
                const embeddings = await this.embeddings.embedDocuments(
                    docs.map(({ pageContent }) => pageContent)
                );

                const data = docs.map(
                    ({ metadata: { source }, pageContent }, i) => ({
                        vector: embeddings[i],
                        filePath: source,
                        text: pageContent,
                    })
                );

                this.database.addVectors(data);

                done += 1;
                if (done % 10 == 0) {
                    console.log(
                        `Local Knowledge Base sync progress: ${((100 * done) / total).toFixed(2)}%`
                    );
                }
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

    async *queryStream({
        text,
        chatId,
        numberOfResults,
    }: QueryProps): AsyncGenerator<QueryResponse, void, unknown> {
        this.chatMessages.set(chatId, [
            ...(this.chatMessages.get(chatId) ?? []),
            `human: ${text}`,
        ]);

        const queryEmbedding = await this.embeddings.embedQuery(
            (this.chatMessages.get(chatId) ?? []).join('\n\n')
        );

        const results = this.database.query(queryEmbedding, numberOfResults);

        const stream = this.responseGenerator.generateResponse({
            chatId,
            prompt: text,
            references: results.map(({ filePath, text }) => ({
                fileName: filePath,
                text,
            })),
        });

        let assistantResponse = '';
        for await (const chunk of stream) {
            assistantResponse += chunk;
            yield {
                text: chunk,
                citations: [],
            };
        }

        const citations = getCitationSegments(assistantResponse, results);
        for (const { start, end, fileName, citation } of citations) {
            yield {
                text: '',
                citations: [
                    {
                        messagePart: { start, end },
                        references: [
                            {
                                text: citation,
                                fileName,
                            },
                        ],
                    },
                ],
            };
        }

        this.chatMessages.set(chatId, [
            ...(this.chatMessages.get(chatId) ?? []),
            `assistant: ${assistantResponse}`,
        ]);
    }

    async deleteAllData(): Promise<void> {}
}
