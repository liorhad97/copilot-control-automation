import * as vscode from 'vscode';
import { runWorkflow } from './workflow';
import { StatusManager } from './statusManager';
import { AgentMonitor } from './monitoring';

/**
 * Activate the extension
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Marco AI extension is now active');

    // Initialize status manager
    const statusManager = StatusManager.getInstance();
    statusManager.initialize(context);

    // Create status bar buttons
    createStatusBarItems(context);

    // Register commands
    registerCommands(context);

    // Start monitoring
    const agentMonitor = AgentMonitor.getInstance();
    agentMonitor.startMonitoring(context);
}

/**
 * Create status bar items for Play/Pause/Stop/Restart
 * @param context The extension context
 */
function createStatusBarItems(context: vscode.ExtensionContext) {
    const buttons = [
        { id: 'play',    icon: 'triangle-right', alignment: vscode.StatusBarAlignment.Left, priority: 100 },
        { id: 'pause',   icon: 'debug-pause',    alignment: vscode.StatusBarAlignment.Left, priority: 99 },
        { id: 'stop',    icon: 'debug-stop',     alignment: vscode.StatusBarAlignment.Left, priority: 98 },
        { id: 'restart', icon: 'debug-restart',  alignment: vscode.StatusBarAlignment.Left, priority: 97 }
    ];

    buttons.forEach(btn => {
        const item = vscode.window.createStatusBarItem(btn.alignment, btn.priority);
        item.text = `$(${btn.icon}) ${btn.id.charAt(0).toUpperCase() + btn.id.slice(1)}`;
        item.command = `marco.${btn.id}`;
        item.tooltip = `Marco AI: ${btn.id.charAt(0).toUpperCase() + btn.id.slice(1)}`;
        item.show();
        context.subscriptions.push(item);
    });
}

/**
 * Register extension commands
 * @param context The extension context
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Register workflow control commands
    ['play', 'pause', 'stop', 'restart'].forEach(action => {
        context.subscriptions.push(
            vscode.commands.registerCommand(`marco.${action}`, () => runWorkflow(context, action))
        );
    });
}

/**
 * Deactivate the extension
 */
export function deactivate() {
    // Stop any active monitoring
    const agentMonitor = AgentMonitor.getInstance();
    agentMonitor.stopMonitoring();

    console.log('Marco AI extension has been deactivated');
}