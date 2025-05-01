import * as vscode from 'vscode';
import { ChatUtils } from '../services/ChatUtils';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { isWorkflowPaused, isWorkflowRunning, pauseWorkflow, resumeWorkflow, runWorkflow, setBackgroundMode, stopWorkflow } from '../workflows/workflow';

/**
 * Registers all commands for the extension
 */
export class CommandRegistrar {
  /**
   * Register all commands for the extension
   * @param context The extension context
   */
  public static registerCommands(context: vscode.ExtensionContext): void {
    // Command to toggle workflow (play/stop)
    context.subscriptions.push(
      vscode.commands.registerCommand('marco.toggleWorkflow', async () => {
        if (isWorkflowRunning(context)) {
          await stopWorkflow(context);
        } else {
          // Read configuration settings for workflow
          const configManager = ConfigurationManager.getInstance();
          const backgroundMode = configManager.getBackgroundMode();

          // Set background mode before starting workflow
          setBackgroundMode(context, backgroundMode);

          await runWorkflow(context, 'play');
        }
      })
    );

    // Command to pause/resume workflow
    context.subscriptions.push(
      vscode.commands.registerCommand('marco.pauseWorkflow', () => {
        if (isWorkflowRunning(context)) {
          if (isWorkflowPaused(context)) {
            resumeWorkflow(context);
          } else {
            pauseWorkflow(context);
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
        await ChatUtils.ensureChatOpen(5, 1000, true);
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
        if (isWorkflowRunning(context) && !isWorkflowPaused(context)) {
          const idle = await ChatUtils.isAgentIdle(); 
          if (idle) {
            // Get background mode configuration
            const configManager = ConfigurationManager.getInstance();
            const backgroundMode = configManager.getBackgroundMode();

            // Send prompt to idle agent, using background mode setting
            await ChatUtils.sendChatMessage('Are you still working on the task? If you have completed the task, please summarize what you have done.', backgroundMode);
          }
        }
      })
    );

    // Command to toggle background mode
    context.subscriptions.push(
      vscode.commands.registerCommand('marco.toggleBackgroundMode', async () => {
        // Get configuration manager
        const configManager = ConfigurationManager.getInstance();
        
        // Get current background mode setting
        const currentBackgroundMode = configManager.getBackgroundMode();

        // Toggle and update setting
        await configManager.updateSetting('backgroundMode', !currentBackgroundMode, vscode.ConfigurationTarget.Global);

        // Apply to current workflow if running
        if (isWorkflowRunning(context)) {
          setBackgroundMode(context, !currentBackgroundMode);
          vscode.window.showInformationMessage(`Background mode ${!currentBackgroundMode ? 'enabled' : 'disabled'}`);
        }
      })
    );
  }
}