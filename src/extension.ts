import * as vscode from 'vscode';
import { registerCommands } from './commands'; // Import from new file
import { clearMonitoringTimers, setupMonitoringTimers } from './monitoring'; // Import from new file
import { StatusManager } from './statusManager';
import { SidebarProvider } from './ui/sidebarProvider';
// Removed unused imports: ensureChatOpen, sendChatMessage, isAgentIdle, isWorkflowPaused, isWorkflowRunning, pauseWorkflow, resumeWorkflow, runWorkflow, setBackgroundMode, stopWorkflow

export function activate(context: vscode.ExtensionContext) {
	console.log('Marco AI extension is now active');

	// Initialize status manager
	const statusManager = StatusManager.getInstance();
	statusManager.initialize(context);

	// Create sidebar
	const sidebarProvider = new SidebarProvider(context.extensionUri, context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			"marco-ai.sidebar",
			sidebarProvider
		)
	);

	// Register commands from the dedicated file
	registerCommands(context);

	// Set up timers for monitoring from the dedicated file
	setupMonitoringTimers(context);

	vscode.window.showInformationMessage('Marco AI is ready to help!');
}

export function deactivate() {
	console.log('Marco AI extension is now deactivated');
	// Clear timers on deactivation
	clearMonitoringTimers();
	// Any other cleanup logic goes here
}
