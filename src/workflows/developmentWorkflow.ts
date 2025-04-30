import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { PromptService } from '../services/promptService';
import { logWithTimestamp } from '../utils';

/**
 * Execute the main development workflow
 * - Send development checklist
 * - Check agent status
 * - Request tests if configured
 * - Verify completion of all tasks
 * 
 * @param ctx The extension context
 */
export async function developmentWorkflow(ctx: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    const promptService = PromptService.getInstance();
    const config = vscode.workspace.getConfiguration('marco');

    logWithTimestamp('Starting development workflow');
    
    try {
        // Step 1: Send development checklist
        await sendDevelopmentChecklist(promptService, statusManager);

        // Step 2: Check agent status
        await checkAgentStatus(promptService, statusManager);

        // Step 3: Handle test writing if needed
        if (config.get<boolean>('needToWriteTest')) {
            await handleTestWriting(promptService, statusManager);
        }

        // Step 4: Verify task completion
        await verifyCompletion(promptService, statusManager);

        // Step 5: Check if we need to continue with another iteration
        const continueWorkflow = await checkForContinuation(promptService);
        if (continueWorkflow) {
            await continueToNextIteration(promptService, statusManager);
        } else {
            finishWorkflow(statusManager);
        }
    } catch (error) {
        handleError(error, statusManager);
    }
}

/**
 * Send the development checklist to the agent
 */
async function sendDevelopmentChecklist(promptService: PromptService, statusManager: StatusManager): Promise<void> {
    statusManager.setState(WorkflowState.SendingTask, "Sending development checklist");
    logWithTimestamp('Sending development checklist');
    
    await promptService.sendMessage('Here is the development checklist for this feature:');
    await promptService.sendPromptFileToChat('checklist');
    
    // Give the agent time to process
    await new Promise(resolve => setTimeout(resolve, 2000));
}

/**
 * Check the current status of the agent
 */
async function checkAgentStatus(promptService: PromptService, statusManager: StatusManager): Promise<void> {
    statusManager.setState(WorkflowState.CheckingStatus, "Checking agent status");
    logWithTimestamp('Checking agent status');
    
    await promptService.sendPromptFileToChat('check_agent');
}

/**
 * Handle test writing steps
 */
async function handleTestWriting(promptService: PromptService, statusManager: StatusManager): Promise<void> {
    statusManager.setState(WorkflowState.RequestingTests, "Requesting test implementation");
    logWithTimestamp('Requesting test implementation');
    
    await promptService.sendMessage('Please write tests for this feature.');
    await promptService.sendPromptFileToChat('test_instructions');
    
    // Check status after test request
    statusManager.setState(WorkflowState.CheckingStatus, "Checking test progress");
    logWithTimestamp('Checking test progress');
    await promptService.sendPromptFileToChat('test_progress');
}

/**
 * Verify completion of all tasks
 */
async function verifyCompletion(promptService: PromptService, statusManager: StatusManager): Promise<void> {
    statusManager.setState(WorkflowState.VerifyingCompletion, "Verifying task completion");
    logWithTimestamp('Verifying task completion');
    
    await promptService.sendMessage('Please verify all items in the checklist are complete:');
    await promptService.sendPromptFileToChat('verify_completion');
}

/**
 * Check if we should continue to the next iteration
 */
async function checkForContinuation(promptService: PromptService): Promise<boolean> {
    logWithTimestamp('Checking if workflow should continue');
    
    await promptService.sendMessage('Have you completed implementing all the features described in the checklist?');
    
    // In a real implementation, we would analyze the agent's response
    // For now, we'll assume the workflow is complete (false = don't continue)
    return false;
}

/**
 * Continue to the next iteration of the workflow
 */
async function continueToNextIteration(promptService: PromptService, statusManager: StatusManager): Promise<void> {
    statusManager.setState(WorkflowState.ContinuingIteration, "Continuing to next iteration");
    logWithTimestamp('Continuing to next iteration');
    
    await promptService.sendPromptFileToChat('continue_iteration');
    // Could recursively call developmentWorkflow here if needed
}

/**
 * Mark the workflow as completed
 */
function finishWorkflow(statusManager: StatusManager): void {
    statusManager.setState(WorkflowState.Completed, "Workflow completed successfully");
    logWithTimestamp('Workflow completed successfully');
    vscode.window.showInformationMessage('Marco AI workflow completed successfully!');
}

/**
 * Handle errors in the development workflow
 */
function handleError(error: unknown, statusManager: StatusManager): void {
    statusManager.setState(WorkflowState.Error, "Development workflow failed");
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithTimestamp(`Development workflow failed: ${errorMessage}`, 'error');
    vscode.window.showErrorMessage(`Development workflow failed: ${errorMessage}`);
}