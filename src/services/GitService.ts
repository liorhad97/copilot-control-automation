import * as vscode from 'vscode';
import { GitOperationError } from '../errors/WorkflowErrors';

/**
 * Service for interacting with Git repositories
 */
export class GitService {
  /**
   * Creates and checks out a new branch
   * @param branchNamePrefix Prefix for the branch name (default is 'feature/')
   * @returns Promise resolving to the name of the created branch
   * @throws GitOperationError if the operation fails
   */
  public static async createAndCheckoutBranch(branchNamePrefix = 'feature/'): Promise<string> {
    try {
      const gitExtension = vscode.extensions.getExtension<any>('vscode.git');

      if (!gitExtension) {
        this.showWarning('Git extension not found or not activated');
        throw new GitOperationError('Git extension not found');
      }

      const git = gitExtension.exports.getAPI(1);

      if (!git.repositories || git.repositories.length === 0) {
        this.showWarning('No Git repositories found in the workspace');
        throw new GitOperationError('No Git repositories found');
      }

      const repo = git.repositories[0];
      const timestamp = Date.now();
      const branchName = `${branchNamePrefix}marco-${timestamp}`;

      await repo.createBranch(branchName, true);
      this.showInfo(`Created and checked out branch: ${branchName}`);
      return branchName;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.showError(`Failed to create branch: ${errorMessage}`);
      throw new GitOperationError(`Failed to create branch: ${errorMessage}`);
    }
  }

  /**
   * Commits changes to the current branch
   * @param message Commit message
   * @returns Promise resolving to true if successful
   * @throws GitOperationError if the operation fails
   */
  public static async commitChanges(message: string): Promise<boolean> {
    try {
      const gitExtension = vscode.extensions.getExtension<any>('vscode.git');

      if (!gitExtension) {
        this.showWarning('Git extension not found or not activated');
        throw new GitOperationError('Git extension not found');
      }

      const git = gitExtension.exports.getAPI(1);

      if (!git.repositories || git.repositories.length === 0) {
        this.showWarning('No Git repositories found in the workspace');
        throw new GitOperationError('No Git repositories found');
      }

      const repo = git.repositories[0];

      // Stage all changes
      await repo.add(["."]);  // Stage all changes

      // Create the commit
      await repo.commit(message);
      
      this.showInfo(`Committed changes: ${message}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.showError(`Failed to commit changes: ${errorMessage}`);
      throw new GitOperationError(`Failed to commit changes: ${errorMessage}`);
    }
  }

  /**
   * Gets the name of the current branch
   * @returns Promise resolving to the current branch name
   * @throws GitOperationError if the operation fails
   */
  public static async getCurrentBranch(): Promise<string> {
    try {
      const gitExtension = vscode.extensions.getExtension<any>('vscode.git');

      if (!gitExtension) {
        throw new GitOperationError('Git extension not found');
      }

      const git = gitExtension.exports.getAPI(1);

      if (!git.repositories || git.repositories.length === 0) {
        throw new GitOperationError('No Git repositories found');
      }

      const repo = git.repositories[0];
      const currentBranch = repo.state.HEAD?.name;

      if (!currentBranch) {
        throw new GitOperationError('Failed to get current branch name');
      }

      return currentBranch;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.showError(`Failed to get current branch: ${errorMessage}`);
      throw new GitOperationError(`Failed to get current branch: ${errorMessage}`);
    }
  }

  /**
   * Shows an information message
   */
  private static showInfo(message: string): void {
    vscode.window.showInformationMessage(`Git: ${message}`);
  }

  /**
   * Shows a warning message
   */
  private static showWarning(message: string): void {
    vscode.window.showWarningMessage(`Git: ${message}`);
  }

  /**
   * Shows an error message
   */
  private static showError(message: string): void {
    vscode.window.showErrorMessage(`Git: ${message}`);
  }
}