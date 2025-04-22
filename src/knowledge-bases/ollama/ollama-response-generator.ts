import { SYSTEM_PROMPT, userPrompt } from '../prompts';
import {
    AIMessage,
    HumanMessage,
    SystemMessage,
} from '@langchain/core/messages';
import { BaseMessage } from '@langchain/core/dist/messages/base';
import { Ollama } from '@langchain/ollama';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { TFile } from 'obsidian';

interface GenerateResponseProps {
    chatId: string;
    prompt: string;
    files: TFile[];
}

export class OllamaResponseGenerator {
    private chatsHistory: Map<string, BaseMessage[]>;
    private readonly ollama: Ollama;

    constructor(model: string) {
        this.chatsHistory = new Map();

        this.ollama = new Ollama({
            baseUrl: 'http://localhost:11434', // default Ollama URL
            model,
        });
    }

    private addChatIfNotExist(chatId: string) {
        if (!this.chatsHistory.has(chatId)) {
            this.chatsHistory.set(chatId, [new SystemMessage(SYSTEM_PROMPT)]);
        }
    }

    async *generateResponse({ chatId, prompt, files }: GenerateResponseProps) {
        this.addChatIfNotExist(chatId);

        const userMessage = new HumanMessage(await userPrompt(prompt, files));
        const newMessages = [
            ...(this.chatsHistory.get(chatId) ?? []),
            userMessage,
        ];
        this.chatsHistory.set(chatId, newMessages);

        // Stream answer

        const chatPrompt = ChatPromptTemplate.fromMessages(newMessages);
        const chain = chatPrompt.pipe(this.ollama);
        const stream = await chain.stream(prompt);

        let aiResponse = '';
        for await (const chunk of stream) {
            aiResponse += chunk;
            yield chunk;
        }

        this.chatsHistory.set(chatId, [
            ...newMessages,
            new AIMessage(aiResponse),
        ]);
    }
}
