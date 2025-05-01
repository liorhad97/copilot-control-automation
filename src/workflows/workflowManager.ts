import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
// Updated import paths for utils
import { ensureChatOpen, selectAIModel, sendChatMessage } from '../utils/chatUtils';
import { sleep } from '../utils/helpers';

// Track the workflow state
let isRunning = false;
let isPaused = false;
let currentWorkflowPromise: Promise<void> | null = null;
let backgroundMode = false;
let iterationCount = 0; // Track number of iterations

/**
 * Check if the workflow is currently running
 * @returns True if running, false otherwise
 */
export function isWorkflowRunning(): boolean {
    return isRunning;
}

/**
 * Check if the workflow is currently paused
 * @returns True if paused, false otherwise
 */
export function isWorkflowPaused(): boolean {
    return isPaused;
}

/**
 * Checks if the workflow is running in background mode
 * @returns True if in background mode
 */
export function isBackgroundMode(): boolean {
    return backgroundMode;
}

/**
 * Set the workflow to run in background mode
 * @param enabled Whether background mode should be enabled
 */
export function setBackgroundMode(enabled: boolean): void {
    backgroundMode = enabled;
}

/**
 * Get the current iteration count
 * @returns The number of iterations completed
 */
export function getIterationCount(): number {
    return iterationCount;
}

/**
 * Runs the Marco AI workflow
 * @param context The VS Code extension context
 * @param action The action to perform (play, pause, stop, restart)
 */
export async function runWorkflow(context: vscode.ExtensionContext, action: string): Promise<void> {
    const statusManager = StatusManager.getInstance();

    switch (action) {
        case 'play':
            if (isRunning) {
                return; // Already running
            }

            isRunning = true;
            isPaused = false;
            // Reset iteration count when starting a new workflow
            iterationCount = 0;

            // Get background mode setting
            const config = vscode.workspace.getConfiguration('marco');
            backgroundMode = config.get<boolean>('backgroundMode') || false;

            // Show notification if starting in background mode
            if (backgroundMode) {
                vscode.window.showInformationMessage('Marco AI workflow starting in background mode. The chat will be minimized when possible.');
            }

            // Start the workflow in the background
            currentWorkflowPromise = (async () => {
                try {
                    await initialSetup(context);
                    await developmentWorkflow(context);

                    // Mark as completed
                    statusManager.setState(WorkflowState.Completed, "Workflow completed successfully");
                    isRunning = false;
                } catch (error) {
                    if (error instanceof WorkflowCancelledError) {
                        // This is expected when workflow is stopped
                        statusManager.setState(WorkflowState.Idle, "Workflow stopped");
                    } else {
                        console.error('Workflow error:', error);
                        statusManager.setState(WorkflowState.Error, `Workflow failed: ${error}`);
                    }
                    isRunning = false;
                    isPaused = false;
                }
            })();

            break;

        case 'restart':
            // Stop any current workflow
            await stopWorkflow();

            // Wait a moment before restarting
            await sleep(500);

            // Start from the beginning
            await runWorkflow(context, 'play');
            break;

        case 'continue':
            // Continue the development workflow with another iteration
            if (!isRunning) {
                // If workflow isn't running, start it
                await runWorkflow(context, 'play');
            } else if (isPaused) {
                // If paused, resume it
                resumeWorkflow(context);
            } else {
                // Continue with next iteration
                await continueDevelopment(context);
            }
            break;
    }
}

/**
 * Continue the development workflow with another iteration
 * @param context The VS Code extension context
 */
export async function continueDevelopment(context: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();

    try {
        // Check for cancellation
        await checkContinue();

        // Increment the iteration count
        iterationCount++;

        // Update status
        statusManager.setState(WorkflowState.SendingTask, `Starting iteration #${iterationCount}`);

        // Load the continue iteration prompt
        const continuePrompt = await loadPromptFile(context, 'continue_iteration');

        // Send the continue prompt
        await sendChatMessage(`@agent Continue: "${continuePrompt}"`, backgroundMode);

        // Allow time for agent to respond (Increased delay)
        await sleep(4000); // Increased from 2000
        await checkContinue();

        // Resume normal development workflow
        await developmentWorkflow(context);

    } catch (error) {
        if (error instanceof WorkflowCancelledError) {
            throw error;
        }

        statusManager.setState(WorkflowState.Error, "Failed to continue development iteration");
        throw error;
    }
}

/**
 * Pauses the current workflow
 */
export function pauseWorkflow(): void {
    if (!isRunning || isPaused) {
        return;
    }

    isPaused = true;
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Paused, "Workflow paused");
}

/**
 * Resumes the paused workflow
 */
export function resumeWorkflow(context: vscode.ExtensionContext): void {
    if (!isRunning || !isPaused) {
        return;
    }

    isPaused = false;
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Initializing, "Workflow resumed");
}

/**
 * Stops the current workflow
 */
export async function stopWorkflow(): Promise<void> {
    if (!isRunning) {
        return;
    }

    isRunning = false;
    isPaused = false;

    // Reset current workflow
    currentWorkflowPromise = null;
    // Reset iteration count when stopping
    iterationCount = 0;

    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Idle, "Workflow stopped");
}

