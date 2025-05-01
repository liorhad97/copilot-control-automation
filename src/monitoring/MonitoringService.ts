import * as vscode from 'vscode';
import { ChatUtils } from '../services/ChatUtils';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { isWorkflowPaused, isWorkflowRunning } from '../workflows/workflow';

/**
 * Manages timers for monitoring the state of the workflow and chat
 */
export class MonitoringService {
  private static checkAgentTimer: NodeJS.Timeout | undefined;
  private static ensureChatTimer: NodeJS.Timeout | undefined;
  private static context: vscode.ExtensionContext;
  private static configManager: ConfigurationManager;

  /**
   * Initialize the monitoring service
   * @param context The extension context
   */
  public static initialize(context: vscode.ExtensionContext): void {
    this.context = context;
    this.configManager = ConfigurationManager.getInstance();
    this.setupMonitoringTimers();

    // Watch for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('marco.checkAgentFrequency') ||
            e.affectsConfiguration('marco.ensureChatFrequency')) {

          console.log("Monitoring configuration changed, restarting timers.");
          // Re-setup timers with new frequencies
          this.setupMonitoringTimers();
        }
      })
    );
  }

  /**
   * Set up monitoring timers based on configuration
   */
  private static setupMonitoringTimers(): void {
    // Clear existing timers if they exist
    this.clearMonitoringTimers();

    // Get frequency from configuration
    const checkAgentFrequency = this.configManager.getCheckAgentFrequency();
    const ensureChatFrequency = this.configManager.getEnsureChatFrequency();

    // Every 10s (or configured time): Check agent alive when workflow is running
    this.checkAgentTimer = setInterval(() => {
      if (isWorkflowRunning(this.context) && !isWorkflowPaused(this.context)) {
        vscode.commands.executeCommand('marco.checkAgentAlive');
      }
    }, checkAgentFrequency);

    // Every 5min (or configured time): Ensure chat open when workflow is running
    this.ensureChatTimer = setInterval(async () => {
      if (isWorkflowRunning(this.context) && !isWorkflowPaused(this.context)) {
        const backgroundMode = this.configManager.getBackgroundMode();

        // Don't focus if in background mode
        await ChatUtils.ensureChatOpen(5, 1000, !backgroundMode);
      }
    }, ensureChatFrequency);

    // Clean up timers on deactivation (add to context subscriptions)
    this.context.subscriptions.push({
      dispose: () => {
        this.clearMonitoringTimers();
      }
    });
  }

  /**
   * Clear all monitoring timers
   */
  public static clearMonitoringTimers(): void {
    if (this.checkAgentTimer) { clearInterval(this.checkAgentTimer); }
    if (this.ensureChatTimer) { clearInterval(this.ensureChatTimer); }
    this.checkAgentTimer = undefined;
    this.ensureChatTimer = undefined;
  }
}