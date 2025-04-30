import * as vscode from 'vscode';
import { StatusManager } from './statusManager';
import { SidebarProvider } from './ui/sidebarProvider';
import { AgentManager } from './core/agentManager';
import { PromptManager } from './core/promptManager';
import { isAgentIdle, isWorkflowPaused, isWorkflowRunning, pauseWorkflow, resumeWorkflow, runWorkflow, setBackgroundMode, stopWorkflow } from './workflows/workflowManager';

export function activate(context: vscode.ExtensionContext) {
	console.log('Marco AI extension is now active');

	// Initialize status manager
	const statusManager = StatusManager.getInstance();
	statusManager.initialize(context);

	// Preload common prompts
	const promptManager = PromptManager.getInstance();
	promptManager.preloadCommonPrompts().catch(err => {
		console.error('Failed to preload prompts:', err);
	});

	// Create sidebar
	const sidebarProvider = new SidebarProvider(context.extensionUri, context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			"marco-ai.sidebar",
			sidebarProvider
		)
	);

	// Register commands
	registerCommands(context);

	// Set up timers for monitoring
	setupMonitoringTimers(context);

	vscode.window.showInformationMessage('Marco AI is ready to help!');
}

function registerCommands(context: vscode.ExtensionContext) {
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
			const agentManager = AgentManager.getInstance();
			await agentManager.ensureChatOpen(5, 1000, true);
		})
	);

	// Command to open the sidebar
	context.subscriptions.push(
		vscode.commands.registerCommand('marco.openSidebar', () => {
			vscode.commands.executeCommand('marco-ai.sidebar.focus');
		})
	);

	// Command to check if agent is alive/active
	context.subscriptions.push(
		vscode.commands.registerCommand('marco.checkAgentAlive', async () => {
			if (isWorkflowRunning() && !isWorkflowPaused()) {
				const idle = isAgentIdle();
				if (idle) {
					try {
						// Get background mode configuration
						const config = vscode.workspace.getConfiguration('marco');
						const backgroundMode = config.get<boolean>('backgroundMode') || false;

						// Load the idle check prompt
						const promptManager = PromptManager.getInstance();
						const idlePrompt = await promptManager.getPrompt('idle_check.md');

						// Send prompt to idle agent
						const agentManager = AgentManager.getInstance();
						await agentManager.sendChatMessage(idlePrompt, backgroundMode);
					} catch (error) {
						console.error('Error sending idle check prompt:', error);
						// Fall back to hardcoded message if prompt loading fails
						const agentManager = AgentManager.getInstance();
						const config = vscode.workspace.getConfiguration('marco');
						const backgroundMode = config.get<boolean>('backgroundMode') || false;
						await agentManager.sendChatMessage('Are you still working on the task? If you have completed the task, please summarize what you have done.', backgroundMode);
					}
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

function setupMonitoringTimers(context: vscode.ExtensionContext) {
	// Get frequency from configuration
	const config = vscode.workspace.getConfiguration('marco');
	const checkAgentFrequency = config.get<number>('checkAgentFrequency') || 10000;
	const ensureChatFrequency = config.get<number>('ensureChatFrequency') || 300000;

	// Every 10s (or configured time): Check agent alive when workflow is running
	const checkAgentTimer = setInterval(() => {
		if (isWorkflowRunning() && !isWorkflowPaused()) {
			vscode.commands.executeCommand('marco.checkAgentAlive');
		}
	}, checkAgentFrequency);

	// Every 5min (or configured time): Ensure chat open when workflow is running
	const ensureChatTimer = setInterval(async () => {
		if (isWorkflowRunning() && !isWorkflowPaused()) {
			const config = vscode.workspace.getConfiguration('marco');
			const backgroundMode = config.get<boolean>('backgroundMode') || false;

			// Don't focus if in background mode
			const agentManager = AgentManager.getInstance();
			await agentManager.ensureChatOpen(5, 1000, !backgroundMode);
		}
	}, ensureChatFrequency);

	// Clean up timers on deactivation
	context.subscriptions.push({
		dispose: () => {
			clearInterval(checkAgentTimer);
			clearInterval(ensureChatTimer);
		}
	});

	// Watch for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('marco.checkAgentFrequency') ||
				e.affectsConfiguration('marco.ensureChatFrequency')) {

				// Clear existing timers
				clearInterval(checkAgentTimer);
				clearInterval(ensureChatTimer);

				// Set up new timers with updated frequencies
				setupMonitoringTimers(context);
			}
		})
	);
}

export function deactivate() {
	console.log('Marco AI extension is now deactivated');
	
	// Clean up status manager
	const statusManager = StatusManager.getInstance();
	statusManager.dispose();
}