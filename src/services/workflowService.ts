/**
 * Workflow service implementation
 */

import * as vscode from 'vscode';
import { IWorkflowService, IEnvironmentService } from '../core/interfaces';
import { StatusManager, WorkflowState } from '../statusManager';

/**
 * Workflow state management
 */
interface WorkflowStateData {
  running: boolean;
  paused: boolean;
  workflowPromise: Promise<void> | null;
  iterationCount: number;
  backgroundMode: boolean;
}

/**
 * Implements the workflow service
 */
export class WorkflowService implements IWorkflowService {
  private state: WorkflowStateData = {
    running: false,
    paused: false,
    workflowPromise: null,
    iterationCount: 0,
    backgroundMode: false
  };

  // Error class for workflow cancellation
  private readonly WorkflowCancelledError = class extends Error {
    constructor() {
      super('Workflow cancelled');
      this.name = 'WorkflowCancelledError';
    }
  };

  constructor(private environmentService: IEnvironmentService) {}

  /**
   * Starts or restarts a workflow
   * @param context VS Code extension context
   * @param action The action to perform (play, restart, continue)
   */
  async startWorkflow(context: vscode.ExtensionContext, action: string): Promise<void> {
    const statusManager = StatusManager.getInstance();
    
    switch (action) {
      case 'play':
        if (this.isWorkflowRunning()) {
          return; // Already running
        }

        this.setRunningStatus(true);
        this.setPausedStatus(false);
        this.resetIterationCount();

        // Get environment configuration
        const environmentConfig = this.environmentService.getEnvironmentConfig();
        this.setBackgroundMode(environmentConfig.backgroundMode || false);

        // Show notification if starting in background mode
        if (this.state.backgroundMode) {
          vscode.window.showInformationMessage(`Marco AI workflow starting in background mode using ${this.environmentService.name} environment.`);
        }

        // Start the workflow in the background
        this.setWorkflowPromise((async () => {
          try {
            await this.initialSetup(context);
            await this.developmentWorkflow(context);

            // Mark as completed
            statusManager.setState(WorkflowState.Completed, "Workflow completed successfully");
            this.setRunningStatus(false);
          } catch (error) {
            if (error instanceof this.WorkflowCancelledError) {
              // This is expected when workflow is stopped
              statusManager.setState(WorkflowState.Idle, "Workflow stopped");
            } else {
              console.error('Workflow error:', error);
              statusManager.setState(WorkflowState.Error, `Workflow failed: ${error}`);
            }
            this.setRunningStatus(false);
            this.setPausedStatus(false);
          }
        })());
        break;

      case 'restart':
        // Stop any current workflow
        await this.stopWorkflow();

        // Wait a moment before restarting
        await new Promise(resolve => setTimeout(resolve, 500));

        // Start from the beginning
        await this.startWorkflow(context, 'play');
        break;

      case 'continue':
        // Continue the development workflow with another iteration
        if (!this.isWorkflowRunning()) {
          // If workflow isn't running, start it
          await this.startWorkflow(context, 'play');
        } else if (this.isWorkflowPaused()) {
          // If paused, resume it
          this.resumeWorkflow(context);
        } else {
          // Continue with next iteration
          await this.continueDevelopment(context);
        }
        break;
    }
  }

