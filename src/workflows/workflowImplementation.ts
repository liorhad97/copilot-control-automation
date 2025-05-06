import * as vscode from 'vscode';
import * as path from 'path';
import { ServiceLocator } from '../adapters/serviceLocator';
import { StatusManager, WorkflowState } from '../statusManager';
import { ensureChatOpen, sendChatMessage } from '../utils/chatUtils';
import { CopilotResponseMonitor } from '../utils/copilotResponseMonitor';
import { validateJsonFile, getWorkspacePath } from '../utils/fileUtils';
import { createAndCheckoutBranch } from '../utils/gitUtils';
import { sleep } from '../utils/helpers';
import { PromptLoader } from '../utils/promptLoader';
import { loadPromptFile, sendChecklistToChat } from './promptUtils';
import { ChecklistService } from './taskDefinition';
import {
    checkContinue,
    getIterationCount,
    incrementIterationCount,
    isBackgroundMode
} from './workflowState';

/**
 * Performs the initial setup phase of the workflow
 * @param context The VS Code extension context
 * @returns Path to the created checklist file
 */
export async function initialSetup(context: vscode.ExtensionContext): Promise<string> {
    const statusManager = StatusManager.getInstance();
    statusManager.setState(WorkflowState.Initializing, "Setting up environment");
    
    // Start monitoring Copilot responses for interactive elements
    // Not needed here - already started in workflowManager.ts
    // const responseMonitor = CopilotResponseMonitor.getInstance();
    // responseMonitor.startMonitoring(context);

    try {
        // Check for cancellation
        await checkContinue();

        // I. INITIALIZATION PHASE

        // Program Launch & UI Activation - handled by the StatusManager
        console.log("Program Launch & UI Activation completed");

        // Establish Agent Interface
        console.log("Establishing agent interface");
        await ensureChatOpen(5, 1000, !isBackgroundMode());

        // Configure Agent Mode (only 'Agent' mode is supported)
        console.log("Configuring Agent Mode");
        statusManager.setState(WorkflowState.SendingTask, "Configuring Agent Mode");

        // Use service locator to get required services
        const envService = ServiceLocator.getInstance().getEnvironmentService();

        // Verify we're in Agent mode through the API
        try {
            // This is a placeholder for the actual API call to verify/set Agent mode
            // The actual implementation would use an API client instead of commands
            console.log("Verifying agent mode is 'Agent' through API");
            // TODO: Replace with actual API call
        } catch (error) {
            console.error("Error configuring agent mode:", error);
            statusManager.setState(WorkflowState.Error, "Failed to configure agent mode");
            throw error;
        }

        // Select Agent LLM based on priority order
        statusManager.setState(WorkflowState.SendingTask, "Selecting optimal AI model");
        console.log("Selecting Agent LLM");

        const config = vscode.workspace.getConfiguration('marco');
        const preferredModels = config.get<string[]>('preferredModels') ||
            ["Claude 3.7 Sonnet", "Gemini 2.5", "GPT 4.1"];

        // Attempt to select models in priority order using API
        let modelSelected = false;
        for (const model of preferredModels) {
            try {
                console.log(`Attempting to select ${model} through API`);
                // TODO: Replace with actual API call to select model
                // This is where the API command would be used instead of VS Code commands
                modelSelected = true;
                console.log(`Successfully selected ${model} through API`);
                break;
            } catch (error) {
                console.log(`Error selecting model ${model} through API:`, error);
                // Continue to next model if there's an API error
            }
        }

        if (!modelSelected) {
            console.warn("Could not select any of the preferred models through API");
        }

        await checkContinue();

        // Initial Git Branch Setup (Conditional)
        const initCreateBranch = config.get<boolean>('initCreateBranch');
        if (initCreateBranch) {
            statusManager.setState(WorkflowState.CreatingBranch, "Creating new branch");

            // Verify Git login
            // TODO: Add Git login verification

            // Create new branch
            await createAndCheckoutBranch();

            // Send message to agent about branch creation
            const taskDescription = "I've created a new branch for you based on the current branch with '_refactor' appended. Please continue with the tasks.";
            await sendChatMessage(taskDescription, isBackgroundMode());

            // Allow time for response
            await sleep(2000);
        }

        await checkContinue();

        // II. TASK DEFINITION & PREPARATION
        
        // Checklist Input Capture via VS Code tab interface
        statusManager.setState(WorkflowState.Initializing, "Waiting for checklist input");
        const userInput = await ChecklistService.captureChecklistInput(context);
        if (!userInput) {
            statusManager.setState(WorkflowState.Error, "Checklist input cancelled");
            throw new Error("Checklist input was cancelled. Workflow cannot proceed without tasks.");
        }

        // Set up a path for the CHECKLIST.json file
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error("No workspace folder is open");
        }
        
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const checklistPath = path.join(workspaceRoot, 'CHECKLIST.json');
        
        // First check if the file already exists and is valid before monitoring for creation
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(checklistPath));
            // File exists, check if it's valid
            const isValidJson = await validateJsonFile(checklistPath);
            if (isValidJson) {
                statusManager.setState(WorkflowState.SendingTask, "Found existing valid CHECKLIST.json file");
                vscode.window.showInformationMessage("Using existing CHECKLIST.json file");
                
                // Return the path to the existing checklist file
                return checklistPath;
            } else {
                // JSON file exists but has invalid structure - proceed with the agent creating a new one
                statusManager.setState(WorkflowState.SendingTask, "Existing CHECKLIST.json is invalid, requesting agent to create a new one");
            }
        } catch (error) {
            // File doesn't exist, we'll monitor for creation
        }
        
        // Send the checklist to the AI agent for processing
        statusManager.setState(WorkflowState.SendingTask, "Sending checklist to AI agent for processing");
        
        // First, ensure the chat is open
        await ensureChatOpen(5, 1000, !isBackgroundMode());
        
        // Load the checklist creation prompt and substitute the user's tasks
        const checklistPrompt = await PromptLoader.loadPrompt(
            context,
            'checklistCreation',
            { 'TASKS': userInput }
        );
        
        // Send the prompt to the agent and monitor for response
        await sendChatMessage(checklistPrompt, isBackgroundMode());
        
        // Inform the user that we're monitoring for Copilot's response
        statusManager.setState(WorkflowState.SendingTask, "Monitoring Copilot response for interactive elements");

        // Allow time for agent to process and create the JSON file
        statusManager.setState(WorkflowState.SendingTask, "Waiting for agent to create CHECKLIST.json");
        
        // Wait a bit to give the agent time to generate the JSON file
        const CHECK_INTERVAL_MS = 2000;
        const MAX_CHECKS = 15; // 30 seconds total
        let checksPerformed = 0;
        let jsonCreated = false;
        
        // Monitor for the file creation
        while (checksPerformed < MAX_CHECKS) {
            // Check if the user has requested cancellation
            try {
                await checkContinue();
            } catch (error) {
                // If there's an error (workflow cancelled), break out of the loop
                break;
            }
            
            checksPerformed++;
            
            // Check if the file exists
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(checklistPath));
                jsonCreated = true;
                break;
            } catch (error) {
                // File doesn't exist yet, wait and try again
                await sleep(CHECK_INTERVAL_MS);
                
                if (checksPerformed % 3 === 0) {
                    // Every 6 seconds (every 3 checks), update the status message
                    statusManager.setState(
                        WorkflowState.SendingTask, 
                        `Still waiting for agent to create CHECKLIST.json (${checksPerformed * 2} seconds)...`
                    );
                    
                    // After 12 seconds (6 checks), gently prompt the agent if the file hasn't been created yet
                    if (checksPerformed === 6) {
                        const reminderPrompt = await PromptLoader.loadPrompt(
                            context, 
                            'checklistReminder',
                            {}
                        );
                        
                        await sendChatMessage(reminderPrompt, isBackgroundMode());
                        
                        statusManager.setState(
                            WorkflowState.SendingTask, 
                            "Sent a reminder to the agent about creating the CHECKLIST.json file"
                        );
                    }
                }
            }
        }
        
        // Check whether we found the file
        if (jsonCreated) {
            // Validate the JSON file structure
            const isValidJson = await validateJsonFile(checklistPath);
            
            if (isValidJson) {
                statusManager.setState(WorkflowState.SendingTask, "CHECKLIST.json file was created and validated successfully");
                
                // Inform the user
                vscode.window.showInformationMessage("Checklist JSON file created successfully!");
                
                // Return the path to the checklist file
                return checklistPath;
            } else {
                // JSON file exists but has invalid structure
                statusManager.setState(WorkflowState.Error, "Created CHECKLIST.json has invalid structure");
                
                // Send a message to the agent about the invalid structure
                const fixJsonPrompt = await PromptLoader.loadPrompt(
                    context,
                    'checklistFix',
                    { 'FILE_PATH': checklistPath }
                );
                
                await sendChatMessage(fixJsonPrompt, isBackgroundMode());
                
                // Give the agent some time to fix the JSON
                statusManager.setState(WorkflowState.SendingTask, "Asking agent to fix the JSON structure");
                
                // Wait a bit for the agent to fix the file
                let validationChecks = 0;
                const MAX_VALIDATION_CHECKS = 5;
                
                while (validationChecks < MAX_VALIDATION_CHECKS) {
                    try {
                        await checkContinue();
                    } catch (error) {
                        break;
                    }
                    
                    await sleep(3000);
                    validationChecks++;
                    
                    // Check if the file has been fixed
                    if (await validateJsonFile(checklistPath)) {
                        statusManager.setState(WorkflowState.SendingTask, "CHECKLIST.json file structure has been fixed");
                        vscode.window.showInformationMessage("Checklist JSON file structure has been fixed successfully!");
                        return checklistPath;
                    }
                }
                
                // If we got here, the structure couldn't be fixed
                statusManager.setState(WorkflowState.Error, "Unable to fix CHECKLIST.json structure");
                throw new Error("Failed to fix the JSON file structure within the timeout period");
            }
        } else {
            // Handle failure - the file wasn't created within the timeout period
            statusManager.setState(WorkflowState.Error, "Failed to create CHECKLIST.json file");
            
            // Show error message
            vscode.window.showErrorMessage(
                "The agent did not create the CHECKLIST.json file. Please try again or check the logs."
            );
            
            throw new Error("Failed to create CHECKLIST.json file within the timeout period");
        }

    } catch (error: any) {
        if (error.name === 'WorkflowCancelledError') {
            throw error;
        }

        statusManager.setState(WorkflowState.Error, "Setup failed");
        throw error;
    }
}

