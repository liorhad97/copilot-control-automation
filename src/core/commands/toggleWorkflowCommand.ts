/**
 * Toggle workflow command
 * Starts or stops the workflow
 */

import * as vscode from 'vscode';
import { BaseCommand } from './baseCommand';
import { IWorkflowService } from '../interfaces';

export class ToggleWorkflowCommand extends BaseCommand {
  commandId = 'marco.toggleWorkflow';
  
  constructor(private workflowService: IWorkflowService) {
    super();
  }
  
  async execute(context: vscode.ExtensionContext): Promise<void> {
    try {
      if (this.workflowService.isWorkflowRunning()) {
        await this.workflowService.stopWorkflow();
      } else {
        // Read configuration settings for workflow
        const config = vscode.workspace.getConfiguration('marco');
        
        // Start workflow
        await this.workflowService.startWorkflow(context, 'play');
      }
    } catch (error) {
      this.handleError(error, 'Toggle Workflow');
    }
  }
}
