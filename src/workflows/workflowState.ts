import * as vscode from 'vscode';

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
 * Set the running status of the workflow
 * @param status The running status to set
 */
export function setRunningStatus(status: boolean): void {
    isRunning = status;
}

/**
 * Set the paused status of the workflow
 * @param status The paused status to set
 */
export function setPausedStatus(status: boolean): void {
    isPaused = status;
}

/**
 * Set the current workflow promise
 * @param promise The workflow promise or null
 */
export function setWorkflowPromise(promise: Promise<void> | null): void {
    currentWorkflowPromise = promise;
}

/**
 * Get the current workflow promise
 * @returns The current workflow promise or null
 */
export function getWorkflowPromise(): Promise<void> | null {
    return currentWorkflowPromise;
}

/**
 * Increment the iteration count
 */
export function incrementIterationCount(): void {
    iterationCount++;
}

/**
 * Reset the iteration count
 */
export function resetIterationCount(): void {
    iterationCount = 0;
}

/**
 * Custom error type for workflow cancellation
 */
export class WorkflowCancelledError extends Error {
    constructor(message = 'Workflow cancelled') {
        super(message);
        this.name = 'WorkflowCancelledError';
    }
}

/**
 * Check if the workflow should continue or throw if cancelled/paused
 */
export async function checkContinue(): Promise<void> {
    if (!isRunning) {
        throw new WorkflowCancelledError();
    }

    // If paused, wait until unpaused
    while (isPaused) {
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if cancelled during pause
        if (!isRunning) {
            throw new WorkflowCancelledError();
        }
    }
}
