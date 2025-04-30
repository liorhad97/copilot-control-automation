import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { initialSetup } from '../workflows/initialSetup';
import { developmentWorkflow } from '../workflows/developmentWorkflow';
import { ensureChatOpen, sendChatMessage } from '../utils/chatUtils';

/**
 * WorkflowManager handles all workflow-related operations
 * It provides a simple interface to start, pause, stop, and restart workflows
 */
export class WorkflowManager {
    private static instance: WorkflowManager;
    private statusManager: StatusManager;
    private currentWorkflow: WorkflowState = WorkflowState.Idle;
    
    private constructor() {
        this.statusManager = StatusManager.getInstance();
    }
    
    /**
     * Get the singleton instance of WorkflowManager
     */
    public static getInstance(): WorkflowManager {
        if (!WorkflowManager.instance) {
            WorkflowManager.instance = new WorkflowManager();
        }
        return WorkflowManager.instance;
    }
    
    /**
     * Execute a workflow action (play, pause, stop, restart)
     * @param context Extension context
     * @param action The action to perform
     */
    public async executeAction(context: vscode.ExtensionContext, action: string): Promise<void> {
        switch (action) {
            case 'play':
                await this.startWorkflow(context);
                break;
                
            case 'pause':
                await this.pauseWorkflow();
                break;
                
            case 'stop':
                await this.stopWorkflow();
                break;
                
            case 'restart':
                await this.restartWorkflow(context);
                break;
                
            default:
                vscode.window.showErrorMessage(`Unknown workflow action: ${action}`);
        }
    }
    
    /**
     * Start the workflow
     * @param context Extension context
     */
    private async startWorkflow(context: vscode.ExtensionContext): Promise<void> {
        try {
            // Update status
            this.statusManager.setState(WorkflowState.Initializing, "Starting workflow");
            this.currentWorkflow = WorkflowState.Initializing;
            
            // Run initial setup
            await initialSetup(context);
            
            // Run development workflow
            await developmentWorkflow(context);
            
            // Mark as completed
            this.currentWorkflow = WorkflowState.Completed;
        } catch (error) {
            // Handle errors
            this.statusManager.setState(WorkflowState.Error, `Workflow failed: ${error}`);
            this.currentWorkflow = WorkflowState.Error;
            console.error('Workflow failed:', error);
        }
    }
    
    /**
     * Pause the current workflow
     */
    private async pauseWorkflow(): Promise<void> {
        // Only pause if we're in an active state
        if (this.isActiveWorkflow()) {
            this.statusManager.setState(WorkflowState.Paused, "Workflow paused");
            this.currentWorkflow = WorkflowState.Paused;
            await vscode.window.showInformationMessage('Marco AI workflow paused');
        } else if (this.currentWorkflow === WorkflowState.Paused) {
            // Resume if already paused
            this.statusManager.setState(WorkflowState.SendingTask, "Workflow resumed");
            this.currentWorkflow = WorkflowState.SendingTask;
            await vscode.window.showInformationMessage('Marco AI workflow resumed');
        } else {
            await vscode.window.showInformationMessage('No active workflow to pause');
        }
    }
    
    /**
     * Stop the current workflow
     */
    private async stopWorkflow(): Promise<void> {
        this.statusManager.setState(WorkflowState.Idle, "Workflow stopped");
        this.currentWorkflow = WorkflowState.Idle;
        await vscode.window.showInformationMessage('Marco AI workflow stopped');
    }
    
    /**
     * Restart the workflow
     * @param context Extension context
     */
    private async restartWorkflow(context: vscode.ExtensionContext): Promise<void> {
        try {
            // Update status
            this.statusManager.setState(WorkflowState.Initializing, "Restarting workflow");
            this.currentWorkflow = WorkflowState.Initializing;
            
            // Show notification
            vscode.window.showInformationMessage('Restarting Marco AI workflow...');
            
            // Ensure chat is open and send restart message
            await ensureChatOpen();
            await sendChatMessage('Marco AI workflow has been restarted. Starting fresh...');
            
            // Run workflows
            await initialSetup(context);
            await developmentWorkflow(context);
            
            // Mark as completed
            this.currentWorkflow = WorkflowState.Completed;
        } catch (error) {
            // Handle errors
            this.statusManager.setState(WorkflowState.Error, "Failed to restart workflow");
            this.currentWorkflow = WorkflowState.Error;
            vscode.window.showErrorMessage(`Failed to restart workflow: ${error}`);
        }
    }
    
    /**
     * Check if there is an active workflow running
     * @returns True if there is an active workflow
     */
    public isActiveWorkflow(): boolean {
        return this.currentWorkflow !== WorkflowState.Idle && 
               this.currentWorkflow !== WorkflowState.Paused &&
               this.currentWorkflow !== WorkflowState.Error &&
               this.currentWorkflow !== WorkflowState.Completed;
    }
    
    /**
     * Get the current workflow state
     * @returns The current workflow state
     */
    public getCurrentWorkflow(): WorkflowState {
        return this.currentWorkflow;
    }
    
    /**
     * Check if the agent appears to be idle
     * @returns True if the agent appears idle
     */
    public isAgentIdle(): boolean {
        // Skip idle check if not in an active workflow
        if (!this.isActiveWorkflow()) {
            return false;
        }
        
        // Check based on last activity time
        const lastActivityTime = this.statusManager.getLastUpdateTime();
        if (!lastActivityTime) {
            return false;
        }
        
        // Get idle timeout from config
        const config = vscode.workspace.getConfiguration('marco');
        const idleTimeoutMs = config.get<number>('idleTimeoutSeconds', 30) * 1000;
        
        // Check if time since last activity exceeds the threshold
        const timeSinceLastActivity = Date.now() - lastActivityTime.getTime();
        return timeSinceLastActivity > idleTimeoutMs;
    }
}