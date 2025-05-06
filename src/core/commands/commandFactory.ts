/**
 * Command factory
 * Creates and registers command instances
 */

import * as vscode from 'vscode';
import { ICommand, ICommandFactory, IEnvironmentService, IWorkflowService } from '../interfaces';
import { ToggleWorkflowCommand } from './toggleWorkflowCommand';
import { PauseWorkflowCommand } from './pauseWorkflowCommand';
import { RestartWorkflowCommand } from './restartWorkflowCommand';
import { OpenChatCommand } from './openChatCommand';

export class CommandFactory implements ICommandFactory {
  private commands: Map<string, ICommand> = new Map();
  
  constructor(
    private workflowService: IWorkflowService,
    private environmentService: IEnvironmentService
  ) {
    this.initializeCommands();
  }
  
  /**
   * Creates a command instance by command ID
   * @param commandId The command ID to create
   * @returns The command instance or undefined if not found
   */
  createCommand(commandId: string): ICommand | undefined {
    return this.commands.get(commandId);
  }
  
  /**
   * Registers all commands with VS Code
   * @param context VS Code extension context
   */
  registerAllCommands(context: vscode.ExtensionContext): void {
    this.commands.forEach((command, commandId) => {
      context.subscriptions.push(
        vscode.commands.registerCommand(commandId, async (...args: any[]) => {
          return command.execute(context, ...args);
        })
      );
    });
  }
  
  /**
   * Initializes all command instances
   */
  private initializeCommands(): void {
    // Create command instances with dependencies
    const toggleWorkflow = new ToggleWorkflowCommand(this.workflowService);
    const pauseWorkflow = new PauseWorkflowCommand(this.workflowService);
    const restartWorkflow = new RestartWorkflowCommand(this.workflowService);
    const openChat = new OpenChatCommand(this.environmentService);
    
    // Register commands in the map
    this.commands.set(toggleWorkflow.commandId, toggleWorkflow);
    this.commands.set(pauseWorkflow.commandId, pauseWorkflow);
    this.commands.set(restartWorkflow.commandId, restartWorkflow);
    this.commands.set(openChat.commandId, openChat);
  }
}
