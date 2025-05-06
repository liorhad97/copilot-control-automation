/**
 * Restart workflow command
 * Restarts the workflow from the beginning
 */

import * as vscode from 'vscode';
import { BaseCommand } from './baseCommand';
import { IWorkflowService } from '../interfaces';

export class RestartWorkflowCommand extends BaseCommand {
  commandId = 'marco.restart';
  
  constructor(private workflowService: IWorkflowService) {
    super();
  }
  
  async execute(context: vscode.ExtensionContext): Promise<void> {
    try {
      await this.workflowService.startWorkflow(context, 'restart');
    } catch (error) {
      this.handleError(error, 'Restart Workflow');
    }
  }
}
