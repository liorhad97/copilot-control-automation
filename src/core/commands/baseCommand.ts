/**
 * Base command class
 * Provides common functionality for all commands
 */

import * as vscode from 'vscode';
import { ICommand } from '../interfaces';

/**
 * Abstract base class for all commands
 */
export abstract class BaseCommand implements ICommand {
  /**
   * Command ID - must be unique for each command
   */
  abstract commandId: string;
  
  /**
   * Constructor with dependency injection
   */
  constructor() {}
  
  /**
   * Executes the command
   * @param context VS Code extension context
   * @param args Command arguments
   */
  abstract execute(context: vscode.ExtensionContext, ...args: any[]): Promise<any>;
  
  /**
   * Helper method to handle errors in commands
   * @param error Error to handle
   * @param commandName Name of the command for error reporting
   */
  protected handleError(error: any, commandName: string): void {
    console.error(`Error in ${commandName} command:`, error);
    vscode.window.showErrorMessage(`Error executing ${commandName}: ${error.message}`);
  }
}
