import {
    App,
    ItemView,
    MarkdownView,
    Notice,
    TFile,
    ViewStateResult,
    WorkspaceLeaf,
} from 'obsidian';
import {
    ChatComponent,
    ChatMessage,
    ChatSyncInformation,
} from './chat-component';
import { KnowledgeBase, QueryCitationReference } from '../knowledge-bases';
import { generateUUID, tryCatchInNotice } from '../obsidian-functions';
import { QueryCitation } from '../knowledge-bases';

export const VIEW_TYPE_CHAT = 'kb-chat-view';

interface ChatViewProps {
    knowledgeBase: KnowledgeBase;
    syncInformation: ChatSyncInformation;
}

interface ChatViewState {
    chatId: string;
    messages: ChatMessage[];
}
const DEFAULT_STATE: ChatViewState = {
    chatId: generateUUID(),
    messages: [],
};

export class ChatView extends ItemView {
    constructor(
        leaf: WorkspaceLeaf,
        private props: ChatViewProps
    ) {
        super(leaf);
    }

    private chatComponent: ChatComponent;
    private state?: ChatViewState;

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
        if (!this.state) {
            state.messages.forEach((message) =>
                this.appendMessage(message, { onChat: true, onState: false })
            );
        }
        this.state = state;
        return super.setState(state, result);
    }

    getState(): Record<string, any> {
        return this.state ?? DEFAULT_STATE;
    }

    private appendMessage = async (
        message: ChatMessage,
        { onState, onChat }: { onState: boolean; onChat: boolean }
    ) => {
        if (onState && this.state) {
            this.state.messages.push(message);
            await this.setState(this.state, { history: true });
        }

        if (onChat) {
            this.chatComponent.appendMessage(message);
        }
    };

    @tryCatchInNotice('Error querying Knowledge Base')
    private async onSendMessage(message: string) {
        if (!this.state) {
            return;
        }

        const userMessage: ChatMessage = {
            messageId: generateUUID(),
            text: message,
            role: 'user',
        };
        await this.appendMessage(userMessage, { onChat: true, onState: true });

        const stream = this.props.knowledgeBase.queryStream({
            text: message,
            chatId: this.state.chatId,
        });

        let text = '';
        let citations: QueryCitation[] = [];
        const assistantMessage: ChatMessage = {
            messageId: generateUUID(),
            text,
            citations: [],
            role: 'assistant',
        };

        await this.appendMessage(assistantMessage, {
            onState: false,
            onChat: true,
        });

        for await (const chunk of stream) {
            text += chunk.text;
            citations = [...citations, ...chunk.citations];

            this.chatComponent.updateMessage({
                ...assistantMessage,
                text,
                citations,
            });
        }

        await this.appendMessage(
            { ...assistantMessage, text, citations },
            { onState: true, onChat: false }
        );
    }

    updateSyncInformation(syncInformation: ChatSyncInformation) {
        this.props.syncInformation = syncInformation;
        this.chatComponent.setSyncInformation(syncInformation);
    }

    @tryCatchInNotice('Citation error')
    async openAndSelectText(app: App, filePath: string, textToSelect?: string) {
        // Open the file
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!file || !(file instanceof TFile)) {
            throw new Error(`File ${filePath} not found`);
        }

        // Open the file in a new leaf (tab)
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);

        if (!textToSelect) {
            return;
        }

        // Get the editor
        const view = app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            throw new Error('No active markdown view');
        }

        const { editor } = view;
        // Get the content
        const content = editor.getValue().replace(/\r\n/g, '\n');

        // Decode the text to select
        const decodedTextToSelect = decodeURIComponent(textToSelect.trim());

        // Find the text position
        const position = content.indexOf(`${decodedTextToSelect}`);

        if (position === -1) {
            throw new Error('Text not found in file');
        }

        // Create the selection
        const start = editor.offsetToPos(position);
        const end = editor.offsetToPos(position + textToSelect.length);

        // Set the selection
        editor.setSelection(start, end);

        // Optionally scroll the selection into view
        editor.scrollIntoView({ from: start, to: end }, true);
    }

    async onOpen() {
        const container = this.containerEl;
        container.empty();

        const { messages } = this.state ?? DEFAULT_STATE;

        this.chatComponent = new ChatComponent(container, {
            messages,
            syncInformation: this.props.syncInformation,
            onSendMessage: (message: string) => this.onSendMessage(message),
            onClickReference: ({ fileName, text }: QueryCitationReference) =>
                this.openAndSelectText(this.app, fileName, text),
        });
    }
}
