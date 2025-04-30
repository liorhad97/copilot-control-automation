import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from './statusManager';
import { initialSetup } from './workflows/initialSetup';
import { developmentWorkflow } from './workflows/developmentWorkflow';
import { ensureChatOpen, sendChatMessage } from './utils/chatUtils';

/**
 * Main entry point for running the workflow
 * @param ctx The extension context
 * @param action The action to perform (play, pause, stop, restart)
 */
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

/**
 * Handle workflow restart
 * @param ctx The extension context
 */
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

/**
 * Check if the agent is idle based on time since last activity and current state
 * @returns True if the agent appears to be idle, false otherwise
 */
export function isAgentIdle(): boolean {
    const statusManager = StatusManager.getInstance();
    const currentState = statusManager.getState();

    // Don't check for idle in these states
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
