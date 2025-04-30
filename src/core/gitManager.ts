import * as vscode from 'vscode';

/**
 * Manages Git operations for the workflow
 */
export class GitManager {
    private static instance: GitManager;

    private constructor() {}

    /**
     * Get the singleton instance of GitManager
     */
    public static getInstance(): GitManager {
        if (!GitManager.instance) {
            GitManager.instance = new GitManager();
        }
        return GitManager.instance;
    }

    /**
     * Creates and checks out a new Git branch
     * @returns The name of the created branch or null if failed
     */
    public async createAndCheckoutBranch(): Promise<string | null> {
        try {
            // Try to get the Git extension
            const gitExtension = vscode.extensions.getExtension<any>('vscode.git');

            if (gitExtension) {
                const git = gitExtension.exports.getAPI(1);

                if (git.repositories.length > 0) {
                    const repo = git.repositories[0];
                    // Generate branch name with timestamp
                    const branchName = `feature/marco-${Date.now()}`;

                    // Create and checkout the branch
                    await repo.createBranch(branchName, true);
                    vscode.window.showInformationMessage(`Created and checked out branch: ${branchName}`);
                    return branchName;
                } else {
                    vscode.window.showWarningMessage('No Git repositories found in the workspace');
                }
            } else {
                vscode.window.showWarningMessage('Git extension not found or not activated');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create branch: ${error}`);
        }

        return null;
    }

    /**
     * Gets the current branch name
     * @returns The current branch name or null if not in a Git repository
     */
    public async getCurrentBranch(): Promise<string | null> {
        try {
            const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
            
            if (gitExtension) {
                const git = gitExtension.exports.getAPI(1);
                
                if (git.repositories.length > 0) {
                    const repo = git.repositories[0];
                    return repo.state.HEAD?.name || null;
                }
            }
        } catch (error) {
            console.error('Error getting current branch:', error);
        }
        
        return null;
    }

    /**
     * Commits current changes with a message
     * @param message Commit message
     * @returns Whether the commit was successful
     */
    public async commitChanges(message: string): Promise<boolean> {
        try {
            const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
            
            if (gitExtension) {
                const git = gitExtension.exports.getAPI(1);
                
                if (git.repositories.length > 0) {
                    const repo = git.repositories[0];
                    await repo.commit(message);
                    return true;
                }
            }
        } catch (error) {
            console.error('Error committing changes:', error);
        }
        
        return false;
    }
}