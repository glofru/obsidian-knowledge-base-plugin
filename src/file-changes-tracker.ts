import { Vault, TFile, TAbstractFile } from 'obsidian';

export class FileChangesTracker {
    private changedFiles: Set<TFile> = new Set();
    private deletePaths: Set<string> = new Set();

    constructor(private vault: Vault) {
        this.registerEventListeners();
    }

    private registerEventListeners() {
        this.vault.on('create', (file: TAbstractFile) => {
            // console.log('create', file);

            if (!(file instanceof TFile)) {
                return;
            }

            this.changedFiles.add(file);
        });

        this.vault.on('modify', (file: TAbstractFile) => {
            // console.log('modify', file);

            if (!(file instanceof TFile)) {
                return;
            }

            this.changedFiles.add(file);
        });

        this.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
            // console.log('rename', file, oldPath);

            if (!(file instanceof TFile)) {
                return;
            }

            this.changedFiles.add(file);

            // Check the edge case where a file is deleted, and then another one renamed to the same name before the delete event is processed
            if (this.deletePaths.has(file.path)) {
                this.deletePaths.delete(file.path);
                return;
            }

            this.deletePaths.add(oldPath);
        });

        this.vault.on('delete', (file: TAbstractFile) => {
            // console.log('delete', file);

            if (!(file instanceof TFile)) {
                return;
            }

            this.deletePaths.add(file.path);
        });
    }

    getChangedFiles(): TFile[] {
        return Array.from(this.changedFiles);
    }

    getDeletePaths(): string[] {
        return Array.from(this.deletePaths);
    }

    reset() {
        this.changedFiles.clear();
        this.deletePaths.clear();
    }
}
