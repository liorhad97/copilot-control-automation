import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { PromptService } from '../services/promptService';
import { GitService } from '../services/gitService';
import { ModelService, AIModel } from '../services/modelService';
import { ensureChatOpen } from '../utils/chatUtils';
import { logWithTimestamp } from '../utils';

/**
 * Handle the initial setup phase of the workflow
 * - Opens chat
 * - Selects preferred AI model
 * - Sends initial instructions
 * - Creates branch if configured
 * 
 * @param ctx The extension context
 */
export async function initialSetup(ctx: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    const promptService = PromptService.getInstance();
    const gitService = GitService.getInstance();
    const modelService = ModelService.getInstance();
    
    logWithTimestamp('Starting initial setup phase');
    statusManager.setState(WorkflowState.Initializing, "Setting up environment");
    vscode.window.showInformationMessage('Initializing Marco AI workflow');

    try {
        // Step 1: Ensure chat is open
        await openChatPanel();
        
        // Step 2: Select preferred AI model
        await selectPreferredModel(modelService);
        
        // Step 3: Send initial instructions
        await sendInitialInstructions(promptService, statusManager);

        // Step 4: Create branch if needed
        await handleBranchCreation(gitService, promptService);
        
        logWithTimestamp('Initial setup phase completed successfully');
    } catch (error) {
        statusManager.setState(WorkflowState.Error, "Setup failed");
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Initial setup failed: ${errorMessage}`);
        logWithTimestamp(`Initial setup failed: ${errorMessage}`, 'error');
        throw error;
    }
}

/**
 * Open the chat panel and ensure it's visible
 */
async function openChatPanel(): Promise<void> {
    logWithTimestamp('Opening chat panel');
    const success = await ensureChatOpen();
    
    if (!success) {
        throw new Error('Failed to open chat panel');
    }
    
    // Give the chat panel time to stabilize
    await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Select the preferred AI model based on priority
 */
async function selectPreferredModel(modelService: ModelService): Promise<void> {
    logWithTimestamp('Selecting preferred AI model');
    const selectedModel = await modelService.selectPreferredModel();
    
    if (selectedModel) {
        logWithTimestamp(`Selected AI model: ${selectedModel}`);
    } else {
        logWithTimestamp('Could not select preferred AI model, using default', 'warn');
    }
}

/**
 * Send initial instructions to the chat
 */
async function sendInitialInstructions(promptService: PromptService, statusManager: StatusManager): Promise<void> {
    statusManager.setState(WorkflowState.SendingTask, "Sending initial instructions");
    logWithTimestamp('Sending initial instructions');
    
    await promptService.sendMessage('Starting Marco AI automation process. I will help automate your workflow.');
    await promptService.sendPromptFileToChat('init');
}

/**
 * Handle branch creation if configured
 */
async function handleBranchCreation(gitService: GitService, promptService: PromptService): Promise<void> {
    const config = vscode.workspace.getConfiguration('marco');
    
    if (!config.get<boolean>('initCreateBranch')) {
        logWithTimestamp('Branch creation not configured, skipping');
        return;
    }
    
    logWithTimestamp('Creating new branch');
    const success = await gitService.createAndCheckoutBranch();
    
    if (success) {
        const branchName = await gitService.getCurrentBranchName();
        await promptService.sendMessage(`Created new branch: ${branchName}. Please click Continue when ready.`);
        logWithTimestamp(`Created new branch: ${branchName}`);
    } else {
        await promptService.sendMessage('Failed to create a new branch. Continuing with current branch.');
        logWithTimestamp('Failed to create branch, continuing with current branch', 'warn');
    }
}