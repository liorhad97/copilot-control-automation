/**
 * Core interfaces for the 3-layer architecture
 * This file defines the contract between layers
 */

import * as vscode from 'vscode';

/**
 * Command interface representing an executable command
 */
export interface ICommand {
  execute(context: vscode.ExtensionContext, ...args: any[]): Promise<any>;
}

/**
 * Command factory interface for creating command instances
 */
export interface ICommandFactory {
  createCommand(commandId: string): ICommand | undefined;
}

/**
 * Environment service interface for environment-specific operations
 */
export interface IEnvironmentService {
  name: string;
  
  // Chat-related operations
  openChat(): Promise<void>;
  sendChatMessage(message: string, inBackground: boolean): Promise<void>;
  selectAIModel(modelName: string): Promise<boolean>;
  isAgentIdle(): Promise<boolean>;
  
  // Workflow-related operations
  createBranch(branchName?: string): Promise<boolean>;
  loadPrompt(context: vscode.ExtensionContext, promptName: string): Promise<string>;
  
  // Environment-specific configuration
  getEnvironmentConfig(): Record<string, any>;
}

/**
 * Workflow service interface for workflow operations
 */
export interface IWorkflowService {
  startWorkflow(context: vscode.ExtensionContext, action: string): Promise<void>;
  pauseWorkflow(): void;
  resumeWorkflow(context: vscode.ExtensionContext): void;
  stopWorkflow(): Promise<void>;
  
  isWorkflowRunning(): boolean;
  isWorkflowPaused(): boolean;
}
