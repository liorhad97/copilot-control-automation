import * as vscode from 'vscode';
import { registerCommands } from './commands'; // Import from new file
import { clearMonitoringTimers, setupMonitoringTimers } from './monitoring'; // Import from new file
import { StatusManager } from './statusManager';
import { SidebarProvider } from './ui/sidebarProvider';
// Removed unused imports: ensureChatOpen, sendChatMessage, isAgentIdle, isWorkflowPaused, isWorkflowRunning, pauseWorkflow, resumeWorkflow, runWorkflow, setBackgroundMode, stopWorkflow

function showWelcomePage(context: vscode.ExtensionContext) {
	const panel = vscode.window.createWebviewPanel(
		'marcoWelcome',
		'Welcome to Marco AI',
		vscode.ViewColumn.One,
		{ enableScripts: true }
	);
	panel.webview.html = `
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 2em; }
                h1 { color: #007acc; }
            </style>
        </head>
        <body>
            <h1>👋 Welcome to Marco AI!</h1>
            <p>Automate your AI workflows in VS Code.</p>
            <ul>
                <li>Use the <b>Marco AI</b> icon in the Activity Bar to open your dashboard.</li>
                <li>Configure your workflow in <b>Settings</b>.</li>
                <li>Start, pause, or restart workflows from the Command Palette or Activity Bar.</li>
            </ul>
            <p>Get started by running a workflow or exploring the dashboard!</p>
        </body>
        </html>
    `;
}

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

	// Register welcome page command
	context.subscriptions.push(
		vscode.commands.registerCommand('marco.showWelcome', () => showWelcomePage(context))
	);

	// Show welcome page on first activation
	const hasShownWelcome = context.globalState.get('marco.hasShownWelcome');
	if (!hasShownWelcome) {
		showWelcomePage(context);
		context.globalState.update('marco.hasShownWelcome', true);
	}

	vscode.window.showInformationMessage('Marco AI is ready to help!');
}

export function deactivate() {
	console.log('Marco AI extension is now deactivated');
	// Clear timers on deactivation
	clearMonitoringTimers();
	// Any other cleanup logic goes here
}
