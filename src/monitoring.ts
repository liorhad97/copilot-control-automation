import * as vscode from 'vscode';
import { ensureChatOpen } from './utils/chatUtils'; // Adjusted import path
import { isWorkflowPaused, isWorkflowRunning } from './workflows/workflowState';

let checkAgentTimer: NodeJS.Timeout | undefined;
let ensureChatTimer: NodeJS.Timeout | undefined;

export function setupMonitoringTimers(context: vscode.ExtensionContext) {
    // Clear existing timers if they exist
    if (checkAgentTimer) { clearInterval(checkAgentTimer); }
    if (ensureChatTimer) { clearInterval(ensureChatTimer); }

    // Get frequency from configuration
    const config = vscode.workspace.getConfiguration('marco');
    const checkAgentFrequency = config.get<number>('checkAgentFrequency') || 10000;
    const ensureChatFrequency = config.get<number>('ensureChatFrequency') || 300000;

    // Every 10s (or configured time): Check agent alive when workflow is running
    checkAgentTimer = setInterval(() => {
        if (isWorkflowRunning() && !isWorkflowPaused()) {
            vscode.commands.executeCommand('marco.checkAgentAlive');
        }
    }, checkAgentFrequency);

    // Every 5min (or configured time): Ensure chat open when workflow is running
    ensureChatTimer = setInterval(async () => {
        if (isWorkflowRunning() && !isWorkflowPaused()) {
            const config = vscode.workspace.getConfiguration('marco');
            const backgroundMode = config.get<boolean>('backgroundMode') || false;

            // Don't focus if in background mode
            await ensureChatOpen(5, 1000, !backgroundMode);
        }
    }, ensureChatFrequency);

    // Clean up timers on deactivation (add to context subscriptions)
    context.subscriptions.push({
        dispose: () => {
            if (checkAgentTimer) { clearInterval(checkAgentTimer); }
            if (ensureChatTimer) { clearInterval(ensureChatTimer); }
        }
    });

    // Watch for configuration changes (handled within this function now)
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('marco.checkAgentFrequency') ||
                e.affectsConfiguration('marco.ensureChatFrequency')) {

                console.log("Monitoring configuration changed, restarting timers.");
                // Re-setup timers with new frequencies
                setupMonitoringTimers(context); // Recursive call to restart with new config
            }
        })
    );
}

export function clearMonitoringTimers() {
    if (checkAgentTimer) { clearInterval(checkAgentTimer); }
    if (ensureChatTimer) { clearInterval(ensureChatTimer); }
    checkAgentTimer = undefined;
    ensureChatTimer = undefined;
}
