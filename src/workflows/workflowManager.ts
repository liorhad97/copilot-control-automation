import * as vscode from 'vscode';
import { WorkflowEngine } from '../core/workflowEngine';

// Public interface for managing workflows

/**
 * Check if the workflow is currently running
 * @returns True if running, false otherwise
 */
export function isWorkflowRunning(): boolean {
    const workflowEngine = WorkflowEngine.getInstance();
    return workflowEngine.isWorkflowRunning();
}

/**
 * Check if the workflow is currently paused
 * @returns True if paused, false otherwise
 */
export function isWorkflowPaused(): boolean {
    const workflowEngine = WorkflowEngine.getInstance();
    return workflowEngine.isWorkflowPaused();
}

/**
 * Set the workflow to run in background mode
 * @param enabled Whether background mode should be enabled
 */
export function setBackgroundMode(enabled: boolean): void {
    const workflowEngine = WorkflowEngine.getInstance();
    workflowEngine.setBackgroundMode(enabled);
}

/**
 * Get the current iteration count
 * @returns The number of iterations completed
 */
export function getIterationCount(): number {
    const workflowEngine = WorkflowEngine.getInstance();
    return workflowEngine.getIterationCount();
}

/**
 * Runs the Marco AI workflow
 * @param context The VS Code extension context
 * @param action The action to perform (play, pause, stop, restart)
 */
export async function runWorkflow(context: vscode.ExtensionContext, action: string): Promise<void> {
    const workflowEngine = WorkflowEngine.getInstance();
    return workflowEngine.runWorkflow(context, action);
}

/**
 * Pauses the current workflow
 */
export function pauseWorkflow(): void {
    const workflowEngine = WorkflowEngine.getInstance();
    workflowEngine.pauseWorkflow();
}

/**
 * Resumes the paused workflow
 */
export function resumeWorkflow(context: vscode.ExtensionContext): void {
    const workflowEngine = WorkflowEngine.getInstance();
    workflowEngine.resumeWorkflow(context);
}

/**
 * Stops the current workflow
 */
export async function stopWorkflow(): Promise<void> {
    const workflowEngine = WorkflowEngine.getInstance();
    await workflowEngine.stopWorkflow();
}

/**
 * Check if the agent is idle
 * @returns True if the agent appears to be idle, false otherwise
 */
export function isAgentIdle(): boolean {
    const workflowEngine = WorkflowEngine.getInstance();
    return workflowEngine.isAgentIdle();
}