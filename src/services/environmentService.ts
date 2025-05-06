/**
 * Base environment service implementation
 */

import * as vscode from 'vscode';
import { IEnvironmentService } from '../core/interfaces';

/**
 * Abstract base class for environment services
 */
export abstract class BaseEnvironmentService implements IEnvironmentService {
  abstract name: string;

  /**
   * Opens the chat interface
   */
  abstract openChat(): Promise<void>;

  /**
   * Sends a message to the chat
   * @param message Message to send
   * @param inBackground Whether to send in background mode
   */
  abstract sendChatMessage(message: string, inBackground: boolean): Promise<void>;

  /**
   * Selects an AI model if available
   * @param modelName Name of the model to select
   */
  abstract selectAIModel(modelName: string): Promise<boolean>;

  /**
   * Checks if the agent is idle
   */
  abstract isAgentIdle(): Promise<boolean>;

  /**
   * Creates a branch for the project
   * @param branchName Optional branch name
   */
  abstract createBranch(branchName?: string): Promise<boolean>;

  /**
   * Loads a prompt from the appropriate location
   * @param context VS Code extension context
   * @param promptName Name of the prompt to load
   */
  abstract loadPrompt(context: vscode.ExtensionContext, promptName: string): Promise<string>;

  /**
   * Gets environment-specific configuration
   */
  abstract getEnvironmentConfig(): Record<string, any>;
}