/**
 * Custom error type for workflow cancellation
 */
class WorkflowCancelledError extends Error {
    constructor(message = 'Workflow cancelled') {
        super(message);
        this.name = 'WorkflowCancelledError';
    }
}

/**
 * Check if the workflow should continue or throw if cancelled/paused
 */
async function checkContinue(): Promise<void> {
    if (!isRunning) {
        throw new WorkflowCancelledError();
    }

    // If paused, wait until unpaused
    while (isPaused) {
        await sleep(500);

        // Check if cancelled during pause
        if (!isRunning) {
            throw new WorkflowCancelledError();
        }
    }
}

/**
 * Loads a prompt file from the prompts directory using the extension context
 * @param context The VS Code extension context
 * @param fileName The name of the prompt file (without extension)
 * @returns The content of the prompt file
 */
async function loadPromptFile(context: vscode.ExtensionContext, fileName: string): Promise<string> {
    const filePathBase = vscode.Uri.joinPath(context.extensionUri, 'src', 'prompts', fileName);
    const txtFilePath = filePathBase.with({ path: filePathBase.path + '.txt' });
    const mdFilePath = filePathBase.with({ path: filePathBase.path + '.md' });

    try {
        console.log(`Attempting to load prompt from: ${txtFilePath.fsPath}`);
        const contentBytes = await vscode.workspace.fs.readFile(txtFilePath);
        const content = new TextDecoder().decode(contentBytes);
        console.log(`Successfully loaded prompt from ${txtFilePath.fsPath}`);
        return content;
    } catch (error) {
        console.warn(`Failed to load prompt ${fileName}.txt: ${error}. Trying .md fallback.`);
        try {
            console.log(`Attempting to load prompt from: ${mdFilePath.fsPath}`);
            const contentBytes = await vscode.workspace.fs.readFile(mdFilePath);
            const content = new TextDecoder().decode(contentBytes);
            console.log(`Successfully loaded prompt from ${mdFilePath.fsPath}`);
            return content;
        } catch (mdError) {
            console.error(`Failed to load prompt ${fileName} (.txt or .md):`, mdError);
            // Return a specific error message that can be sent to chat if needed
            return `Error: Could not load prompt file '${fileName}'. Please check extension installation and file paths.`;
        }
    }
}

/**
 * Performs the initial setup phase of the workflow
 */
async function initialSetup(context: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Initializing, "Setting up environment");

    try {
        // Check for cancellation
        await checkContinue();

        // 1) Open chat using our enhanced method - focus depends on backgroundMode
        const shouldFocusChat = !backgroundMode;
        await ensureChatOpen(5, 1000, shouldFocusChat);

        // Attempt to move the chat view to the secondary sidebar (right panel) if focused
        if (shouldFocusChat) {
            try {
                // Delay to allow focus to settle before moving
                await sleep(500);
                // First focus the GitHub Copilot Chat view specifically
                await vscode.commands.executeCommand('github.copilot.chat.focus');

            } catch (moveError) {
                console.warn('Could not automatically move Copilot Chat view to the right panel:', moveError);
                // Optionally inform the user if the move fails, but avoid blocking the workflow
                // vscode.window.showWarningMessage('Could not automatically move Copilot Chat view. You may need to move it manually.');
            }
        }

        // Get user's task description from context or use default
        const userInput = context.workspaceState.get('marco.userInput');
        const taskDescription = typeof userInput === 'string'
            ? userInput
            : 'Starting Marco AI automation process. I will help automate your workflow.';

        // 2) Set the agent mode based on configuration
        const config = vscode.workspace.getConfiguration('marco');
        const agentMode = config.get<string>('agentMode') || 'Agent';

        statusManager.setState(WorkflowState.SendingTask, "Setting agent mode");
        await sendChatMessage(`I'll be working in ${agentMode} mode for this task.`, backgroundMode);

        // 3) Select preferred LLM model from configuration
        const preferredModels = config.get<string[]>('preferredModels') ||
            ["Claude 3.7 Sonnet", "Gemini 2.5", "GPT 4.1"];

        if (preferredModels.length > 0) {
            statusManager.setState(WorkflowState.SendingTask, "Selecting optimal AI model");

            // Try to select the first preferred model
            let modelSelected = false;
            for (const model of preferredModels) {
                if (await selectAIModel(model)) {
                    modelSelected = true;
                    break;
                }
            }

            // Inform about preferred models via message
            const modelPriorityMessage = `I'll be using the most capable model available in this priority order: ${preferredModels.join(' > ')}.`;
            await sendChatMessage(modelPriorityMessage, backgroundMode);
        }

        await checkContinue();

        // 4) Send initial instructions
        statusManager.setState(WorkflowState.SendingTask, "Sending initial instructions");
        await sendChatMessage(taskDescription, backgroundMode);

        // 5) Branch creation if configured
        const initCreateBranch = config.get<boolean>('initCreateBranch');
        if (initCreateBranch) {
            statusManager.setState(WorkflowState.CreatingBranch, "Creating new branch");
            await createAndCheckoutBranch();
            await sendChatMessage('Created new branch for this feature. Please click Continue when ready.', backgroundMode);

            // Pause for user to acknowledge branch creation
            await sleep(2000);
        }

        await checkContinue();

    } catch (error) {
        if (error instanceof WorkflowCancelledError) {
            throw error;
        }

        statusManager.setState(WorkflowState.Error, "Setup failed");
        throw error;
    }
}

