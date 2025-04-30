import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { sleep, WorkflowCancelledError } from '../utils/helpers';
import { AgentManager } from './agentManager';
import { GitManager } from './gitManager';
import { PromptManager } from './promptManager';

/**
 * Error type for agent model errors that require switching models
 */
export class AgentModelError extends Error {
    constructor(message = 'Agent model error occurred') {
        super(message);
        this.name = 'AgentModelError';
    }
}

/**
 * Core workflow engine implementing the Marco AI abstracted workflow
 */
export class WorkflowEngine {
    private static instance: WorkflowEngine;
    private isRunning: boolean = false;
    private isPaused: boolean = false;
    private iterationCount: number = 0;
    private agentManager: AgentManager;
    private promptManager: PromptManager;
    private statusManager: StatusManager;
    private gitManager: GitManager;
    private currentModelIndex: number = 0;
    private preferredModels: string[] = [];

    private constructor() {
        this.agentManager = AgentManager.getInstance();
        this.promptManager = PromptManager.getInstance();
        this.statusManager = StatusManager.getInstance();
        this.gitManager = GitManager.getInstance();
    }

    /**
     * Get the singleton instance of WorkflowEngine
     */
    public static getInstance(): WorkflowEngine {
        if (!WorkflowEngine.instance) {
            WorkflowEngine.instance = new WorkflowEngine();
        }
        return WorkflowEngine.instance;
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
     * Get the current iteration count
     */
    public getIterationCount(): number {
        return this.iterationCount;
    }

    /**
     * Check if the agent appears to be idle
     */
    public isAgentIdle(): boolean {
        if (!this.isRunning || this.isPaused) {
            return false;
        }

        // Get idle timeout from configuration
        const config = vscode.workspace.getConfiguration('marco');
        const idleTimeoutSeconds = config.get<number>('idleTimeoutSeconds', 30);

        return this.agentManager.isIdle(idleTimeoutSeconds);
    }

    /**
     * Handles agent response errors by trying to switch to the next preferred model
     * @returns True if successfully switched models, false if no more models to try
     */
    public async handleAgentError(): Promise<boolean> {
        // If we don't have any models configured or have tried them all, we can't switch
        if (this.preferredModels.length === 0 || this.currentModelIndex >= this.preferredModels.length - 1) {
            return false;
        }

        // Try the next model in the list
        this.currentModelIndex++;
        const nextModel = this.preferredModels[this.currentModelIndex];

        this.statusManager.setState(WorkflowState.Initializing, `Switching to model: ${nextModel}`);

        // Attempt to select the next model
        if (await this.agentManager.selectModel(nextModel)) {
            // Inform that we switched models
            const switchPrompt = await this.promptManager.getPrompt('model_switch.md');
            await this.agentManager.sendChatMessage(
                switchPrompt.replace('{{model}}', nextModel)
            );

            return true;
        }

        return false;
    }

    /**
     * Pause the current workflow
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
     * @param context VS Code extension context
     */
    public resumeWorkflow(context: vscode.ExtensionContext): void {
        if (!this.isRunning || !this.isPaused) {
            return;
        }

        this.isPaused = false;
        this.statusManager.setState(WorkflowState.Initializing, "Workflow resumed");
    }

    /**
     * Stop the current workflow
     */
    public async stopWorkflow(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        this.isPaused = false;
        this.iterationCount = 0;
        this.currentModelIndex = 0;

        this.statusManager.setState(WorkflowState.Idle, "Workflow stopped");
    }

    /**
     * Set whether to run in background mode
     * @param enabled Whether background mode should be enabled
     */
    public setBackgroundMode(enabled: boolean): void {
        this.agentManager.setBackgroundMode(enabled);
    }

    /**
     * Run the workflow with the specified action
     * @param context VS Code extension context
     * @param action Action to perform (play, restart, etc.)
     */
    public async runWorkflow(context: vscode.ExtensionContext, action: string): Promise<void> {
        switch (action) {
            case 'play':
                if (this.isRunning) {
                    return; // Already running
                }

                this.isRunning = true;
                this.isPaused = false;
                this.iterationCount = 0;
                this.currentModelIndex = 0;

                // Get background mode setting
                const config = vscode.workspace.getConfiguration('marco');
                const backgroundMode = config.get<boolean>('backgroundMode', false);
                this.setBackgroundMode(backgroundMode);

                try {
                    // Removed ensureChatOpen from here - focus handled by sendChatMessage

                    await this.initialSetup(context);
                    await this.developmentWorkflow(context);
                    this.statusManager.setState(WorkflowState.Completed, "Workflow completed successfully");
                } catch (error) {
                    if (error instanceof WorkflowCancelledError) {
                        this.statusManager.setState(WorkflowState.Idle, "Workflow stopped");
                    } else if (error instanceof AgentModelError) {
                        // Try to handle agent model error
                        if (await this.handleAgentError()) {
                            // If successfully switched models, resume workflow
                            this.statusManager.setState(WorkflowState.Initializing, "Resuming workflow with new model");
                            await this.developmentWorkflow(context);
                        } else {
                            // Failed to switch models
                            console.error('Failed to switch models after error:', error);
                            this.statusManager.setState(WorkflowState.Error, `All models failed. Workflow stopped.`);
                        }
                    } else {
                        console.error('Workflow error:', error);
                        this.statusManager.setState(WorkflowState.Error, `Workflow failed: ${error}`);
                    }
                } finally {
                    this.isRunning = false;
                    this.isPaused = false;
                }
                break;

            case 'restart':
                await this.stopWorkflow();
                await sleep(500);
                // Removed ensureChatOpen from here - focus handled by sendChatMessage
                await this.runWorkflow(context, 'play');
                break;
        }
    }

    /**
     * Check if the workflow should continue or throw if cancelled/paused
     */
    private async checkContinue(): Promise<void> {
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

    /**
     * Initial setup phase of the workflow
     * @param context VS Code extension context
     */
    private async initialSetup(context: vscode.ExtensionContext): Promise<void> {
        this.statusManager.setState(WorkflowState.Initializing, "Setting up environment");

        try {
            // 1. Launch Program / Initialize Interaction - Chat already ensured open in runWorkflow
            await this.checkContinue();

            // 2. Set Agent Mode 
            const config = vscode.workspace.getConfiguration('marco');
            const agentMode = config.get<string>('agentMode', 'Agent');

            this.statusManager.setState(WorkflowState.SendingTask, "Setting agent mode");
            // Load agent mode prompt from file
            const agentModePrompt = await this.promptManager.getPrompt('agent_mode.md');
            await this.agentManager.sendChatMessage(agentModePrompt.replace('{{agent_mode}}', agentMode));

            // 3. Select Agent LLM
            this.preferredModels = config.get<string[]>('preferredModels') ||
                ["Claude 3.7 Sonnet", "Gemini 2.5", "GPT 4.1"];

            if (this.preferredModels.length > 0) {
                this.statusManager.setState(WorkflowState.SendingTask, "Selecting optimal AI model");

                // Try models in order of preference
                let modelSelected = false;
                for (const model of this.preferredModels) {
                    if (await this.agentManager.selectModel(model)) {
                        modelSelected = true;
                        // Set the current model index to the one selected
                        this.currentModelIndex = this.preferredModels.indexOf(model);
                        break;
                    }
                }

                // Load model selection prompt
                const modelPrompt = await this.promptManager.getPrompt('model_selection.md');
                await this.agentManager.sendChatMessage(
                    modelPrompt.replace('{{models}}', this.preferredModels.join(' > '))
                );
            }

            await this.checkContinue();

            // 4. Branch creation if configured
            const initCreateBranch = config.get<boolean>('initCreateBranch', false);
            if (initCreateBranch) {
                this.statusManager.setState(WorkflowState.CreatingBranch, "Creating new branch");
                const branchName = await this.gitManager.createAndCheckoutBranch();
                if (branchName) {
                    // Load branch created prompt
                    const branchPrompt = await this.promptManager.getPrompt('branch_created.md');
                    await this.agentManager.sendChatMessage(
                        branchPrompt.replace('{{branch_name}}', branchName)
                    );
                }
                await sleep(2000);
            }

        } catch (error) {
            if (error instanceof WorkflowCancelledError) {
                throw error;
            }

            // Check if it's a model error that we can recover from
            if (error instanceof AgentModelError) {
                // Let the higher level handle it
                throw error;
            }

            this.statusManager.setState(WorkflowState.Error, "Setup failed");
            throw error;
        }
    }

    /**
     * Development workflow phase
     * @param context VS Code extension context
     */
    private async developmentWorkflow(context: vscode.ExtensionContext): Promise<void> {
        const config = vscode.workspace.getConfiguration('marco');

        try {
            await this.checkContinue();

            // 1. Send Task (PROMPT)
            const iterationSuffix = this.iterationCount > 0 ? ` (iteration #${this.iterationCount})` : '';
            this.statusManager.setState(WorkflowState.SendingTask, `Sending development checklist${iterationSuffix}`);

            const initPrompt = await this.promptManager.getPrompt('init.md');
            await this.agentManager.sendChatMessage(`@agent ${initPrompt}`);

            // Send checklist
            const checklist = await this.promptManager.getPrompt('checklist.md');
            await this.agentManager.sendChatMessage(checklist);

            // Allow time for agent to process
            await sleep(2000);
            await this.checkContinue();

            // 2. Check Agent Status (PROMPT)
            this.statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress${iterationSuffix}`);

            const checkAgentPrompt = await this.promptManager.getPrompt('check_agent.md');
            await this.agentManager.sendChatMessage(`@agent ${checkAgentPrompt}`);

            // Allow time for agent to respond
            await sleep(3000);
            await this.checkContinue();

            // 3. Request Tests (Conditional PROMPT)
            const needToWriteTest = config.get<boolean>('needToWriteTest', false);
            if (needToWriteTest) {
                this.statusManager.setState(WorkflowState.RequestingTests, `Requesting test implementation${iterationSuffix}`);

                const writeTestsPrompt = await this.promptManager.getPrompt('write_tests.md');
                await this.agentManager.sendChatMessage(`@agent ${writeTestsPrompt}`);

                // Allow time for agent to process
                await sleep(3000);
                await this.checkContinue();

                // Check status again
                this.statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress on tests${iterationSuffix}`);
                const testProgressPrompt = await this.promptManager.getPrompt('test_progress.md');
                await this.agentManager.sendChatMessage(`@agent ${testProgressPrompt}`);

                // Allow time for agent to respond
                await sleep(3000);
                await this.checkContinue();
            }

            // 4. Verify Checklist Completion (PROMPT)
            this.statusManager.setState(WorkflowState.VerifyingChecklist, `Verifying checklist completion${iterationSuffix}`);

            const checkChecklistPrompt = await this.promptManager.getPrompt('check_checklist.md');
            await this.agentManager.sendChatMessage(`@agent ${checkChecklistPrompt}`);

            // Allow time for agent to respond
            await sleep(3000);

            // 5. Loop back or continue based on checklist status
            const continueToNextIteration = await this.shouldContinueToNextIteration();
            if (continueToNextIteration) {
                this.iterationCount++;
                this.statusManager.setState(WorkflowState.ContinuingIteration, `Starting iteration ${this.iterationCount}`);

                const continueIterationPrompt = await this.promptManager.getPrompt('continue_iteration.md');
                await this.agentManager.sendChatMessage(`@agent ${continueIterationPrompt}`);

                // Allow time for agent to process
                await sleep(3000);

                // Loop back to start of development workflow
                await this.developmentWorkflow(context);
            } else {
                // Workflow completed
                this.statusManager.setState(WorkflowState.Completed, 'Development workflow completed');
            }
        } catch (error) {
            if (error instanceof WorkflowCancelledError) {
                throw error;
            }

            // Check if it's a model error that we can recover from
            if (error instanceof AgentModelError) {
                // Let the higher level handle it
                throw error;
            }

            this.statusManager.setState(WorkflowState.Error, `Development workflow error: ${error}`);
            throw error;
        }
    }

    /**
     * Determines if the workflow should continue to the next iteration
     * @returns Promise resolving to true if the workflow should continue, false otherwise
     */
    private async shouldContinueToNextIteration(): Promise<boolean> {
        // Get prompt for querying completion status
        const completionPrompt = await this.promptManager.getPrompt('completion_check.md');
        await this.agentManager.sendChatMessage(completionPrompt);

        // This is a simplified placeholder implementation
        // In a real implementation, we would analyze the agent's response
        // For demonstration, we'll loop at least once
        return this.iterationCount === 0;
    }
}