import { setIcon } from 'obsidian';

type SendCallback = (message: string) => Promise<void>;

export interface ChatMessage {
    messageId: string;
    text: string;
    role: 'user' | 'assistant';
}

export interface ChatComponentProps {
    messages: ChatMessage[];
    onSendMessage: SendCallback;
}

export class ChatComponent {
    private chatLog: HTMLElement;
    private inputEl: HTMLInputElement;

    constructor(
        container: HTMLElement,
        private props: ChatComponentProps
    ) {
        this.chatLog = container.createDiv('chat-log');
        const inputWrapper = container.createDiv('chat-input-wrapper');

        this.inputEl = inputWrapper.createEl('input', {
            type: 'text',
            placeholder: 'Ask a question about your notes…',
        });
        this.inputEl.classList.add('chat-input');

        const sendButton = inputWrapper.createEl('button', { text: 'Send' });
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
    }

    appendMessage({ role, text, messageId }: ChatMessage) {
        const bubble = this.chatLog.createDiv('chat-bubble ' + role);

        const content = bubble.createDiv('chat-content ' + role);
        content.setAttr('message-id', messageId);
        content.setText(text || 'Generating...');

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
        };

        this.chatLog.scrollTop = this.chatLog.scrollHeight;
    }

    updateMessage({ messageId, text }: ChatMessage) {
        const bubble = this.findBubble(messageId);
        if (bubble) {
            bubble.setText(text);
        }
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