/**
 * Performs the development workflow phase
 */
async function developmentWorkflow(context: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    const config = vscode.workspace.getConfiguration('marco');

    try {
        // Check for cancellation
        await checkContinue();

        // Update status based on iteration count
        const iterationMessage = iterationCount > 0 ? ` (iteration #${iterationCount})` : '';

        // 1) Send development task/checklist
        statusManager.setState(WorkflowState.SendingTask, `Sending development checklist${iterationMessage}`);

        // Load init prompt (pass filename without extension)
        const initPrompt = await loadPromptFile(context, 'init');
        await sendChatMessage(`@agent ${initPrompt}`, backgroundMode);

        // Send checklist after init prompt
        await sendChecklistToChat(context);

        // Allow time for agent to process (Increased delay)
        await sleep(4000); // Increased from 2000
        await checkContinue();

        // 2) Check agent status after some time
        statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress${iterationMessage}`);

        // Load check_agent prompt (pass filename without extension)
        const checkAgentPrompt = await loadPromptFile(context, 'check_agent');
        await sendChatMessage(`@agent ${checkAgentPrompt}`, backgroundMode);

        // Allow time for agent to respond (Increased delay)
        await sleep(6000); // Increased from 3000
        await checkContinue();

        // 3) Request tests if configured
        const needToWriteTest = config.get<boolean>('needToWriteTest');
        if (needToWriteTest) {
            statusManager.setState(WorkflowState.RequestingTests, `Requesting test implementation${iterationMessage}`);

            // Load write_tests prompt (pass filename without extension)
            const writeTestsPrompt = await loadPromptFile(context, 'write_tests');
            await sendChatMessage(`@agent ${writeTestsPrompt}`, backgroundMode);

            // Allow time for agent to process (Increased delay)
            await sleep(6000); // Increased from 3000
            await checkContinue();

            // Check status again
            statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress on tests${iterationMessage}`);
            // Load test progress prompt (pass filename without extension)
            const testProgressPrompt = await loadPromptFile(context, 'test_progress');
            await sendChatMessage(`@agent ${testProgressPrompt}`, backgroundMode);

            // Allow time for agent to respond (Increased delay)
            await sleep(6000); // Increased from 3000
            await checkContinue();
        }

        // 4) Verify completion of checklist
        statusManager.setState(WorkflowState.VerifyingChecklist, `Verifying checklist completion${iterationMessage}`);

        // Load check_checklist prompt (pass filename without extension)
        const checkChecklistPrompt = await loadPromptFile(context, 'check_checklist');
        await sendChatMessage(`@agent ${checkChecklistPrompt}`, backgroundMode);

        // Allow time for agent to respond (Increased delay)
        await sleep(6000); // Increased from 3000

        // 5) Loop back or continue based on checklist status
        const continueToNextIteration = await shouldContinueToNextIteration(context);
        if (continueToNextIteration) {
            iterationCount++;
            statusManager.setState(WorkflowState.ContinuingIteration, `Starting iteration ${iterationCount}`);

            // Load continue_iteration prompt (pass filename without extension)
            const continueIterationPrompt = await loadPromptFile(context, 'continue_iteration');
            await sendChatMessage(`@agent ${continueIterationPrompt}`, backgroundMode);

            // Allow time for agent to process (Increased delay)
            await sleep(6000); // Increased from 3000

            // Loop back to start of development workflow
            await developmentWorkflow(context);
        } else {
            // Workflow completed
            statusManager.setState(WorkflowState.Completed, 'Development workflow completed');
        }
    } catch (error) {
        if (error instanceof WorkflowCancelledError) {
            throw error;
        }

        statusManager.setState(WorkflowState.Error, `Development workflow error: ${error}`);
    }
}

/**
 * Sends the development checklist to the chat
 */
async function sendChecklistToChat(context: vscode.ExtensionContext): Promise<void> {
    // Load checklist from prompt file (pass filename without extension)
    const checklist = await loadPromptFile(context, 'checklist');
    await sendChatMessage(checklist, backgroundMode);
}

/**
 * Sends test writing instructions to the chat
 */
async function sendTestInstructionsToChat(context: vscode.ExtensionContext): Promise<void> {
    // Implementation here
}

/**
 * Creates and checks out a new branch
 */
async function createAndCheckoutBranch(): Promise<boolean> {
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
 * Determines whether to continue to the next iteration
 */
async function shouldContinueToNextIteration(context: vscode.ExtensionContext): Promise<boolean> {
    // Placeholder: always return false (no further iterations)
    return false;
}