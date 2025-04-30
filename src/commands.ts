import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from './statusManager';
import { PromptService } from './services/promptService';
import { runWorkflow } from './workflow';

/**
 * Register all commands for the extension
 * @param context The extension context
 */
export function registerCommands(context: vscode.ExtensionContext): void {
    // Main workflow control commands
    registerWorkflowCommands(context);
    
    // Additional utility commands
    registerUtilityCommands(context);
}

/**
 * Register the main workflow control commands (play, pause, stop, restart)
 * @param context The extension context
 */
function registerWorkflowCommands(context: vscode.ExtensionContext): void {
    const commands = ['play', 'pause', 'stop', 'restart'];
    
    commands.forEach(action => {
        context.subscriptions.push(
            vscode.commands.registerCommand(`marco.${action}`, () => runWorkflow(context, action))
        );
    });
}

/**
 * Register utility commands for the extension
 * @param context The extension context
 */
function registerUtilityCommands(context: vscode.ExtensionContext): void {
    // Command to manually check if agent is alive
    context.subscriptions.push(
        vscode.commands.registerCommand('marco.checkAgentAlive', async () => {
            await checkAgentAlive();
        })
    );
    
    // Command to send a custom message to the chat
    context.subscriptions.push(
        vscode.commands.registerCommand('marco.sendCustomMessage', async () => {
            const message = await vscode.window.showInputBox({
                prompt: 'Enter message to send to Copilot Chat',
                placeHolder: 'Type your message here...'
            });
            
            if (message) {
                const promptService = PromptService.getInstance();
                await promptService.sendMessage(message);
            }
        })
    );
    
    // Command to select preferred AI model
    context.subscriptions.push(
        vscode.commands.registerCommand('marco.selectModel', async () => {
            const models = [
                'Claude 3.7 Sonnet',
                'Gemini 2.5',
                'GPT 4.1'
            ];
            
            const selectedModel = await vscode.window.showQuickPick(models, {
                placeHolder: 'Select preferred AI model'
            });
            
            if (selectedModel) {
                vscode.window.showInformationMessage(`Selected model: ${selectedModel}`);
                // Implementation of model selection would go here
            }
        })
    );
}

/**
 * Check if the agent is alive and prompt if idle
 */
async function checkAgentAlive(): Promise<void> {
    const statusManager = StatusManager.getInstance();
    const currentState = statusManager.getState();
    
    // Skip check for inactive states
    if (currentState === WorkflowState.Idle ||
        currentState === WorkflowState.Paused ||
        currentState === WorkflowState.Error ||
        currentState === WorkflowState.Completed) {
        return;
    }
    
    // Check if it's been a while since the last update
    const lastActivityTime = statusManager.getLastUpdateTime();
    if (!lastActivityTime) {
        return;
    }
    
    const config = vscode.workspace.getConfiguration('marco');
    const idleTimeoutMs = config.get<number>('idleTimeoutSeconds', 30) * 1000;
    
    const timeSinceLastActivity = Date.now() - lastActivityTime.getTime();
    if (timeSinceLastActivity > idleTimeoutMs) {
        // Agent appears to be idle, prompt for an update
        const promptService = PromptService.getInstance();
        await promptService.sendMessage(
            'Are you still working on the task? Please provide an update on your progress.'
        );
    }
}