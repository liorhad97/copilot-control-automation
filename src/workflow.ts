import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from './statusManager';
import { getWorkspaceRoot } from './utils';
import { ensureChatOpen, sendChatMessage } from './utils/chatUtils';

export async function runWorkflow(ctx: vscode.ExtensionContext, action: string) {
    const statusManager = StatusManager.getInstance();

    switch (action) {
        case 'play':
            statusManager.setState(WorkflowState.Initializing, "Starting workflow");
            await initialSetup(ctx);
            await developmentWorkflow(ctx);
            break;
        case 'pause':
            statusManager.setState(WorkflowState.Paused, "Workflow paused");
            await vscode.window.showInformationMessage('Marco AI workflow paused');
            break;
        case 'stop':
            statusManager.setState(WorkflowState.Idle, "Workflow stopped");
            await vscode.window.showInformationMessage('Marco AI workflow stopped');
            break;
        case 'restart':
            await restartWorkflow(ctx);
            break;
    }
}

// Function to handle restarting the workflow
async function restartWorkflow(ctx: vscode.ExtensionContext) {
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Initializing, "Restarting workflow");

    vscode.window.showInformationMessage('Restarting Marco AI workflow...');

    try {
        await ensureChatOpen();
        await sendChatMessage('Marco AI workflow has been restarted. Starting fresh...');
        await initialSetup(ctx);
        await developmentWorkflow(ctx);
    } catch (error) {
        statusManager.setState(WorkflowState.Error, "Failed to restart workflow");
        vscode.window.showErrorMessage(`Failed to restart workflow: ${error}`);
    }
}

async function initialSetup(ctx: vscode.ExtensionContext) {
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Initializing, "Setting up environment");

    vscode.window.showInformationMessage('Initializing Marco AI workflow');

    try {
        await ensureChatOpen();
        statusManager.setState(WorkflowState.SendingTask, "Sending initial instructions");
        await sendChatMessage('Starting Marco AI automation process. I will help automate your workflow.');

        const config = vscode.workspace.getConfiguration('marco');
        if (config.get<boolean>('initCreateBranch')) {
            statusManager.setState(WorkflowState.CreatingBranch, "Creating new branch");
            await createAndCheckoutBranch();
            await sendChatMessage('Created new branch for this feature. Please click Continue when ready.');
        }
    } catch (error) {
        statusManager.setState(WorkflowState.Error, "Setup failed");
        throw error;
    }
}

async function developmentWorkflow(ctx: vscode.ExtensionContext) {
    const statusManager = StatusManager.getInstance();
    const config = vscode.workspace.getConfiguration('marco');

    try {
        statusManager.setState(WorkflowState.SendingTask, "Sending development checklist");
        await sendChatMessage('Here is the development checklist for this feature:');
        await sendPromptFileToChat('checklist.md');

        if (config.get<boolean>('needToWriteTest')) {
            statusManager.setState(WorkflowState.RequestingTests, "Requesting test implementation");
            await sendChatMessage('Please write tests for this feature.');
            await sendPromptFileToChat('test_instructions.md');
            await sendPromptFileToChat('verify_completion.md');
        }

        statusManager.setState(WorkflowState.VerifyingCompletion, "Verifying task completion");
        await sendChatMessage('Please verify all items in the checklist are complete:');
        await sendPromptFileToChat('verify_completion.md');

        statusManager.setState(WorkflowState.Completed, "Workflow completed successfully");
    } catch (error) {
        statusManager.setState(WorkflowState.Error, "Development workflow failed");
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Development workflow failed: ${errorMessage}`);
    }
}

// Helper function to read prompt files
async function readPromptFile(fileName: string): Promise<string> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        throw new Error("Workspace root not found.");
    }
    const filePath = path.join(workspaceRoot, 'src', 'prompts', fileName);
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return content;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to read prompt file: ${fileName}`);
        console.error(`Error reading prompt file ${filePath}:`, error);
        throw error;
    }
}

// Helper function to send prompt file content to chat
async function sendPromptFileToChat(fileName: string) {
    try {
        const content = await readPromptFile(fileName);
        await sendChatMessage(content);
    } catch (error) {
        console.error(`Failed to send prompt file ${fileName} to chat.`);
    }
}

async function createAndCheckoutBranch() {
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

/**
 * Check if the agent is idle based on time since last activity and current state
 * @returns True if the agent appears to be idle, false otherwise
 */
export function isAgentIdle(): boolean {
    const statusManager = StatusManager.getInstance();
    const currentState = statusManager.getState();

    if (currentState === WorkflowState.Idle ||
        currentState === WorkflowState.Paused ||
        currentState === WorkflowState.Error ||
        currentState === WorkflowState.Completed) {
        return false;
    }

    const lastActivityTime = statusManager.getLastUpdateTime();
    if (!lastActivityTime) {
        return false;
    }

    const config = vscode.workspace.getConfiguration('marco');
    const idleTimeoutMs = config.get<number>('idleTimeoutSeconds', 30) * 1000;

    const timeSinceLastActivity = Date.now() - lastActivityTime.getTime();
    return timeSinceLastActivity > idleTimeoutMs;
}

/**
 * Determines if the workflow should continue to the next iteration
 * @returns True if the workflow should continue, false otherwise
 */
async function shouldContinueToNextIteration(): Promise<boolean> {
    const statusManager = StatusManager.getInstance();
    const currentState = statusManager.getState();

    if (currentState === WorkflowState.Idle ||
        currentState === WorkflowState.Paused ||
        currentState === WorkflowState.Error ||
        currentState === WorkflowState.Completed) {
        return false;
    }

    const checklistCompleted = await verifyChecklistCompletion();
    if (!checklistCompleted) {
        return true;
    }

    const response = await promptAgentForCompletion();
    if (response && typeof response === 'string') {
        const needsToContinue = response.toLowerCase().includes('not complete') ||
            response.toLowerCase().includes('still working') ||
            response.toLowerCase().includes('in progress');

        return needsToContinue;
    }

    return false;
}

/**
 * Verifies if all items in the checklist are completed
 * @returns Promise resolving to true if all items are completed, false otherwise
 */
async function verifyChecklistCompletion(): Promise<boolean> {
    await sendPromptFileToChat('check_checklist.md');
    return false;
}

/**
 * Prompts the agent to report on task completion status
 * @returns Promise resolving to the agent's response or null if unavailable
 */
async function promptAgentForCompletion(): Promise<string | null> {
    const success = await sendChatMessage("Have you completed implementing all the features described in the checklist?");

    if (!success) {
        console.error("Failed to send completion prompt to agent.");
        return null;
    }

    return null;
}