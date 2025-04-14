import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, KBPluginSettings, KBSettingTab } from './settings';
import { FileChangesTracker } from './file-changes-tracker';
import { KnowledgeBase, knowledgeBaseFactory } from './knowledge-bases';
import { generateUUID, tryCatchInNotice } from './obsidian-functions';
import { ChatView, VIEW_TYPE_CHAT } from './chat';

export interface SyncProps {
    allVault?: boolean; // Default: false
}

export default class KnowledgeBasePlugin extends Plugin {
    settings: KBPluginSettings;
    fileChangesTracker: FileChangesTracker;
    knowledgeBase: KnowledgeBase;

    async onload() {
        await this.loadSettings();
        this.createKnowledgeBase();
        this.fileChangesTracker = new FileChangesTracker(this.app.vault);

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new KBSettingTab(this.app, this));

        this.registerView(
            VIEW_TYPE_CHAT,
            (leaf) => new ChatView(leaf, { knowledgeBase: this.knowledgeBase })
        );

        this.addRibbonIcon('brain', `Open ${ChatView.TITLE}`, () => {
            this.activateChatView();
        });

        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        // this.registerInterval(window.setInterval(() => this.sync(), 2 * 1000));

        // // This creates an icon in the left ribbon.
        // const ribbonIconEl = this.addRibbonIcon(
        //     'dice',
        //     'Sample Plugin',
        //     (evt: MouseEvent) => {
        //         // Called when the user clicks the icon.
        //         new Notice('This is a notice!');
        //     }
        // );
        // // Perform additional things with the ribbon
        // ribbonIconEl.addClass('my-plugin-ribbon-class');
        //
        // // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        // const statusBarItemEl = this.addStatusBarItem();
        // statusBarItemEl.setText('Status Bar Text');
        //
        // // This adds a simple command that can be triggered anywhere
        // this.addCommand({
        //     id: 'open-sample-modal-simple',
        //     name: 'Open sample modal (simple)',
        //     callback: () => {
        //         new SampleModal(this.app).open();
        //     },
        // });
        // // This adds an editor command that can perform some operation on the current editor instance
        // this.addCommand({
        //     id: 'sample-editor-command',
        //     name: 'Sample editor command',
        //     editorCallback: (editor: Editor, view: MarkdownView) => {
        //         console.log(editor.getSelection());
        //         editor.replaceSelection('Sample Editor Command');
        //     },
        // });
        // // This adds a complex command that can check whether the current state of the app allows execution of the command
        // this.addCommand({
        //     id: 'open-sample-modal-complex',
        //     name: 'Open sample modal (complex)',
        //     checkCallback: (checking: boolean) => {
        //         // Conditions to check
        //         const markdownView =
        //             this.app.workspace.getActiveViewOfType(MarkdownView);
        //         if (markdownView) {
        //             // If checking is true, we're simply "checking" if the command can be run.
        //             // If checking is false, then we want to actually perform the operation.
        //             if (!checking) {
        //                 new SampleModal(this.app).open();
        //             }
        //
        //             // This command will only show up in Command Palette when the check function returns true
        //             return true;
        //         }
        //     },
        // });

        // // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
        // // Using this function will automatically remove the event listener when this plugin is disabled.
        // this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
        //     console.log('click', evt);
        // });
        //
    }

    onunload() {}

    private async activateChatView() {
        // Don't create a new chat if enabled in settings and chat available
        if (!this.settings.behaviourConfiguration.createNewChatOnRibbonClick) {
            const existingLeaf =
                this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0];

            if (existingLeaf) {
                await this.app.workspace.revealLeaf(existingLeaf);
                return;
            }
        }

        // Create new chat
        const leaf = this.app.workspace.getRightLeaf(false);

        if (!leaf) {
            return;
        }

        await leaf.setViewState({
            type: VIEW_TYPE_CHAT,
            active: true,
            state: {
                chatId: generateUUID(),
                messages: [],
            },
        });

        await this.app.workspace.revealLeaf(leaf);
    }

    @tryCatchInNotice('Error querying Knowledge Base')
    async query(props: { text: string; chatId: string }) {
        const { text, chatId } = props;
        const response = await this.knowledgeBase.query({ text, chatId });
        return response.text;
    }

    @tryCatchInNotice('Error syncing Knowledge Base')
    async sync(props?: SyncProps) {
        // TODO: implement props allVault
        console.log('Syncing Knowledge Base');
        const { syncId } = await this.knowledgeBase.startSync({
            changedFiles: this.fileChangesTracker.getChangedFiles(),
            deletedFiles: this.fileChangesTracker.getDeletePaths(),
        });
        this.fileChangesTracker.reset();
        console.log(`Start syncing Knowledge Base: ${syncId}`);
    }

    @tryCatchInNotice('Error deleting Knowledge Base')
    async deleteAllData() {
        // TODO
    }

    private async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private createKnowledgeBase() {
        this.knowledgeBase = knowledgeBaseFactory(this.settings);
    }
}
