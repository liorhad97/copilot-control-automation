/**
 * Windsurf-specific environment service implementation
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseEnvironmentService } from './environmentService';

/**
 * Implements environment service for Windsurf
 */
export class WindsurfEnvironmentService extends BaseEnvironmentService {
  name = 'windsurf';

  /**
   * Opens the Windsurf chat interface
   */
  async openChat(): Promise<void> {
    try {
      // This would be replaced with actual Windsurf-specific code
      await vscode.commands.executeCommand('windsurf.chat.show');
      await vscode.commands.executeCommand('windsurf.chat.focus');
      return;
    } catch (error) {
      console.error('Error opening Windsurf Chat:', error);
      throw new Error('Failed to open Windsurf Chat');
    }
  }

  /**
   * Sends a message to Windsurf chat
   * @param message Message text to send
   * @param inBackground Whether to send in background mode
   */
  async sendChatMessage(message: string, inBackground: boolean): Promise<void> {
    try {
      // If not in background mode, ensure chat is visible
      if (!inBackground) {
        await this.openChat();
      }
      
      // Send message using Windsurf-specific API
      await vscode.commands.executeCommand('windsurf.chat.sendMessage', message);
      
      return;
    } catch (error) {
      console.error('Error sending message to Windsurf Chat:', error);
      throw new Error('Failed to send message to Windsurf Chat');
    }
  }

  /**
   * Selects an AI model in Windsurf
   * @param modelName Name of the model to select
   */
  async selectAIModel(modelName: string): Promise<boolean> {
    try {
      // Windsurf-specific model selection API
      await vscode.commands.executeCommand('windsurf.selectModel', modelName);
      return true;
    } catch (error) {
      console.error(`Error selecting Windsurf AI model ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Checks if the Windsurf agent is idle
   */
  async isAgentIdle(): Promise<boolean> {
    try {
      // Windsurf-specific agent state API
      const state = await vscode.commands.executeCommand('windsurf.getAgentState');
      return state === 'idle';
    } catch (error) {
      console.error('Error checking Windsurf agent state:', error);
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
      const actualBranchName = branchName || `windsurf-task-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      
      // Use Windsurf-specific branch creation API
      await vscode.commands.executeCommand('windsurf.git.createBranch', actualBranchName);
      return true;
    } catch (error) {
      console.error('Error creating git branch in Windsurf:', error);
      return false;
    }
  }

  /**
   * Loads a prompt from the Windsurf-specific prompts directory
   * @param context VS Code extension context
   * @param promptName Name of the prompt file (without extension)
   */
  async loadPrompt(context: vscode.ExtensionContext, promptName: string): Promise<string> {
    try {
      // Determine Windsurf-specific prompts directory path
      const promptsDir = path.join(context.extensionPath, 'windsurf-prompts');
      
      // Build full path to prompt file
      const promptPath = path.join(promptsDir, `${promptName}.md`);
      
      // Check if file exists
      if (!fs.existsSync(promptPath)) {
        // Fall back to standard prompts if Windsurf-specific not found
        return this.fallbackLoadPrompt(context, promptName);
      }
      
      // Read and return file contents
      return fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error(`Error loading Windsurf prompt ${promptName}:`, error);
      throw new Error(`Failed to load Windsurf prompt: ${promptName}`);
    }
  }

  /**
   * Fallback prompt loader for standard prompts
   */
  private async fallbackLoadPrompt(context: vscode.ExtensionContext, promptName: string): Promise<string> {
    const standardPromptsDir = path.join(context.extensionPath, 'prompts');
    const promptPath = path.join(standardPromptsDir, `${promptName}.md`);
    
    if (!fs.existsSync(promptPath)) {
      throw new Error(`Prompt file not found: ${promptPath}`);
    }
    
    return fs.readFileSync(promptPath, 'utf-8');
  }

  /**
   * Gets Windsurf-specific configuration
   */
  getEnvironmentConfig(): Record<string, any> {
    const config = vscode.workspace.getConfiguration('marco.windsurf');
    return {
      preferredModels: config.get<string[]>('preferredModels') || ['Windsurf Default'],
      agentMode: config.get<string>('agentMode') || 'Windsurf Agent',
      backgroundMode: config.get<boolean>('backgroundMode') || false,
      windsurfSpecificSetting: config.get<string>('specificSetting') || 'default'
    };
  }
}
