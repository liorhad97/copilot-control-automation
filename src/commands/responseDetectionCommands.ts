/**
 * Response Detection Commands
 * Registers commands for detecting interactive elements in Copilot responses
 */

import * as vscode from 'vscode';

/**
 * Registers all commands related to response detection
 * @param context The extension context
 */
export function registerResponseDetectionCommands(context: vscode.ExtensionContext): void {
    // Register a command to simulate a continue button in Copilot (for testing)
    const simulateContinueCommand = vscode.commands.registerCommand(
        'marco.simulateContinueButton',
        () => {
            vscode.commands.executeCommand('marco.responseDetected', 'continue-button', 'Continue');
        }
    );
    
    context.subscriptions.push(simulateContinueCommand);
    
    // Register a command to simulate a terminal command in Copilot (for testing)
    const simulateTerminalCommand = vscode.commands.registerCommand(
        'marco.simulateTerminalCommand',
        () => {
            vscode.commands.executeCommand(
                'marco.responseDetected', 
                'terminal-command', 
                'echo "Hello from simulated Copilot terminal command"'
            );
        }
    );
    
    context.subscriptions.push(simulateTerminalCommand);
}
