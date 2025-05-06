import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { CopilotResponseMonitor } from '../utils/copilotResponseMonitor';
import { sleep } from '../utils/helpers';
import { WorkflowCompletionHandler } from '../utils/workflowCompletionHandler';
import { 
    isWorkflowRunning, 
    isWorkflowPaused, 
    isBackgroundMode, 
    setBackgroundMode, 
    getIterationCount,
    setRunningStatus,
    setPausedStatus,
    setWorkflowPromise,
    resetIterationCount,
    WorkflowCancelledError
} from './workflowState';
import { 
    initialSetup, 
    developmentWorkflow, 
    continueDevelopment 
} from './workflowImplementation';

/**
 * Runs the Marco AI workflow
 * @param context The VS Code extension context
 * @param action The action to perform (play, pause, stop, restart)
 */
export async function runWorkflow(context: vscode.ExtensionContext, action: string): Promise<void> {
    const statusManager = StatusManager.getInstance();
    const responseMonitor = CopilotResponseMonitor.getInstance();
    const completionHandler = WorkflowCompletionHandler.getInstance();

    switch (action) {
        case 'play':
            if (isWorkflowRunning()) {
                return; // Already running
            }

            setRunningStatus(true);
            setPausedStatus(false);
            // Reset iteration count when starting a new workflow
            resetIterationCount();

            // Get background mode setting
            const config = vscode.workspace.getConfiguration('marco');
            setBackgroundMode(config.get<boolean>('backgroundMode') || false);

            // Start the Copilot response monitoring
            responseMonitor.startMonitoring(context);

            // Show notification if starting in background mode
            if (isBackgroundMode()) {
                vscode.window.showInformationMessage('Marco AI workflow starting in background mode. The chat will be minimized when possible.');
            }

            // Start the workflow in the background
            setWorkflowPromise((async () => {
                try {
                    // Run the initialization phase
                    const checklistPath = await initialSetup(context);
                    
                    // Directly proceed to development phase without asking for confirmation
                    await completionHandler.transitionToNextPhase(
                        context,
                        "Initialization",
                        "Development"
                    );
                    await developmentWorkflow(context);

                    // Mark as completed
                    statusManager.setState(WorkflowState.Completed, "Workflow completed successfully");
                    setRunningStatus(false);
                    
                    // Stop monitoring once workflow is complete
                    responseMonitor.stopMonitoring();
                } catch (error) {
                    if (error instanceof WorkflowCancelledError) {
                        // This is expected when workflow is stopped
                        statusManager.setState(WorkflowState.Idle, "Workflow stopped");
                    } else {
                        console.error('Workflow error:', error);
                        statusManager.setState(WorkflowState.Error, `Workflow failed: ${error}`);
                    }
                    setRunningStatus(false);
                    setPausedStatus(false);
                    
                    // Stop monitoring on error
                    responseMonitor.stopMonitoring();
                }
            })());

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
            if (!isWorkflowRunning()) {
                // If workflow isn't running, start it
                await runWorkflow(context, 'play');
            } else if (isWorkflowPaused()) {
                // If paused, resume it
                resumeWorkflow(context);
            } else {
                // Confirm before continuing with next iteration
                await completionHandler.confirmPhaseCompletion(
                    `Iteration ${getIterationCount()}`,
                    async () => {
                        await completionHandler.transitionToNextPhase(
                            context,
                            `Iteration ${getIterationCount()}`,
                            `Iteration ${getIterationCount() + 1}`
                        );
                        await continueDevelopment(context);
                    }
                );
            }
            break;
    }
}

/**
 * Pauses the current workflow
 */
export function pauseWorkflow(): void {
    if (!isWorkflowRunning() || isWorkflowPaused()) {
        return;
    }

    setPausedStatus(true);
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Paused, "Workflow paused");
}

/**
 * Resumes the paused workflow
 */
export function resumeWorkflow(context: vscode.ExtensionContext): void {
    if (!isWorkflowRunning() || !isWorkflowPaused()) {
        return;
    }

    setPausedStatus(false);
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Running, "Workflow resumed");
}

/**
 * Stops the current workflow
 */
export async function stopWorkflow(): Promise<void> {
    if (!isWorkflowRunning()) {
        return;
    }

    setRunningStatus(false);
    setPausedStatus(false);

    // Reset current workflow
    setWorkflowPromise(null);
    // Reset iteration count when stopping
    resetIterationCount();
    
    // Stop the Copilot response monitoring
    const responseMonitor = CopilotResponseMonitor.getInstance();
    responseMonitor.stopMonitoring();

    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Idle, "Workflow stopped");
}
