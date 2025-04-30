import * as vscode from 'vscode';
import { StatusManager } from './statusManager';
import { AgentMonitor } from './monitoring';
import { StatusBarManager } from './ui/statusBar';
import { registerCommands } from './commands';
import { ModelService } from './services/modelService';

/**
 * Activate the extension
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Marco AI extension is now active');

    // Initialize services
    initializeServices(context);
    
    // Register commands
    registerCommands(context);
    
    // Start monitoring
    const agentMonitor = AgentMonitor.getInstance();
    agentMonitor.startMonitoring(context);
    
    // Show activation message
    vscode.window.showInformationMessage('Marco AI is ready to assist with your workflow!');
}

/**
 * Initialize all services
 * @param context The extension context
 */
function initializeServices(context: vscode.ExtensionContext) {
    // Initialize status manager
    const statusManager = StatusManager.getInstance();
    statusManager.initialize(context);
    
    // Initialize status bar
    const statusBarManager = StatusBarManager.getInstance();
    statusBarManager.initialize(context);
    
    // Initialize model service and try to select preferred model
    const modelService = ModelService.getInstance();
    modelService.selectPreferredModel().then(model => {
        if (model) {
            console.log(`Using AI model: ${model}`);
        } else {
            console.log('Failed to select preferred AI model');
        }
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