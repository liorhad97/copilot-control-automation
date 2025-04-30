import * as vscode from 'vscode';

/**
 * Service for Git-related operations
 */
export class GitService {
    private static instance: GitService;

    private constructor() {}

    /**
     * Get the singleton instance of GitService
     */
    public static getInstance(): GitService {
        if (!GitService.instance) {
            GitService.instance = new GitService();
        }
        return GitService.instance;
    }

    /**
     * Create and checkout a new branch
     * @param prefix Optional prefix for the branch name
     * @returns Promise resolving to true if branch was created and checked out successfully
     */
    public async createAndCheckoutBranch(prefix = 'feature/marco'): Promise<boolean> {
        try {
            const gitExtension = vscode.extensions.getExtension<any>('vscode.git');

            if (!gitExtension) {
                vscode.window.showWarningMessage('Git extension not found or not activated');
                return false;
            }

            const git = gitExtension.exports.getAPI(1);

            if (git.repositories.length === 0) {
                vscode.window.showWarningMessage('No Git repositories found in the workspace');
                return false;
            }

            const repo = git.repositories[0];
            const branchName = `${prefix}-${Date.now()}`;

            await repo.createBranch(branchName, true);
            vscode.window.showInformationMessage(`Created and checked out branch: ${branchName}`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create branch: ${error}`);
            return false;
        }
    }

    /**
     * Check if the current workspace is a Git repository
     * @returns Promise resolving to true if the workspace is a Git repository
     */
    public async isGitRepository(): Promise<boolean> {
        try {
            const gitExtension = vscode.extensions.getExtension<any>('vscode.git');

            if (!gitExtension) {
                return false;
            }

            const git = gitExtension.exports.getAPI(1);
            return git.repositories.length > 0;
        } catch (error) {
            console.error('Error checking Git repository:', error);
            return false;
        }
    }

    /**
     * Get the current branch name
     * @returns Promise resolving to the current branch name or null if not available
     */
    public async getCurrentBranchName(): Promise<string | null> {
        try {
            const gitExtension = vscode.extensions.getExtension<any>('vscode.git');

            if (!gitExtension) {
                return null;
            }

            const git = gitExtension.exports.getAPI(1);
            
            if (git.repositories.length === 0) {
                return null;
            }

            const repo = git.repositories[0];
            return repo.state.HEAD?.name || null;
        } catch (error) {
            console.error('Error getting current branch name:', error);
            return null;
        }
    }
}