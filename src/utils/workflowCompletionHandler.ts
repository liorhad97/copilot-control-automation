/**
 * Workflow Completion Handler
 * Handles confirmation and verification of workflow step completion
 */

import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { isBackgroundMode } from '../workflows/workflowState';
import { sendChatMessage } from './chatUtils';
import { PromptLoader } from './promptLoader';

/**
 * Handler for workflow step completion
 */
export class WorkflowCompletionHandler {
    private static instance: WorkflowCompletionHandler;
    private statusManager: StatusManager;
    
    /**
     * Get the singleton instance
     */
    public static getInstance(): WorkflowCompletionHandler {
        if (!WorkflowCompletionHandler.instance) {
            WorkflowCompletionHandler.instance = new WorkflowCompletionHandler();
        }
        return WorkflowCompletionHandler.instance;
    }
    
    private constructor() {
        this.statusManager = StatusManager.getInstance();
    }
    
    /**
     * Confirms completion of a workflow phase with the user
     * @param phase Name of the completed phase
     * @param continueFn Function to call if the user confirms continuation
     * @returns Promise that resolves when user has made a decision
     */
    public async confirmPhaseCompletion(
        phase: string,
        continueFn: () => Promise<void>
    ): Promise<void> {
        this.statusManager.setState(
            WorkflowState.VerifyingCompletion,
            `Verifying ${phase} completion`
        );
        
        const confirmation = await vscode.window.showInformationMessage(
            `${phase} phase is complete. Do you want to continue to the next phase?`,
            'Continue',
            'Review First'
        );
        
        if (confirmation === 'Continue') {
            await continueFn();
        } else {
            this.statusManager.setState(
                WorkflowState.Paused,
                `Workflow paused for review after ${phase}`
            );
        }
    }
    
    /**
     * Handles the transition to the next phase in the workflow
     * @param context VS Code extension context
     * @param currentPhase Current phase name
     * @param nextPhase Next phase name
     * @returns Promise that resolves when transition is complete
     */
    public async transitionToNextPhase(
        context: vscode.ExtensionContext,
        currentPhase: string,
        nextPhase: string
    ): Promise<void> {
        this.statusManager.setState(
            WorkflowState.ContinuingIteration,
            `Transitioning from ${currentPhase} to ${nextPhase}`
        );
        
        try {
            // Simply update the state without sending any transition prompt
            this.statusManager.setState(
                WorkflowState.Running,
                `Now in ${nextPhase} phase`
            );
        } catch (error) {
            this.statusManager.setState(
                WorkflowState.Error,
                `Failed to transition to ${nextPhase}`
            );
            throw error;
        }
    }
}