  /**
   * Pauses the current workflow
   */
  pauseWorkflow(): void {
    if (!this.isWorkflowRunning() || this.isWorkflowPaused()) {
      return;
    }

    this.setPausedStatus(true);
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Paused, "Workflow paused");
  }

  /**
   * Resumes the paused workflow
   */
  resumeWorkflow(context: vscode.ExtensionContext): void {
    if (!this.isWorkflowRunning() || !this.isWorkflowPaused()) {
      return;
    }

    this.setPausedStatus(false);
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Initializing, "Workflow resumed");
  }

  /**
   * Stops the current workflow
   */
  async stopWorkflow(): Promise<void> {
    if (!this.isWorkflowRunning()) {
      return;
    }

    this.setRunningStatus(false);
    this.setPausedStatus(false);

    // Reset current workflow
    this.setWorkflowPromise(null);
    // Reset iteration count when stopping
    this.resetIterationCount();

    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Idle, "Workflow stopped");
  }

  /**
   * Checks if a workflow is currently running
   */
  isWorkflowRunning(): boolean {
    return this.state.running;
  }

  /**
   * Checks if the workflow is paused
   */
  isWorkflowPaused(): boolean {
    return this.state.paused;
  }

  /**
   * Helper to check if the workflow should continue
   * Throws WorkflowCancelledError if the workflow is no longer running
   */
  private async checkContinue(): Promise<void> {
    if (!this.isWorkflowRunning()) {
      throw new this.WorkflowCancelledError();
    }
    
    // If paused, wait until resumed
    while (this.isWorkflowPaused()) {
      await new Promise(resolve => setTimeout(resolve, 500));
      // Check again if still running
      if (!this.isWorkflowRunning()) {
        throw new this.WorkflowCancelledError();
      }
    }
  }

  /**
   * Performs the initial setup phase of the workflow
   */
  private async initialSetup(context: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Initializing, "Setting up environment");

    try {
      // Check for cancellation
      await this.checkContinue();

      // 1) Open chat using our environment service
      const shouldFocusChat = !this.state.backgroundMode;
      await this.environmentService.openChat();

      // Get user's task description from context or use default
      const userInput = context.workspaceState.get('marco.userInput');
      const taskDescription = typeof userInput === 'string'
        ? userInput
        : 'Starting Marco AI automation process. I will help automate your workflow.';

      // 2) Set the agent mode based on configuration
      const envConfig = this.environmentService.getEnvironmentConfig();
      const agentMode = envConfig.agentMode || 'Agent';

      statusManager.setState(WorkflowState.SendingTask, "Setting agent mode");
      await this.environmentService.sendChatMessage(`I'll be working in ${agentMode} mode for this task.`, this.state.backgroundMode);

      // 3) Select preferred LLM model from configuration
      const preferredModels = envConfig.preferredModels || [];

      if (preferredModels.length > 0) {
        statusManager.setState(WorkflowState.SendingTask, "Selecting optimal AI model");

        // Try to select the first preferred model
        let modelSelected = false;
        for (const model of preferredModels) {
          if (await this.environmentService.selectAIModel(model)) {
            modelSelected = true;
            break;
          }
        }

        // Inform about preferred models via message
        const modelPriorityMessage = `I'll be using the most capable model available in this priority order: ${preferredModels.join(' > ')}.`;
        await this.environmentService.sendChatMessage(modelPriorityMessage, this.state.backgroundMode);
      }

      await this.checkContinue();

      // 4) Send initial instructions
      statusManager.setState(WorkflowState.SendingTask, "Sending initial instructions");
      await this.environmentService.sendChatMessage(taskDescription, this.state.backgroundMode);

      // 5) Branch creation if configured
      const config = vscode.workspace.getConfiguration('marco');
      const initCreateBranch = config.get<boolean>('initCreateBranch');
      if (initCreateBranch) {
        statusManager.setState(WorkflowState.CreatingBranch, "Creating new branch");
        await this.environmentService.createBranch();
      }

      // 6) Send workflow checklist
      statusManager.setState(WorkflowState.SendingChecklist, "Sending workflow checklist");
      const checklistPrompt = await this.environmentService.loadPrompt(context, 'workflow_checklist');
      await this.environmentService.sendChatMessage(checklistPrompt, this.state.backgroundMode);

      // Allow time for agent to process
      await new Promise(resolve => setTimeout(resolve, 3000));
      await this.checkContinue();

    } catch (error: any) {
      if (error.name === 'WorkflowCancelledError') {
        throw error;
      }

      statusManager.setState(WorkflowState.Error, `Setup error: ${error}`);
      throw error;
    }
  }

  /**
   * Performs the development workflow phase
   */
  private async developmentWorkflow(context: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    const iterationMessage = this.state.iterationCount > 0 ? ` (Iteration ${this.state.iterationCount})` : '';

    try {
      await this.checkContinue();

      // 1) Ask agent to start implementation
      statusManager.setState(WorkflowState.Implementing, `Starting implementation${iterationMessage}`);
      
      // Load implementation prompt
      const implementPrompt = await this.environmentService.loadPrompt(context, 'implement');
      await this.environmentService.sendChatMessage(`@agent ${implementPrompt}`, this.state.backgroundMode);

      // Allow time for agent to respond
      await new Promise(resolve => setTimeout(resolve, 6000));
      await this.checkContinue();

      // 2) Verify completion of checklist
      statusManager.setState(WorkflowState.VerifyingChecklist, `Verifying checklist completion${iterationMessage}`);

      // Load check_checklist prompt
      const checkChecklistPrompt = await this.environmentService.loadPrompt(context, 'check_checklist');
      await this.environmentService.sendChatMessage(`@agent ${checkChecklistPrompt}`, this.state.backgroundMode);

      // Allow time for agent to respond
      await new Promise(resolve => setTimeout(resolve, 6000));

      // 3) Loop back or continue based on checklist status
      const continueToNextIteration = await this.shouldContinueToNextIteration(context);
      if (continueToNextIteration) {
        this.incrementIterationCount();
        statusManager.setState(WorkflowState.ContinuingIteration, `Starting iteration ${this.state.iterationCount}`);

        // Load continue_iteration prompt
        const continueIterationPrompt = await this.environmentService.loadPrompt(context, 'continue_iteration');
        await this.environmentService.sendChatMessage(`@agent ${continueIterationPrompt}`, this.state.backgroundMode);

        // Allow time for agent to process
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Loop back to start of development workflow
        await this.developmentWorkflow(context);
      } else {
        // Workflow completed
        statusManager.setState(WorkflowState.Completed, 'Development workflow completed');
      }
    } catch (error: any) {
      if (error.name === 'WorkflowCancelledError') {
        throw error;
      }

      statusManager.setState(WorkflowState.Error, `Development workflow error: ${error}`);
      throw error;
    }
  }

  /**
   * Continue the development workflow with another iteration
   */
  private async continueDevelopment(context: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();

    try {
      // Check for cancellation
      await this.checkContinue();

      // Increment the iteration count
      this.incrementIterationCount();

      // Update status
      statusManager.setState(WorkflowState.SendingTask, `Starting iteration #${this.state.iterationCount}`);

      // Load the continue iteration prompt
      const continuePrompt = await this.environmentService.loadPrompt(context, 'continue_iteration');

      // Send the continue prompt
      await this.environmentService.sendChatMessage(`@agent Continue: "${continuePrompt}"`, this.state.backgroundMode);

      // Allow time for agent to respond
      await new Promise(resolve => setTimeout(resolve, 4000));
      await this.checkContinue();

      // Resume normal development workflow
      await this.developmentWorkflow(context);

    } catch (error: any) {
      if (error.name === 'WorkflowCancelledError') {
        throw error;
      }

      statusManager.setState(WorkflowState.Error, "Failed to continue development iteration");
      throw error;
    }
  }

  /**
   * Determines whether to continue to the next iteration
   */
  private async shouldContinueToNextIteration(context: vscode.ExtensionContext): Promise<boolean> {
    // This could be enhanced with more sophisticated logic
    // For now, just check if we've exceeded a maximum number of iterations
    const config = vscode.workspace.getConfiguration('marco');
    const maxIterations = config.get<number>('maxIterations') || 3;
    
    return this.state.iterationCount < maxIterations - 1;
  }

  /**
   * State management helpers
   */
  private setRunningStatus(isRunning: boolean): void {
    this.state.running = isRunning;
  }

  private setPausedStatus(isPaused: boolean): void {
    this.state.paused = isPaused;
  }

  private setWorkflowPromise(promise: Promise<void> | null): void {
    this.state.workflowPromise = promise;
  }

  private resetIterationCount(): void {
    this.state.iterationCount = 0;
  }

  private incrementIterationCount(): void {
    this.state.iterationCount++;
  }

  private setBackgroundMode(backgroundMode: boolean): void {
    this.state.backgroundMode = backgroundMode;
  }
}
