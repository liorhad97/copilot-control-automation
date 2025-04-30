import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { ensureChatOpen, selectAIModel, sendChatMessage } from '../utils';
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
        const continuePrompt = await loadPromptFile('continue_iteration.md');

        // Send the continue prompt
        await sendChatMessage(`@agent Continue: "${continuePrompt}"`, backgroundMode);

        // Allow time for agent to respond
        await sleep(2000);
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
 * Loads a prompt file from the prompts directory
 * @param fileName The name of the prompt file
 * @returns The content of the prompt file
 */
async function loadPromptFile(fileName: string): Promise<string> {
    try {
        const extensionPath = vscode.extensions.getExtension('marco-ai.marco-ai')?.extensionPath;
        if (!extensionPath) {
            throw new Error('Could not find extension path');
        }

        const promptPath = path.join(extensionPath, 'src', 'prompts', fileName);
        return fs.readFileSync(promptPath, 'utf8');
    } catch (error) {
        console.error(`Error loading prompt file ${fileName}:`, error);
        return `Could not load prompt ${fileName}. Please continue with the development iteration.`;
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

        // 1) Open chat using our enhanced method - don't force focus in background mode
        await ensureChatOpen(5, 1000, !backgroundMode);

        // Get user's task description from context or use default
        // Ensure it's a string with toString() or use default string
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

        // Load init prompt
        const initPrompt = await loadPromptFile('init.md');
        await sendChatMessage(`@agent ${initPrompt}`, backgroundMode);

        // Send checklist after init prompt
        await sendChecklistToChat();

        // Allow time for agent to process
        await sleep(2000);
        await checkContinue();

        // 2) Check agent status after some time
        statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress${iterationMessage}`);

        // Load check_agent prompt
        const checkAgentPrompt = await loadPromptFile('check_agent.md');
        await sendChatMessage(`@agent ${checkAgentPrompt}`, backgroundMode);

        // Allow time for agent to respond
        await sleep(3000);
        await checkContinue();

        // 3) Request tests if configured
        const needToWriteTest = config.get<boolean>('needToWriteTest');
        if (needToWriteTest) {
            statusManager.setState(WorkflowState.RequestingTests, `Requesting test implementation${iterationMessage}`);

            // Load write_tests prompt
            const writeTestsPrompt = await loadPromptFile('write_tests.md');
            await sendChatMessage(`@agent ${writeTestsPrompt}`, backgroundMode);

            // Allow time for agent to process
            await sleep(3000);
            await checkContinue();

            // Check status again
            statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress on tests${iterationMessage}`);
            // Load test progress prompt instead of hardcoding
            const testProgressPrompt = await loadPromptFile('test_progress.md');
            await sendChatMessage(`@agent ${testProgressPrompt}`, backgroundMode);

            // Allow time for agent to respond
            await sleep(3000);
            await checkContinue();
        }

        // 4) Verify completion of checklist
        statusManager.setState(WorkflowState.VerifyingChecklist, `Verifying checklist completion${iterationMessage}`);

        // Load check_checklist prompt
        const checkChecklistPrompt = await loadPromptFile('check_checklist.md');
        await sendChatMessage(`@agent ${checkChecklistPrompt}`, backgroundMode);

        // Allow time for agent to respond
        await sleep(3000);

        // 5) Loop back or continue based on checklist status
        const continueToNextIteration = await shouldContinueToNextIteration();
        if (continueToNextIteration) {
            iterationCount++;
            statusManager.setState(WorkflowState.ContinuingIteration, `Starting iteration ${iterationCount}`);

            // Load continue_iteration prompt
            const continueIterationPrompt = await loadPromptFile('continue_iteration.md');
            await sendChatMessage(`@agent ${continueIterationPrompt}`, backgroundMode);

            // Allow time for agent to process
            await sleep(3000);

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
async function sendChecklistToChat(): Promise<void> {
    // Load checklist from prompt file
    const checklist = await loadPromptFile('checklist.md');
    await sendChatMessage(checklist, backgroundMode);
}

/**
 * Sends test writing instructions to the chat
 */
async function sendTestInstructionsToChat(): Promise<void> {
    // Load test instructions from prompt file
    const testInstructions = await loadPromptFile('test_instructions.md');
    await sendChatMessage(testInstructions, backgroundMode);
}

/**
 * Sends verification instructions to the chat
 */
async function sendVerificationToChat(): Promise<void> {
    // Load verification instructions from prompt file
    const verification = await loadPromptFile('verify_completion.md');
    await sendChatMessage(verification, backgroundMode);
}

/**
 * Creates and checks out a new Git branch
 */
async function createAndCheckoutBranch(): Promise<boolean> {
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
 * Check if the agent is idle
 * Would be implemented based on how you track agent activity
 */
export function isAgentIdle(): boolean {
    // This is a placeholder
    return false;
}

/**
 * Determines if the workflow should continue to the next iteration
 * @returns True if the workflow should continue, false otherwise
 */
async function shouldContinueToNextIteration(): Promise<boolean> {
    // Placeholder for logic to determine if the workflow should continue
    return true;
}