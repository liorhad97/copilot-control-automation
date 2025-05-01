import * as vscode from 'vscode';
import { WorkflowCancelledError } from '../errors/WorkflowErrors';
import { StatusManager, WorkflowState } from './StatusManager';
import { WorkflowCommandExecutor } from './WorkflowCommandExecutor';
import { ConfigurationManager } from './ConfigurationManager';
import { sleep } from '../utils/Helpers';

/**
 * Manages workflow state and coordinates workflow execution
 */
export class WorkflowManager {
  private static instance: WorkflowManager;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private backgroundMode: boolean = false;
  private iterationCount: number = 0;
  private currentWorkflowPromise: Promise<void> | null = null;
  private workflowExecutor: WorkflowCommandExecutor | null = null;
  private configManager: ConfigurationManager;
  private statusManager: StatusManager;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.configManager = ConfigurationManager.getInstance();
    this.statusManager = StatusManager.getInstance();
  }

  /**
   * Get the singleton instance of WorkflowManager
   * @param context The extension context
   */
  public static getInstance(context?: vscode.ExtensionContext): WorkflowManager {
    if (!WorkflowManager.instance) {
      WorkflowManager.instance = new WorkflowManager();
      
      if (context) {
        WorkflowManager.instance.workflowExecutor = new WorkflowCommandExecutor(context);
      }
    } else if (context && !WorkflowManager.instance.workflowExecutor) {
      // If the instance exists but executor doesn't, initialize it
      WorkflowManager.instance.workflowExecutor = new WorkflowCommandExecutor(context);
    }
    
    return WorkflowManager.instance;
  }

  /**
   * Check if the workflow is currently running
   */
  public isWorkflowRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if the workflow is currently paused
   */
  public isWorkflowPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Check if the workflow is running in background mode
   */
  public isBackgroundMode(): boolean {
    return this.backgroundMode;
  }

  /**
   * Set whether the workflow should run in background mode
   * @param enabled Whether background mode should be enabled
   */
  public setBackgroundMode(enabled: boolean): void {
    this.backgroundMode = enabled;
  }

  /**
   * Get the current iteration count
   */
  public getIterationCount(): number {
    return this.iterationCount;
  }

  /**
   * Run the workflow with the specified action
   * @param context The extension context
   * @param action The action to perform (play, pause, stop, restart, continue)
   */
  public async runWorkflow(context: vscode.ExtensionContext, action: string): Promise<void> {
    // Ensure we have a workflow executor
    if (!this.workflowExecutor) {
      this.workflowExecutor = new WorkflowCommandExecutor(context);
    }
    
    switch (action) {
      case 'play':
        await this.startWorkflow(context);
        break;
        
      case 'restart':
        await this.restartWorkflow(context);
        break;
        
      case 'continue':
        await this.continueWorkflow(context);
        break;
    }
  }

  /**
   * Start a new workflow
   */
  private async startWorkflow(context: vscode.ExtensionContext): Promise<void> {
    if (this.isRunning) {
      return; // Already running
    }

    this.isRunning = true;
    this.isPaused = false;
    this.iterationCount = 0;

    // Store iteration count in context
    context.workspaceState.update('marco.iterationCount', this.iterationCount);

    // Get background mode setting
    this.backgroundMode = this.configManager.getBackgroundMode();

    // Show notification if starting in background mode
    if (this.backgroundMode) {
      vscode.window.showInformationMessage(
        'Marco AI workflow starting in background mode. The chat will be minimized when possible.'
      );
    }

    // Start the workflow in the background
    this.currentWorkflowPromise = (async () => {
      try {
        await this.workflowExecutor!.executeInitialSetup(this.backgroundMode);
        await this.workflowExecutor!.executeDevelopmentWorkflow(this.backgroundMode, this.iterationCount);

        // Mark as completed
        this.statusManager.setState(WorkflowState.Completed, "Workflow completed successfully");
        this.isRunning = false;
      } catch (error) {
        if (error instanceof WorkflowCancelledError) {
          // This is expected when workflow is stopped
          this.statusManager.setState(WorkflowState.Idle, "Workflow stopped");
        } else {
          console.error('Workflow error:', error);
          this.statusManager.setState(
            WorkflowState.Error, 
            `Workflow failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        this.isRunning = false;
        this.isPaused = false;
      }
    })();
  }

  /**
   * Restart the workflow
   */
  private async restartWorkflow(context: vscode.ExtensionContext): Promise<void> {
    // Stop any current workflow
    await this.stopWorkflow();

    // Wait a moment before restarting
    await sleep(500);

    // Start from the beginning
    await this.startWorkflow(context);
  }

  /**
   * Continue the workflow with another iteration
   */
  private async continueWorkflow(context: vscode.ExtensionContext): Promise<void> {
    if (!this.isRunning) {
      // If workflow isn't running, start it
      await this.startWorkflow(context);
    } else if (this.isPaused) {
      // If paused, resume it
      this.resumeWorkflow();
    } else {
      // Check for cancellation
      await this.checkContinue();

      // Increment the iteration count
      this.iterationCount++;
      
      // Store iteration count in context
      context.workspaceState.update('marco.iterationCount', this.iterationCount);

      // Continue with next iteration
      try {
        await this.workflowExecutor!.executeContinueDevelopment(this.backgroundMode, this.iterationCount);
      } catch (error) {
        if (error instanceof WorkflowCancelledError) {
          throw error;
        }
        
        this.statusManager.setState(
          WorkflowState.Error, 
          `Failed to continue workflow: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    }
  }

  /**
   * Pause the workflow
   */
  public pauseWorkflow(): void {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    this.isPaused = true;
    this.statusManager.setState(WorkflowState.Paused, "Workflow paused");
  }

  /**
   * Resume the paused workflow
   */
  public resumeWorkflow(): void {
    if (!this.isRunning || !this.isPaused) {
      return;
    }

    this.isPaused = false;
    this.statusManager.setState(WorkflowState.Initializing, "Workflow resumed");
  }

  /**
   * Stop the workflow
   */
  public async stopWorkflow(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.isPaused = false;

    // Reset current workflow
    this.currentWorkflowPromise = null;
    
    // Reset iteration count
    this.iterationCount = 0;

    this.statusManager.setState(WorkflowState.Idle, "Workflow stopped");
  }

  /**
   * Check if the workflow should continue or throw if cancelled/paused
   */
  public async checkContinue(): Promise<void> {
    if (!this.isRunning) {
      throw new WorkflowCancelledError();
    }

    // If paused, wait until unpaused
    while (this.isPaused) {
      await sleep(500);

      // Check if cancelled during pause
      if (!this.isRunning) {
        throw new WorkflowCancelledError();
      }
    }
  }
}