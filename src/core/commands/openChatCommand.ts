/**
 * Open chat command
 * Opens the AI chat interface
 */

import * as vscode from 'vscode';
import { BaseCommand } from './baseCommand';
import { IEnvironmentService } from '../interfaces';

export class OpenChatCommand extends BaseCommand {
  commandId = 'marco.openChat';
  
  constructor(private environmentService: IEnvironmentService) {
    super();
  }
  
  async execute(context: vscode.ExtensionContext): Promise<void> {
    try {
      await this.environmentService.openChat();
    } catch (error) {
      this.handleError(error, 'Open Chat');
    }
  }
}
