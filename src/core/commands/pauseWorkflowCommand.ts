/**
 * Pause workflow command
 * Pauses or resumes the workflow
 */

import * as vscode from 'vscode';
import { BaseCommand } from './baseCommand';
import { IWorkflowService } from '../interfaces';

export class PauseWorkflowCommand extends BaseCommand {
  commandId = 'marco.pauseWorkflow';
  
  constructor(private workflowService: IWorkflowService) {
    super();
  }
  
  async execute(context: vscode.ExtensionContext): Promise<void> {
    try {
      if (this.workflowService.isWorkflowRunning()) {
        if (this.workflowService.isWorkflowPaused()) {
          this.workflowService.resumeWorkflow(context);
        } else {
          this.workflowService.pauseWorkflow();
        }
      }
    } catch (error) {
      this.handleError(error, 'Pause/Resume Workflow');
    }
  }
}