/**
 * Performs the development workflow phase
 * @param context The VS Code extension context
 */
export async function developmentWorkflow(context: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();
    const config = vscode.workspace.getConfiguration('marco');

    try {
        // Check for cancellation
        await checkContinue();

        // Update status based on iteration count
        const iterationCount = getIterationCount();
        const iterationMessage = iterationCount > 0 ? ` (iteration #${iterationCount})` : '';

        // 1) Send development task/checklist
        statusManager.setState(WorkflowState.SendingTask, `Sending development checklist${iterationMessage}`);

        // Load init prompt (pass filename without extension)
        const initPrompt = await PromptLoader.loadPrompt(context, 'init');
        await sendChatMessage(`@agent ${initPrompt}`, isBackgroundMode());

        // Send checklist after init prompt
        await sendChecklistToChat(context, isBackgroundMode());

        // Allow time for agent to process (Increased delay)
        await sleep(4000); // Increased from 2000
        await checkContinue();

        // 2) Check agent status after some time
        statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress${iterationMessage}`);

        // Load check_agent prompt (pass filename without extension)
        const checkAgentPrompt = await PromptLoader.loadPrompt(context, 'check_agent');
        await sendChatMessage(`@agent ${checkAgentPrompt}`, isBackgroundMode());

        // Allow time for agent to respond (Increased delay)
        await sleep(6000); // Increased from 3000
        await checkContinue();

        // 3) Request tests if configured
        const needToWriteTest = config.get<boolean>('needToWriteTest');
        if (needToWriteTest) {
            statusManager.setState(WorkflowState.RequestingTests, `Requesting test implementation${iterationMessage}`);

            // Load write_tests prompt (pass filename without extension)
            const writeTestsPrompt = await PromptLoader.loadPrompt(context, 'write_tests');
            await sendChatMessage(`@agent ${writeTestsPrompt}`, isBackgroundMode());

            // Allow time for agent to process (Increased delay)
            await sleep(6000); // Increased from 3000
            await checkContinue();

            // Check status again
            statusManager.setState(WorkflowState.CheckingStatus, `Checking agent progress on tests${iterationMessage}`);
            // Load test progress prompt (pass filename without extension)
            const testProgressPrompt = await PromptLoader.loadPrompt(context, 'test_progress');
            await sendChatMessage(`@agent ${testProgressPrompt}`, isBackgroundMode());

            // Allow time for agent to respond (Increased delay)
            await sleep(6000); // Increased from 3000
            await checkContinue();
        }

        // 4) Verify completion of checklist
        statusManager.setState(WorkflowState.VerifyingChecklist, `Verifying checklist completion${iterationMessage}`);

        // Load check_checklist prompt (pass filename without extension)
        const checkChecklistPrompt = await PromptLoader.loadPrompt(context, 'check_checklist');
        await sendChatMessage(`@agent ${checkChecklistPrompt}`, isBackgroundMode());

        // Allow time for agent to respond (Increased delay)
        await sleep(6000); // Increased from 3000

        // 5) Loop back or continue based on checklist status
        const continueToNextIteration = await shouldContinueToNextIteration(context);
        if (continueToNextIteration) {
            incrementIterationCount();
            statusManager.setState(WorkflowState.ContinuingIteration, `Starting iteration ${getIterationCount()}`);

            // Load continue_iteration prompt (pass filename without extension)
            const continueIterationPrompt = await PromptLoader.loadPrompt(context, 'continue_iteration');
            await sendChatMessage(`@agent ${continueIterationPrompt}`, isBackgroundMode());

            // Allow time for agent to process (Increased delay)
            await sleep(6000); // Increased from 3000

            // Loop back to start of development workflow
            await developmentWorkflow(context);
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
 * @param context The VS Code extension context
 */
export async function continueDevelopment(context: vscode.ExtensionContext): Promise<void> {
    const statusManager = StatusManager.getInstance();

    try {
        // Check for cancellation
        await checkContinue();

        // Increment the iteration count
        incrementIterationCount();

        // Update status
        statusManager.setState(WorkflowState.SendingTask, `Starting iteration #${getIterationCount()}`);

        // Load the continue iteration prompt
        const continuePrompt = await PromptLoader.loadPrompt(context, 'continue_iteration');

        // Send the continue prompt
        await sendChatMessage(`@agent Continue: "${continuePrompt}"`, isBackgroundMode());

        // Allow time for agent to respond (Increased delay)
        await sleep(4000); // Increased from 2000
        await checkContinue();

        // Resume normal development workflow
        await developmentWorkflow(context);

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
 * @param context The VS Code extension context
 * @returns Promise resolving to true if should continue, false if complete
 */
export async function shouldContinueToNextIteration(context: vscode.ExtensionContext): Promise<boolean> {
    // Placeholder: always return false (no further iterations)
    return false;
}
