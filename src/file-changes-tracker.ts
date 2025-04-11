import { Vault, TFile } from 'obsidian';

export class FileChangesTracker {
    private changedFiles: Set<TFile> = new Set();
    private deletePaths: Set<string> = new Set();

    constructor(private vault: Vault) {
        this.registerEventListeners();
    }

    private registerEventListeners() {
        this.vault.on('create', (file: TFile) => {
            // console.log('create', file);

            this.changedFiles.add(file);
        });

        this.vault.on('modify', (file: TFile) => {
            // console.log('modify', file);

            this.changedFiles.add(file);
        });

        this.vault.on('rename', (file: TFile, oldPath: string) => {
            // console.log('rename', file, oldPath);

            this.changedFiles.add(file);

            // Check the edge case where a file is deleted, and then another one renamed to the same name before the delete event is processed
            if (this.deletePaths.has(file.path)) {
                this.deletePaths.delete(file.path);
                return;
            }

            this.deletePaths.add(oldPath);
        });

        this.vault.on('delete', (file: TFile) => {
            // console.log('delete', file);

            this.deletePaths.add(file.path);
        });
    }

    getChangedFiles(): TFile[] {
        return Array.from(this.changedFiles);
    }

    getDeletePaths(): string[] {
        return Array.from(this.deletePaths);
    }

    resetChangedNotes() {
        this.changedFiles.clear();
    }
}
