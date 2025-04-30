import * as vscode from 'vscode';
import { ensureChatOpen, isAgentIdle, sendChatMessage } from './utils/chatUtils';
import { isWorkflowPaused, isWorkflowRunning, pauseWorkflow, resumeWorkflow, runWorkflow, setBackgroundMode, stopWorkflow } from './workflows/workflowManager';

export function registerCommands(context: vscode.ExtensionContext) {
    // Command to toggle workflow (play/stop)
    context.subscriptions.push(
        vscode.commands.registerCommand('marco.toggleWorkflow', async () => {
            if (isWorkflowRunning()) {
                await stopWorkflow();
            } else {
                // Read configuration settings for workflow
                const config = vscode.workspace.getConfiguration('marco');
                const backgroundMode = config.get<boolean>('backgroundMode') || false;

                // Set background mode before starting workflow
                setBackgroundMode(backgroundMode);

                await runWorkflow(context, 'play');
            }
        })
    );

    // Command to pause/resume workflow
    context.subscriptions.push(
        vscode.commands.registerCommand('marco.pauseWorkflow', () => {
            if (isWorkflowRunning()) {
                if (isWorkflowPaused()) {
                    resumeWorkflow(context);
                } else {
                    pauseWorkflow();
                }
            }
        })
    );

    // Command to restart workflow
    context.subscriptions.push(
        vscode.commands.registerCommand('marco.restart', async () => {
            await runWorkflow(context, 'restart');
        })
    );

    // Command to open Copilot Chat
    context.subscriptions.push(
        vscode.commands.registerCommand('marco.openChat', async () => {
            await ensureChatOpen(5, 1000, true);
        })
    );

    // Command to open the sidebar
    context.subscriptions.push(
        vscode.commands.registerCommand('marco.openSidebar', () => {
            // Correct command to focus a view in the explorer panel
            vscode.commands.executeCommand('workbench.view.explorer'); // Ensure explorer is visible
            vscode.commands.executeCommand('marco-ai.sidebar.focus').then(undefined, err => {
                // Fallback if the specific focus command doesn't work
                console.warn('Could not focus marco-ai.sidebar directly, ensuring explorer is visible.', err);
                vscode.commands.executeCommand('workbench.view.explorer');
            });
        })
    );

    // Command to check if agent is alive/active
    context.subscriptions.push(
        vscode.commands.registerCommand('marco.checkAgentAlive', async () => {
            if (isWorkflowRunning() && !isWorkflowPaused()) {
                const idle = await isAgentIdle(); // Assuming isAgentIdle is the correct check now
                if (idle) {
                    // Get background mode configuration
                    const config = vscode.workspace.getConfiguration('marco');
                    const backgroundMode = config.get<boolean>('backgroundMode') || false;

                    // Send prompt to idle agent, using background mode setting
                    await sendChatMessage('Are you still working on the task? If you have completed the task, please summarize what you have done.', backgroundMode);
                }
            }
        })
    );

    // Command to toggle background mode
    context.subscriptions.push(
        vscode.commands.registerCommand('marco.toggleBackgroundMode', async () => {
            // Get current background mode setting
            const config = vscode.workspace.getConfiguration('marco');
            const currentBackgroundMode = config.get<boolean>('backgroundMode') || false;

            // Toggle and update setting
            await config.update('backgroundMode', !currentBackgroundMode, vscode.ConfigurationTarget.Global);

            // Apply to current workflow if running
            if (isWorkflowRunning()) {
                setBackgroundMode(!currentBackgroundMode);
                vscode.window.showInformationMessage(`Background mode ${!currentBackgroundMode ? 'enabled' : 'disabled'}`);
            }
        })
    );
}
