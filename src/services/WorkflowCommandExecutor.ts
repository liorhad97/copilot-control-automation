import * as vscode from 'vscode';
import { ConfigurationError, WorkflowCancelledError } from '../errors/WorkflowErrors';
import { ChatUtils } from './ChatUtils';
import { ConfigurationManager } from './ConfigurationManager';
import { GitService } from './GitService';
import { PromptLoader } from './PromptLoader';
import { StatusManager, WorkflowState } from './StatusManager';
import { sleep } from '../utils/Helpers';

/**
 * Responsible for executing workflow commands and operations
 */
export class WorkflowCommandExecutor {
  private context: vscode.ExtensionContext;
  private promptLoader: PromptLoader;
  private statusManager: StatusManager;
  private configManager: ConfigurationManager;

  /**
   * Create a new WorkflowCommandExecutor
   * @param context The extension context
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.promptLoader = new PromptLoader(context);
    this.statusManager = StatusManager.getInstance();
    this.configManager = ConfigurationManager.getInstance();
  }

  /**
   * Wait for the specified time
   * @param ms Time to wait in milliseconds
   */
  public async sleep(ms: number): Promise<void> {
    await sleep(ms);
  }

  /**
   * Performs the initial setup phase of the workflow
   * @param backgroundMode Whether to run in background mode
   */
  public async executeInitialSetup(backgroundMode: boolean): Promise<void> {
    this.statusManager.setState(WorkflowState.Initializing, "Setting up environment");

    try {
      // 1) Open chat
      const shouldFocusChat = !backgroundMode;
      await ChatUtils.ensureChatOpen(5, 1000, shouldFocusChat);

      // 2) Get user's task description from context or use default
      const userInput = this.context.workspaceState.get('marco.userInput');
      const taskDescription = typeof userInput === 'string'
        ? userInput
        : 'Starting Marco AI automation process. I will help automate your workflow.';

      // 3) Set the agent mode message
      const agentMode = this.configManager.getAgentMode();
      this.statusManager.setState(WorkflowState.SendingTask, "Setting agent mode");
      await ChatUtils.sendChatMessage(`I'll be working in ${agentMode} mode for this task.`, backgroundMode);

      // 4) Select preferred LLM model
      const preferredModels = this.configManager.getPreferredModels();

      if (preferredModels.length > 0) {
        this.statusManager.setState(WorkflowState.SendingTask, "Selecting optimal AI model");

        // Try to select the first preferred model
        let modelSelected = false;
        for (const model of preferredModels) {
          if (await ChatUtils.selectAIModel(model)) {
            modelSelected = true;
            break;
          }
        }

        // Inform about preferred models via message
        const modelPriorityMessage = `I'll be using the most capable model available in this priority order: ${preferredModels.join(' > ')}.`;
        await ChatUtils.sendChatMessage(modelPriorityMessage, backgroundMode);
      }

      // 5) Send initial instructions
      this.statusManager.setState(WorkflowState.SendingTask, "Sending initial instructions");
      await ChatUtils.sendChatMessage(taskDescription, backgroundMode);

      // 6) Branch creation if configured
      if (this.configManager.shouldCreateBranch()) {
        this.statusManager.setState(WorkflowState.CreatingBranch, "Creating new branch");
        const branchName = await GitService.createAndCheckoutBranch();
        await ChatUtils.sendChatMessage(`Created new branch '${branchName}' for this feature. Please click Continue when ready.`, backgroundMode);

        // Pause for user to acknowledge branch creation
        await this.sleep(2000);
      }
    } catch (error) {
      if (error instanceof WorkflowCancelledError) {
        throw error;
      }

      this.statusManager.setState(WorkflowState.Error, "Setup failed");
      throw error;
    }
  }

