import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { PromptService } from '../services/promptService';

/**
 * Handle the main development workflow
 * @param ctx The extension context
 */
export async function developmentWorkflow(ctx: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    const promptService = PromptService.getInstance();
    const config = vscode.workspace.getConfiguration('marco');

    try {
        // Send development checklist
        statusManager.setState(WorkflowState.SendingTask, "Sending development checklist");
        await promptService.sendMessage('Here is the development checklist for this feature:');
        await promptService.sendPromptFileToChat('checklist');

        // Wait for agent to start working
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check agent status
        statusManager.setState(WorkflowState.CheckingStatus, "Checking agent status");
        await promptService.sendPromptFileToChat('check_agent');

        // Handle test writing if needed
        if (config.get<boolean>('needToWriteTest')) {
            statusManager.setState(WorkflowState.RequestingTests, "Requesting test implementation");
            await promptService.sendMessage('Please write tests for this feature.');
            await promptService.sendPromptFileToChat('test_instructions');
            
            // Check status again after test request
            statusManager.setState(WorkflowState.CheckingStatus, "Checking test progress");
            await promptService.sendPromptFileToChat('test_progress');
        }

        // Verify completion
        statusManager.setState(WorkflowState.VerifyingCompletion, "Verifying task completion");
        await promptService.sendMessage('Please verify all items in the checklist are complete:');
        await promptService.sendPromptFileToChat('verify_completion');

        // Check if we need another iteration
        const continueWorkflow = await promptAgentForCompletion();
        if (continueWorkflow) {
            statusManager.setState(WorkflowState.ContinuingIteration, "Continuing to next iteration");
            await promptService.sendPromptFileToChat('continue_iteration');
            // Could recursively call developmentWorkflow here if needed
        } else {
            statusManager.setState(WorkflowState.Completed, "Workflow completed successfully");
            vscode.window.showInformationMessage('Marco AI workflow completed successfully!');
        }
    } catch (error) {
        statusManager.setState(WorkflowState.Error, "Development workflow failed");
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Development workflow failed: ${errorMessage}`);
    }
}

/**
 * Prompts the agent to report on task completion status
 * @returns Promise resolving to true if workflow should continue, false if completed
 */
async function promptAgentForCompletion(): Promise<boolean> {
    const promptService = PromptService.getInstance();
    
    await promptService.sendMessage("Have you completed implementing all the features described in the checklist?");
    
    // In a real implementation, we would analyze the agent's response
    // For now, we'll assume the workflow is complete (false = don't continue)
    return false;
}