import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { ensureChatOpen, selectAIModel, sendChatMessage } from '../utils/chatUtils';
import { createAndCheckoutBranch } from '../utils/gitUtils';
import { sleep } from '../utils/helpers';
import { loadPromptFile, sendChecklistToChat } from './promptUtils';
import {
    checkContinue,
    getIterationCount,
    incrementIterationCount,
    isBackgroundMode
} from './workflowState';

/**
 * Performs the initial setup phase of the workflow
 * @param context The VS Code extension context
 */
export async function initialSetup(context: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Initializing, "Setting up environment");

    try {
        // Check for cancellation
        await checkContinue();

        // 1) Open chat using our enhanced method - focus depends on backgroundMode
        const shouldFocusChat = !isBackgroundMode();
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
        await sendChatMessage(`I'll be working in ${agentMode} mode for this task.`, isBackgroundMode());

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
            await sendChatMessage(modelPriorityMessage, isBackgroundMode());
        }

        await checkContinue();

        // 4) Send initial instructions
        statusManager.setState(WorkflowState.SendingTask, "Sending initial instructions");
        await sendChatMessage(taskDescription, isBackgroundMode());

        // 5) Branch creation if configured
        const initCreateBranch = config.get<boolean>('initCreateBranch');
        if (initCreateBranch) {
            statusManager.setState(WorkflowState.CreatingBranch, "Creating new branch");
            await createAndCheckoutBranch();
            await sendChatMessage('Created new branch for this feature. Please click Continue when ready.', isBackgroundMode());

            // Pause for user to acknowledge branch creation
            await sleep(2000);
        }

        await checkContinue();

    } catch (error: any) {
        if (error.name === 'WorkflowCancelledError') {
            throw error;
        }

        statusManager.setState(WorkflowState.Error, "Setup failed");
        throw error;
    }
}

/**
 * Performs the development workflow phase
 * @param context The VS Code extension context
 */
export async function developmentWorkflow(context: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    const config = vscode.workspace.getConfiguration('marco');

    try {
        // Check for cancellation
        await checkContinue();

        // Update status based on iteration count
        const iterationCount = getIterationCount();
        const iterationMessage = iterationCount > 0 ? ` (iteration #${iterationCount})` : '';

        // 1) Send development task/checklist
        statusManager.setState(WorkflowState.SendingTask, `Sending development checklist${iterationMessage}`);

        // Load init prompt (pass filename without extension)
        const initPrompt = await loadPromptFile(context, 'init');
        await sendChatMessage(`@agent ${initPrompt}`, isBackgroundMode());

        // Send checklist after init prompt
        await sendChecklistToChat(context, isBackgroundMode());

        // Allow time for agent to process (Increased delay)
        await sleep(4000); // Increased from 2000
        await checkContinue();

        // 2) Check agent status after some time
        statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress${iterationMessage}`);

        // Load check_agent prompt (pass filename without extension)
        const checkAgentPrompt = await loadPromptFile(context, 'check_agent');
        await sendChatMessage(`@agent ${checkAgentPrompt}`, isBackgroundMode());

        // Allow time for agent to respond (Increased delay)
        await sleep(6000); // Increased from 3000
        await checkContinue();

        // 3) Request tests if configured
        const needToWriteTest = config.get<boolean>('needToWriteTest');
        if (needToWriteTest) {
            statusManager.setState(WorkflowState.RequestingTests, `Requesting test implementation${iterationMessage}`);

            // Load write_tests prompt (pass filename without extension)
            const writeTestsPrompt = await loadPromptFile(context, 'write_tests');
            await sendChatMessage(`@agent ${writeTestsPrompt}`, isBackgroundMode());

            // Allow time for agent to process (Increased delay)
            await sleep(6000); // Increased from 3000
            await checkContinue();

            // Check status again
            statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress on tests${iterationMessage}`);
            // Load test progress prompt (pass filename without extension)
            const testProgressPrompt = await loadPromptFile(context, 'test_progress');
            await sendChatMessage(`@agent ${testProgressPrompt}`, isBackgroundMode());

            // Allow time for agent to respond (Increased delay)
            await sleep(6000); // Increased from 3000
            await checkContinue();
        }

        // 4) Verify completion of checklist
        statusManager.setState(WorkflowState.VerifyingChecklist, `Verifying checklist completion${iterationMessage}`);

        // Load check_checklist prompt (pass filename without extension)
        const checkChecklistPrompt = await loadPromptFile(context, 'check_checklist');
        await sendChatMessage(`@agent ${checkChecklistPrompt}`, isBackgroundMode());

        // Allow time for agent to respond (Increased delay)
        await sleep(6000); // Increased from 3000

        // 5) Loop back or continue based on checklist status
        const continueToNextIteration = await shouldContinueToNextIteration(context);
        if (continueToNextIteration) {
            incrementIterationCount();
            statusManager.setState(WorkflowState.ContinuingIteration, `Starting iteration ${getIterationCount()}`);

            // Load continue_iteration prompt (pass filename without extension)
            const continueIterationPrompt = await loadPromptFile(context, 'continue_iteration');
            await sendChatMessage(`@agent ${continueIterationPrompt}`, isBackgroundMode());

            // Allow time for agent to process (Increased delay)
            await sleep(6000); // Increased from 3000

            // Loop back to start of development workflow
            await developmentWorkflow(context);
        } else {
            // Workflow completed
            statusManager.setState(WorkflowState.Completed, 'Development workflow completed');
        }
    } catch (error: any) {
        if (error.name === 'WorkflowCancelledError') {
            throw error;
        }

        statusManager.setState(WorkflowState.Error, `Development workflow error: ${error}`);
        throw error;
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
        incrementIterationCount();

        // Update status
        statusManager.setState(WorkflowState.SendingTask, `Starting iteration #${getIterationCount()}`);

        // Load the continue iteration prompt
        const continuePrompt = await loadPromptFile(context, 'continue_iteration');

        // Send the continue prompt
        await sendChatMessage(`@agent Continue: "${continuePrompt}"`, isBackgroundMode());

        // Allow time for agent to respond (Increased delay)
        await sleep(4000); // Increased from 2000
        await checkContinue();

        // Resume normal development workflow
        await developmentWorkflow(context);

    } catch (error: any) {
        if (error.name === 'WorkflowCancelledError') {
            throw error;
        }

        statusManager.setState(WorkflowState.Error, "Failed to continue development iteration");
        throw error;
    }
}

/**
 * Determines whether to continue to the next iteration
 * @param context The VS Code extension context
 * @returns Promise resolving to true if should continue, false if complete
 */
export async function shouldContinueToNextIteration(context: vscode.ExtensionContext): Promise<boolean> {
    // Placeholder: always return false (no further iterations)
    return false;
}