  /**
   * Executes the main development workflow
   * @param backgroundMode Whether to run in background mode
   * @param iterationCount Current iteration count
   */
  public async executeDevelopmentWorkflow(backgroundMode: boolean, iterationCount: number): Promise<void> {
    try {
      // Update status based on iteration count
      const iterationMessage = iterationCount > 0 ? ` (iteration #${iterationCount})` : '';

      // 1) Send development task/checklist
      this.statusManager.setState(WorkflowState.SendingTask, `Sending development checklist${iterationMessage}`);

      // Load init prompt
      const initPrompt = await this.promptLoader.loadPromptFile('init');
      await ChatUtils.sendChatMessage(`@agent ${initPrompt}`, backgroundMode);

      // Send checklist after init prompt
      await this.sendChecklistToChat(backgroundMode);

      // Allow time for agent to process
      await this.sleep(4000);

      // 2) Check agent status after some time
      this.statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress${iterationMessage}`);

      // Load check_agent prompt
      const checkAgentPrompt = await this.promptLoader.loadPromptFile('check_agent');
      await ChatUtils.sendChatMessage(`@agent ${checkAgentPrompt}`, backgroundMode);

      // Allow time for agent to respond
      await this.sleep(6000);

      // 3) Request tests if configured
      if (this.configManager.shouldWriteTests()) {
        await this.executeTestWorkflow(backgroundMode, iterationMessage);
      }

      // 4) Verify completion of checklist
      this.statusManager.setState(WorkflowState.VerifyingChecklist, `Verifying checklist completion${iterationMessage}`);

      // Load check_checklist prompt
      const checkChecklistPrompt = await this.promptLoader.loadPromptFile('check_checklist');
      await ChatUtils.sendChatMessage(`@agent ${checkChecklistPrompt}`, backgroundMode);

      // Allow time for agent to respond
      await this.sleep(6000);

      // 5) Check if we should continue to next iteration
      const continueToNextIteration = await this.shouldContinueToNextIteration();
      
      if (continueToNextIteration) {
        await this.executeContinueDevelopment(backgroundMode, iterationCount + 1);
      } else {
        // Workflow completed
        this.statusManager.setState(WorkflowState.Completed, 'Development workflow completed');
      }
    } catch (error) {
      if (error instanceof WorkflowCancelledError) {
        throw error;
      }

      this.statusManager.setState(WorkflowState.Error, `Development workflow error: ${error}`);
      throw error;
    }
  }

  /**
   * Executes the test writing portion of the workflow
   * @param backgroundMode Whether to run in background mode
   * @param iterationMessage Additional message to append to status messages
   */
  private async executeTestWorkflow(backgroundMode: boolean, iterationMessage: string): Promise<void> {
    this.statusManager.setState(WorkflowState.RequestingTests, `Requesting test implementation${iterationMessage}`);

    // Load write_tests prompt
    const writeTestsPrompt = await this.promptLoader.loadPromptFile('write_tests');
    await ChatUtils.sendChatMessage(`@agent ${writeTestsPrompt}`, backgroundMode);

    // Allow time for agent to process
    await this.sleep(6000);

    // Check status again
    this.statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress on tests${iterationMessage}`);
    
    // Load test progress prompt
    const testProgressPrompt = await this.promptLoader.loadPromptFile('test_progress');
    await ChatUtils.sendChatMessage(`@agent ${testProgressPrompt}`, backgroundMode);

    // Allow time for agent to respond
    await this.sleep(6000);
  }

  /**
   * Continue development with another iteration
   * @param backgroundMode Whether to run in background mode
   * @param iterationCount Current iteration count
   */
  public async executeContinueDevelopment(backgroundMode: boolean, iterationCount: number): Promise<void> {
    try {
      this.statusManager.setState(WorkflowState.ContinuingIteration, `Starting iteration ${iterationCount}`);

      // Load continue_iteration prompt
      const continueIterationPrompt = await this.promptLoader.loadPromptFile('continue_iteration');
      await ChatUtils.sendChatMessage(`@agent ${continueIterationPrompt}`, backgroundMode);

      // Allow time for agent to process
      await this.sleep(6000);

      // Loop back to start of development workflow
      await this.executeDevelopmentWorkflow(backgroundMode, iterationCount);
    } catch (error) {
      if (error instanceof WorkflowCancelledError) {
        throw error;
      }

      this.statusManager.setState(WorkflowState.Error, "Failed to continue development iteration");
      throw error;
    }
  }

  /**
   * Sends the checklist to the chat
   * @param backgroundMode Whether to run in background mode
   */
  private async sendChecklistToChat(backgroundMode: boolean): Promise<void> {
    // Load checklist from prompt file
    const checklist = await this.promptLoader.loadPromptFile('checklist');
    await ChatUtils.sendChatMessage(checklist, backgroundMode);
  }

  /**
   * Determines whether to continue to the next iteration
   * @returns Promise resolving to true if the workflow should continue, false otherwise
   */
  private async shouldContinueToNextIteration(): Promise<boolean> {
    // Check if we've exceeded max iterations
    const maxIterations = this.configManager.getMaxIterations();
    const currentIteration = this.context.workspaceState.get<number>('marco.iterationCount') || 0;

    if (currentIteration >= maxIterations) {
      console.log(`Max iterations (${maxIterations}) reached.`);
      return false;
    }

    // In this implementation, we'll randomly determine whether to continue
    // In a real implementation, this would analyze the agent's response
    return Math.random() < 0.3; // 30% chance to continue to next iteration
  }
}