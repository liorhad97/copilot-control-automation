import * as vscode from 'vscode';
import { WorkflowManager } from '../services/WorkflowManager';

/**
 * Facade for the workflow management functionality.
 * Provides a simplified interface for interacting with the WorkflowManager.
 */

/**
 * Check if the workflow is currently running
 * @param context The extension context
 * @returns True if the workflow is running, false otherwise
 */
export function isWorkflowRunning(context: vscode.ExtensionContext): boolean {
  const manager = WorkflowManager.getInstance(context);
  return manager.isWorkflowRunning();
}

/**
 * Check if the workflow is currently paused
 * @param context The extension context
 * @returns True if the workflow is paused, false otherwise
 */
export function isWorkflowPaused(context: vscode.ExtensionContext): boolean {
  const manager = WorkflowManager.getInstance(context);
  return manager.isWorkflowPaused();
}

/**
 * Check if the workflow is running in background mode
 * @param context The extension context
 * @returns True if the workflow is running in background mode, false otherwise
 */
export function isBackgroundMode(context: vscode.ExtensionContext): boolean {
  const manager = WorkflowManager.getInstance(context);
  return manager.isBackgroundMode();
}

/**
 * Set whether the workflow should run in background mode
 * @param context The extension context
 * @param enabled Whether background mode should be enabled
 */
export function setBackgroundMode(context: vscode.ExtensionContext, enabled: boolean): void {
  const manager = WorkflowManager.getInstance(context);
  manager.setBackgroundMode(enabled);
}

/**
 * Get the current iteration count
 * @param context The extension context
 * @returns The number of iterations completed
 */
export function getIterationCount(context: vscode.ExtensionContext): number {
  const manager = WorkflowManager.getInstance(context);
  return manager.getIterationCount();
}

/**
 * Run the workflow with the specified action
 * @param context The extension context
 * @param action The action to perform (play, pause, stop, restart, continue)
 */
export async function runWorkflow(
  context: vscode.ExtensionContext,
  action: string
): Promise<void> {
  const manager = WorkflowManager.getInstance(context);
  await manager.runWorkflow(context, action);
}

/**
 * Pause the workflow
 * @param context The extension context
 */
export function pauseWorkflow(context: vscode.ExtensionContext): void {
  const manager = WorkflowManager.getInstance(context);
  manager.pauseWorkflow();
}

/**
 * Resume the paused workflow
 * @param context The extension context
 */
export function resumeWorkflow(context: vscode.ExtensionContext): void {
  const manager = WorkflowManager.getInstance(context);
  manager.resumeWorkflow();
}

/**
 * Stop the workflow
 * @param context The extension context
 */
export async function stopWorkflow(context: vscode.ExtensionContext): Promise<void> {
  const manager = WorkflowManager.getInstance(context);
  await manager.stopWorkflow();
}