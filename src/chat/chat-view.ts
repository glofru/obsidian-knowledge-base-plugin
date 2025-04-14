import { ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { ChatComponent, ChatMessage } from './chat-component';
import { KnowledgeBase } from '../knowledge-bases';
import { generateUUID } from '../obsidian-functions';

export const VIEW_TYPE_CHAT = 'kb-chat-view';

export interface ChatViewProps {
    knowledgeBase: KnowledgeBase;
}

interface ChatViewState {
    chatId: string;
    messages: ChatMessage[];
}
const DEFAULT_STATE: ChatViewState = {
    chatId: '',
    messages: [],
};

export class ChatView extends ItemView {
    constructor(leaf: WorkspaceLeaf, { knowledgeBase }: ChatViewProps) {
        super(leaf);

        this.knowledgeBase = knowledgeBase;
    }

    private chatComponent: ChatComponent;
    private knowledgeBase: KnowledgeBase;
    private state: ChatViewState = DEFAULT_STATE;

    static TITLE = 'Knowledge Base Chat';

    getViewType(): string {
        return VIEW_TYPE_CHAT;
    }

    getDisplayText(): string {
        return ChatView.TITLE;
    }

    getIcon(): string {
        return 'message-square';
    }

    setState(state: ChatViewState, result: ViewStateResult): Promise<void> {
        this.state = state;
        return super.setState(state, result);
    }

    getState(): Record<string, any> {
        return this.state;
    }

    private appendMessage = (message: ChatMessage) => {
        this.state.messages.push(message);
        this.chatComponent.appendMessage(message);
    };

    private async onSendMessage(message: string) {
        const userMessage: ChatMessage = {
            messageId: generateUUID(),
            text: message,
            role: 'user',
        };
        this.appendMessage(userMessage);

        const stream = this.knowledgeBase.queryStream({
            text: message,
            chatId: this.state.chatId,
        });

        let text = '';
        const assistantMessage: ChatMessage = {
            messageId: generateUUID(),
            text,
            role: 'assistant',
        };

        this.appendMessage(assistantMessage);

        for await (const chunk of stream) {
            text += chunk.text;
            this.chatComponent.updateMessage({
                ...assistantMessage,
                text,
            });
        }
    }

    async onOpen() {
        const container = this.containerEl;
        container.empty();

        const { messages } = this.state;

        this.chatComponent = new ChatComponent(container, {
            messages,
            onSendMessage: (message: string) => this.onSendMessage(message),
        });
    }
}
