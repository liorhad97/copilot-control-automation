import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { PromptService } from '../services/promptService';
import { GitService } from '../services/gitService';
import { ensureChatOpen } from '../utils/chatUtils';

/**
 * Handle the initial setup phase of the workflow
 * @param ctx The extension context
 */
export async function initialSetup(ctx: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    const promptService = PromptService.getInstance();
    const gitService = GitService.getInstance();
    
    statusManager.setState(WorkflowState.Initializing, "Setting up environment");
    vscode.window.showInformationMessage('Initializing Marco AI workflow');

    try {
        // Ensure chat is open
        await ensureChatOpen();
        
        // Send initial instructions
        statusManager.setState(WorkflowState.SendingTask, "Sending initial instructions");
        await promptService.sendMessage('Starting Marco AI automation process. I will help automate your workflow.');
        await promptService.sendPromptFileToChat('init');

        // Create branch if needed
        const config = vscode.workspace.getConfiguration('marco');
        if (config.get<boolean>('initCreateBranch')) {
            statusManager.setState(WorkflowState.CreatingBranch, "Creating new branch");
            const success = await gitService.createAndCheckoutBranch();
            
            if (success) {
                const branchName = await gitService.getCurrentBranchName();
                await promptService.sendMessage(`Created new branch: ${branchName}. Please click Continue when ready.`);
            } else {
                await promptService.sendMessage('Failed to create a new branch. Continuing with current branch.');
            }
        }
    } catch (error) {
        statusManager.setState(WorkflowState.Error, "Setup failed");
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Initial setup failed: ${errorMessage}`);
        throw error;
    }
}