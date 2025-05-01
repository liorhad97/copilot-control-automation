import * as vscode from 'vscode';
import { CommandRegistrar } from './commands/CommandRegistrar';
import { MonitoringService } from './monitoring/MonitoringService';
import { StatusManager } from './services/StatusManager';
import { FloatingControlsPanel } from './ui/FloatingControlsPanel';
import { SidebarProvider } from './ui/SidebarProvider';

// Global variable to hold the floating controls panel instance
let floatingControlsPanel: FloatingControlsPanel | undefined;

/**
 * Displays a welcome page in a webview panel for first-time users.
 * @param context The extension context provided by VSCode.
 */
function showWelcomePage(context: vscode.ExtensionContext) {
	const panel = vscode.window.createWebviewPanel(
		'marcoWelcome',           // Unique identifier for the panel
		'Welcome to Marco AI',    // Panel title
		vscode.ViewColumn.One,    // Display in the first editor column
		{ enableScripts: true }   // Enable JavaScript in the webview
	);

	// Simple HTML content for the welcome page
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

/**
 * Called when the extension is activated.
 * Sets up the status manager, UI components, commands, and timers.
 * @param context The extension context provided by VSCode.
 */
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

	// Initialize the floating controls panel
	floatingControlsPanel = new FloatingControlsPanel(context);

	// Register command to show floating controls
	context.subscriptions.push(
		vscode.commands.registerCommand('marco.showFloatingControls', () => {
			if (floatingControlsPanel) {
				floatingControlsPanel.show();
			}
		})
	);

	// Auto-show floating controls panel on activation
	floatingControlsPanel.show();

	// Register commands from the dedicated registrar
	CommandRegistrar.registerCommands(context);

	// Set up monitoring service
	MonitoringService.initialize(context);

	// Register welcome page command
	context.subscriptions.push(
		vscode.commands.registerCommand('marco.showWelcome', () => showWelcomePage(context))
	);

	// Show welcome page only on first activation
	const hasShownWelcome = context.globalState.get('marco.hasShownWelcome');
	if (!hasShownWelcome) {
		showWelcomePage(context);
		context.globalState.update('marco.hasShownWelcome', true);
	}

	// Notify user
	vscode.window.showInformationMessage('Marco AI is ready to help!');
}

/**
 * Called when the extension is deactivated.
 * Cleans up resources like the floating controls panel and timers.
 */
export function deactivate() {
	console.log('Marco AI extension is now deactivated');

	// Clean Up Resources
	// Dispose of the floating controls panel if it exists
	if (floatingControlsPanel) {
		floatingControlsPanel.dispose();
		floatingControlsPanel = undefined;
	}

	// Clear any active monitoring timers
	MonitoringService.clearMonitoringTimers();

	// Dispose of the status manager
	const statusManager = StatusManager.getInstance();
	statusManager.dispose();
}