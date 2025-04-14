import { Notice, setIcon } from 'obsidian';
import { QueryCitation, QueryCitationReference } from '../knowledge-bases';
import { format } from 'date-fns';

type SendCallback = (message: string) => Promise<void>;
type CitationReferenceCallback = (reference: QueryCitationReference) => void;

const renderMessageWithCitations = (
    text: string,
    citations: QueryCitation[],
    citationReferenceCallback: CitationReferenceCallback
): DocumentFragment => {
    const fragment = document.createDocumentFragment();

    let currentIndex = 0;
    let referenceIndex = 1;

    for (const citation of citations) {
        const { start = 0, end = 0 } = citation.messagePart;

        // Add text before this citation if any
        if (start > currentIndex) {
            const plainText = text.slice(currentIndex, start);
            fragment.appendChild(document.createTextNode(plainText));
        }

        // Add the cited part of the message
        const citedText = text.slice(start, end);
        const span = document.createElement('span');
        span.textContent = citedText;

        // Append citation links
        for (const reference of citation.references) {
            const link = document.createElement('a');
            link.textContent = `[${referenceIndex++}]`;
            link.classList.add('citation-link');
            link.style.marginLeft = '6px';
            link.onclick = () => citationReferenceCallback(reference);
            span.appendChild(link);
        }

        fragment.appendChild(span);
        currentIndex = end;
    }

    // Add any remaining text after the last citation
    if (currentIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(currentIndex)));
    }

    return fragment;
};

export interface ChatMessage {
    messageId: string;
    citations?: QueryCitation[];
    text: string;
    role: 'user' | 'assistant';
}

export interface ChatSyncInformation {
    lastSync?: string;
    isSyncing: boolean;
}

export interface ChatComponentProps {
    messages: ChatMessage[];
    onSendMessage: SendCallback;
    onClickReference: CitationReferenceCallback;
    syncInformation: ChatSyncInformation;
}

export class ChatComponent {
    private syncInformation: HTMLElement;
    private chatLog: HTMLElement;
    private inputEl: HTMLInputElement;

    constructor(
        container: HTMLElement,
        private props: ChatComponentProps
    ) {
        this.syncInformation = container.createDiv('sync-information');
        this.syncInformation.setText('Last sync: ...');

        this.chatLog = container.createDiv('chat-log');
        const inputWrapper = container.createDiv('chat-input-wrapper');

        this.inputEl = inputWrapper.createEl('input', {
            type: 'text',
            placeholder: 'Ask a question about your notes…',
        });
        this.inputEl.classList.add('chat-input');

        const sendButton = inputWrapper.createEl('button', { text: 'Send' });
        setIcon(sendButton, 'send-horizontal');
        sendButton.classList.add('chat-send-button');

        sendButton.onclick = () => this.handleSend();
        this.inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSend();
        });

        setTimeout(() => {
            this.inputEl.focus();
        }, 100); // Focus the message input field

        if (props.messages) {
            props.messages.forEach((message) => {
                this.appendMessage(message);
            });
        }

        if (props.syncInformation) {
            this.setSyncInformation(props.syncInformation);
        }
    }

    appendMessage({ role, text, messageId, citations }: ChatMessage) {
        const bubble = this.chatLog.createDiv('chat-bubble ' + role);

        const content = bubble.createDiv('chat-content ' + role);
        content.setAttr('message-id', messageId);
        const messageText = text || 'Generating...';
        content.setText(
            citations
                ? renderMessageWithCitations(
                      messageText,
                      citations,
                      this.props.onClickReference
                  )
                : messageText
        );

        const actions = bubble.createDiv(`chat-actions`);
        const copyButton = actions.createEl('button', {
            cls: 'chat-action-button',
            attr: { title: 'Copy' },
        });
        setIcon(copyButton, 'copy');
        copyButton.onclick = () => {
            const textToCopy = this.findBubble(messageId)?.getText();
            if (!textToCopy) {
                return;
            }
            navigator.clipboard.writeText(textToCopy);
            new Notice('Message copied to clipboard');
        };

        this.chatLog.scrollTop = this.chatLog.scrollHeight;
    }

    updateMessage({ messageId, text, citations }: ChatMessage) {
        const bubble = this.findBubble(messageId);
        if (!bubble) {
            return;
        }

        if (!citations) {
            bubble.setText(text);
            return;
        }

        bubble.setText(
            renderMessageWithCitations(
                text,
                citations,
                this.props.onClickReference
            )
        );
    }

    setSyncInformation({ lastSync, isSyncing }: ChatSyncInformation) {
        const syncFormatted = lastSync
            ? format(new Date(lastSync), 'EEEE, MMMM do, h:mma')
            : 'never';
        const syncing = isSyncing ? ' (syncing now)' : '';
        this.syncInformation.setText(`Last sync: ${syncFormatted}${syncing}`);
    }

    private findBubble(messageId: string): HTMLElement | null {
        return this.chatLog.querySelector(`[message-id="${messageId}"]`);
    }

    private async handleSend() {
        const message = this.inputEl.value.trim();
        if (!message) {
            return;
        }

        this.inputEl.value = '';

        await this.props.onSendMessage(message);
    }

    private async fakeResponse(prompt: string): Promise<string> {
        return `Pretend response to: "${prompt}"`;
    }
}
