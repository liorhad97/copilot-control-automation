/**
 * Copilot-specific environment service implementation
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseEnvironmentService } from './environmentService';

/**
 * Implements environment service for GitHub Copilot
 */
export class CopilotEnvironmentService extends BaseEnvironmentService {
  name = 'copilot';

  /**
   * Opens the Copilot chat panel
   */
  async openChat(): Promise<void> {
    // Try to open GitHub Copilot Chat view
    try {
      // First, execute the command to show the chat view
      await vscode.commands.executeCommand('github.copilot.chat.show');
      
      // Wait a moment for the view to appear
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Then focus the chat view
      await vscode.commands.executeCommand('github.copilot.chat.focus');
      
      return;
    } catch (error) {
      console.error('Error opening GitHub Copilot Chat:', error);
      throw new Error('Failed to open GitHub Copilot Chat');
    }
  }

  /**
   * Sends a message to Copilot chat
   * @param message Message text to send
   * @param inBackground Whether to send in background mode
   */
  async sendChatMessage(message: string, inBackground: boolean): Promise<void> {
    try {
      // If not in background mode, ensure chat is visible and focused
      if (!inBackground) {
        await this.openChat();
      }
      
      // Send message using Copilot chat API
      await vscode.commands.executeCommand('github.copilot.chat.sendDraft', message);
      
      return;
    } catch (error) {
      console.error('Error sending message to GitHub Copilot Chat:', error);
      throw new Error('Failed to send message to GitHub Copilot Chat');
    }
  }

  /**
   * Selects an AI model in Copilot
   * @param modelName Name of the model to select
   */
  async selectAIModel(modelName: string): Promise<boolean> {
    try {
      // Execute command to select model
      // Note: This may need adaptation based on Copilot's actual API
      await vscode.commands.executeCommand('github.copilot.chat.selectModel', modelName);
      return true;
    } catch (error) {
      console.error(`Error selecting AI model ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Checks if the Copilot agent is idle
   */
  async isAgentIdle(): Promise<boolean> {
    try {
      // This is a placeholder - actual implementation would depend on
      // how Copilot exposes agent state through its API
      const state = await vscode.commands.executeCommand('github.copilot.chat.getAgentState');
      return state === 'idle';
    } catch (error) {
      console.error('Error checking Copilot agent state:', error);
      // Default to false if unable to determine
      return false;
    }
  }

  /**
   * Creates a git branch for the project
   * @param branchName Optional branch name
   */
  async createBranch(branchName?: string): Promise<boolean> {
    try {
      // Generate a branch name if not provided
      const actualBranchName = branchName || `marco-ai-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      
      // Use VS Code git extension to create and checkout branch
      await vscode.commands.executeCommand('git.checkout', actualBranchName, true);
      return true;
    } catch (error) {
      console.error('Error creating git branch:', error);
      return false;
    }
  }

  /**
   * Loads a prompt from the prompts directory
   * @param context VS Code extension context
   * @param promptName Name of the prompt file (without extension)
   */
  async loadPrompt(context: vscode.ExtensionContext, promptName: string): Promise<string> {
    try {
      // Determine prompts directory path
      const promptsDir = path.join(context.extensionPath, 'prompts');
      
      // Build full path to prompt file
      const promptPath = path.join(promptsDir, `${promptName}.md`);
      
      // Check if file exists
      if (!fs.existsSync(promptPath)) {
        throw new Error(`Prompt file not found: ${promptPath}`);
      }
      
      // Read and return file contents
      return fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error(`Error loading prompt ${promptName}:`, error);
      throw new Error(`Failed to load prompt: ${promptName}`);
    }
  }

  /**
   * Gets Copilot-specific configuration
   */
  getEnvironmentConfig(): Record<string, any> {
    const config = vscode.workspace.getConfiguration('marco');
    return {
      preferredModels: config.get<string[]>('preferredModels') || [],
      agentMode: config.get<string>('agentMode') || 'Agent',
      backgroundMode: config.get<boolean>('backgroundMode') || false
    };
  }
}
