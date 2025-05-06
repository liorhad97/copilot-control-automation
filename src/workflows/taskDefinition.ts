/**
 * Task Definition & Preparation
 * Handles checklist input capture via VS Code WebView panel
 */

import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { ChecklistInputPanel } from '../ui/checklistInputPanel';

/**
 * Service class for handling checklist operations with VS Code WebView panel
 */
export class ChecklistService {
    /**
     * Presents a VS Code WebView panel for the user to input their checklist
     * @param context VS Code extension context
     * @returns Promise resolving to the user's input or null if cancelled
     */
    public static async captureChecklistInput(context: vscode.ExtensionContext): Promise<string | null> {
        const statusManager = StatusManager.getInstance();
        statusManager.setState(WorkflowState.Initializing, "Capturing checklist input");
        
        try {
            return await this.showInputPanel(context);
        } catch (error) {
            await this.handleInputError(error);
            return null;
        }
    }
    
    /**
     * Shows the input panel and returns the user input
     * @param context VS Code extension context
     * @returns Promise resolving to user input or null
     */
    private static async showInputPanel(context: vscode.ExtensionContext): Promise<string | null> {
        // Create and show the WebView panel
        const panel = await ChecklistInputPanel.createOrShow(context);
        
        // Get user input from the panel
        const userInput = await panel.getUserInput();
        
        if (!userInput) {
            await vscode.window.showWarningMessage('Checklist input cancelled. Workflow cannot proceed without tasks.');
            return null;
        }
        
        return userInput;
    }
    
    /**
     * Handles errors during input capture
     * @param error The error that occurred
     */
    private static async handleInputError(error: unknown): Promise<void> {
        console.error('Error capturing checklist input:', error);
        await vscode.window.showErrorMessage(`Error capturing checklist input: ${error}`);
    }
}
