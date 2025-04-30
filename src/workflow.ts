import * as vscode from 'vscode';
import { WorkflowManager } from './services/workflowManager';

/**
 * Main entry point for running the workflow
 * @param ctx The extension context
 * @param action The action to perform (play, pause, stop, restart)
 */
export async function runWorkflow(ctx: vscode.ExtensionContext, action: string) {
    const workflowManager = WorkflowManager.getInstance();
    await workflowManager.executeAction(ctx, action);
}

/**
 * Check if the agent is idle based on time since last activity and current state
 * @returns True if the agent appears to be idle, false otherwise
 */
export function isAgentIdle(): boolean {
    const workflowManager = WorkflowManager.getInstance();
    return workflowManager.isAgentIdle();
}
