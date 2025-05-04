import * as vscode from 'vscode';

/**
 * Creates and checks out a new branch
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function createAndCheckoutBranch(): Promise<boolean> {
    try {
        const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
        if (gitExtension) {
            const git = gitExtension.exports.getAPI(1);
            if (git.repositories.length > 0) {
                const repo = git.repositories[0];
                const branchName = `feature/marco-${Date.now()}`;
                await repo.createBranch(branchName, true);
                vscode.window.showInformationMessage(`Created and checked out branch: ${branchName}`);
                return true;
            } else {
                vscode.window.showWarningMessage('No Git repositories found in the workspace');
            }
        } else {
            vscode.window.showWarningMessage('Git extension not found or not activated');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create branch: ${error}`);
    }
    return false;
}
