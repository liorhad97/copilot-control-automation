import * as vscode from 'vscode';
import { PromptManager } from './core/promptManager';
import { StatusManager, WorkflowState } from './statusManager';
import { ensureChatOpen, sendChatMessage } from './utils';

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

    // Try to ensure chat is open
    try {
        await ensureChatOpen();

        // Send restart message to chat using the new function
        await sendChatMessage('Marco AI workflow has been restarted. Starting fresh...');

        // Re-run the initial setup
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
        // Open chat using our enhanced method
        await ensureChatOpen();

        // 1) Send initial instructions using the new function
        statusManager.setState(WorkflowState.SendingTask, "Sending initial instructions");
        await sendChatMessage('Starting Marco AI automation process. I will help automate your workflow.');

        // 2) Branch creation if configured
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
        // Read checklist
        statusManager.setState(WorkflowState.SendingTask, "Sending development checklist");
        await sendChatMessage('Here is the development checklist for this feature:');
        await sendChecklistToChat();

        // Write tests if configured
        if (config.get<boolean>('needToWriteTest')) {
            statusManager.setState(WorkflowState.RequestingTests, "Requesting test implementation");
            await sendChatMessage('Please write tests for this feature.');
            await sendTestInstructionsToChat();
            await sendChecklistToChat();
        }

        // Verify completion
        statusManager.setState(WorkflowState.VerifyingCompletion, "Verifying task completion");
        await sendChatMessage('Please verify all items in the checklist are complete:');
        await sendVerificationToChat();

        // Mark workflow as completed
        statusManager.setState(WorkflowState.Completed, "Workflow completed successfully");
    } catch (error) {
        statusManager.setState(WorkflowState.Error, "Development workflow failed");
        throw error;
    }
}

async function sendChecklistToChat() {
    const checklist = [
        "- [ ] Feature requirements understood",
        "- [ ] Code structure planned",
        "- [ ] Implementation complete",
        "- [ ] Documentation added",
        "- [ ] Code refactored and optimized"
    ].join('\n');

    await sendChatMessage(checklist);
}

async function sendTestInstructionsToChat() {
    const testInstructions = [
        "Please write tests for the following:",
        "1. Unit tests for core functionality",
        "2. Integration tests if applicable",
        "3. Edge case handling"
    ].join('\n');

    await sendChatMessage(testInstructions);
}

async function sendVerificationToChat() {
    const verification = [
        "Please verify:",
        "1. All checklist items are complete",
        "2. Tests are passing (if applicable)",
        "3. No regression issues",
        "4. Ready for review"
    ].join('\n');

    await sendChatMessage(verification);
}

async function createAndCheckoutBranch() {
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
    const currentState = statusManager.getCurrentState();

    // If we're already in a terminal state, the agent isn't considered idle
    if (currentState === WorkflowState.Idle ||
        currentState === WorkflowState.Paused ||
        currentState === WorkflowState.Error ||
        currentState === WorkflowState.Completed) {
        return false;
    }

    // Check the time since the last activity
    const lastActivityTime = statusManager.getLastActivityTime();
    if (!lastActivityTime) {
        return false; // No activity recorded yet
    }

    const config = vscode.workspace.getConfiguration('marco');
    const idleTimeoutMs = config.get<number>('idleTimeoutSeconds', 30) * 1000;

    // Consider agent idle if no activity for the configured timeout period
    const timeSinceLastActivity = Date.now() - lastActivityTime.getTime();
    return timeSinceLastActivity > idleTimeoutMs;
}

/**
 * Determines if the workflow should continue to the next iteration
 * @returns True if the workflow should continue, false otherwise
 */
async function shouldContinueToNextIteration(): Promise<boolean> {
    const statusManager = StatusManager.getInstance();
    const currentState = statusManager.getCurrentState();

    // Don't continue if we're in a terminal or error state
    if (currentState === WorkflowState.Idle ||
        currentState === WorkflowState.Paused ||
        currentState === WorkflowState.Error ||
        currentState === WorkflowState.Completed) {
        return false;
    }

    // Check if all checklist items are completed
    const checklistCompleted = await verifyChecklistCompletion();
    if (!checklistCompleted) {
        // If checklist is not complete, continue to the next iteration
        return true;
    }

    // Ask the agent directly if it has completed the current task
    const response = await promptAgentForCompletion();
    if (response && typeof response === 'string') {
        // Look for indicators that the task is not yet complete
        const needsToContinue = response.toLowerCase().includes('not complete') ||
            response.toLowerCase().includes('still working') ||
            response.toLowerCase().includes('in progress');

        return needsToContinue;
    }

    // Default behavior: don't continue if we can't determine status
    return false;
}

/**
 * Verifies if all items in the checklist are completed
 * @returns Promise resolving to true if all items are completed, false otherwise
 */
async function verifyChecklistCompletion(): Promise<boolean> {
    // Send the checklist verification prompt
    await sendFileToChat('CHECK_CHECKLIST.md');

    // This would ideally analyze the agent's response
    // For now, we're using a placeholder that assumes not all items are complete
    return false; // Placeholder implementation
}

/**
 * Prompts the agent to report on task completion status
 * @returns Promise resolving to the agent's response or null if unavailable
 */
async function promptAgentForCompletion(): Promise<string | null> {
    await openChat();
    await vscode.commands.executeCommand('github.copilot-chat.sendMessage', {
        message: "Have you completed implementing all the features described in the checklist?"
    });

    // This would ideally capture and return the agent's response
    // For now, we're using a placeholder
    return null; // Placeholder implementation
}

/**
 * Opens the Copilot Chat panel
 * @returns Promise that resolves when chat is open
 */
async function openChat(): Promise<boolean> {
    return ensureChatOpen(5, 1000, true);
}

/**
 * Sends the contents of a prompt file to the Copilot Chat
 * @param filename The name of the prompt file to send
 * @returns Promise that resolves when the file content has been sent
 */
async function sendFileToChat(filename: string): Promise<void> {
    try {
        // Get the prompt manager instance
        const promptManager = PromptManager.getInstance();

        // Get the content of the prompt file
        const content = await promptManager.getPrompt(filename);

        // Ensure chat is open before sending the message
        await openChat();

        // Send the prompt content to the chat
        await sendChatMessage(content);
    } catch (error) {
        console.error(`Error sending file ${filename} to chat:`, error);
        throw error;
    }
}