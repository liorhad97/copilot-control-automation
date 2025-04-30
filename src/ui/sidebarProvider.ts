import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from '../statusManager';
import { getNonce } from '../utils/helpers';
import { isWorkflowRunning, pauseWorkflow, resumeWorkflow, runWorkflow, stopWorkflow } from '../workflows/workflowManager';

/**
 * SidebarProvider for Marco AI webview panel
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'marco-ai.sidebar';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) { }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'toggleWorkflow': {
                    if (isWorkflowRunning()) {
                        stopWorkflow();
                        await this._updateToggleButtonState(false);
                    } else {
                        runWorkflow(this._context, 'play');
                        await this._updateToggleButtonState(true);
                    }
                    break;
                }
                case 'pauseWorkflow': {
                    if (isWorkflowRunning()) {
                        pauseWorkflow();
                    } else {
                        resumeWorkflow(this._context);
                    }
                    break;
                }
                case 'restartWorkflow': {
                    runWorkflow(this._context, 'restart');
                    await this._updateToggleButtonState(true);
                    break;
                }
                case 'updateConfig': {
                    const config = vscode.workspace.getConfiguration('marco');
                    await config.update(data.key, data.value, vscode.ConfigurationTarget.Global);
                    break;
                }
                case 'userInput': {
                    // Store user input in context for use in workflow
                    this._context.workspaceState.update('marco.userInput', data.value);
                    break;
                }
                case 'getConfigValues': {
                    // Send current config values to the webview
                    const config = vscode.workspace.getConfiguration('marco');
                    this._view?.webview.postMessage({
                        type: 'configValues',
                        initCreateBranch: config.get('initCreateBranch'),
                        needToWriteTest: config.get('needToWriteTest'),
                        agentMode: config.get('agentMode') || 'Agent',
                        workflowRunning: isWorkflowRunning()
                    });
                    break;
                }
            }
        });

        // Update the sidebar with current status when workflow state changes
        const statusManager = StatusManager.getInstance();
        statusManager.onStateChanged((state) => {
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'stateUpdate',
                    state: state,
                    isRunning: isWorkflowRunning(),
                    isPaused: state === WorkflowState.Paused
                });
            }
        });
    }

    /**
     * Update the play/stop toggle button state in the webview
     */
    private async _updateToggleButtonState(isRunning: boolean) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'workflowToggle',
                isRunning
            });
        }
    }

    /**
     * Generate HTML for the sidebar webview
     */
    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.js')
        );

        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.css')
        );

        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
        );

        // Use a nonce to only allow a specific script to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <link href="${styleUri}" rel="stylesheet">
        <link href="${codiconsUri}" rel="stylesheet">
        <title>Marco AI</title>
      </head>
      <body>
        <header>
          <h1>Marco AI</h1>
          <div class="status-indicator">
            <span id="status-icon" class="codicon codicon-debug-pause"></span>
            <span id="status-text">Idle</span>
          </div>
        </header>
        
        <section class="controls">
          <div class="buttons">
            <button id="toggleBtn" class="primary-button">
              <span class="codicon codicon-debug-start"></span>
              <span id="toggleBtnText">Start Workflow</span>
            </button>
            <button id="pauseBtn" disabled>
              <span class="codicon codicon-debug-pause"></span>
              <span>Pause</span>
            </button>
            <button id="restartBtn">
              <span class="codicon codicon-debug-restart"></span>
              <span>Restart</span>
            </button>
          </div>
        </section>
        
        <section class="config">
          <h2>Configuration</h2>
          <div class="form-group">
            <label>
              <input type="checkbox" id="initCreateBranch" />
              Create Git branch on start
            </label>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="needToWriteTest" />
              Include test writing steps
            </label>
          </div>
          <div class="form-group">
            <label for="agentMode">Agent Mode:</label>
            <select id="agentMode">
              <option value="Agent">Agent</option>
              <option value="Edit">Edit</option>
              <option value="Ask">Ask</option>
            </select>
          </div>
        </section>
        
        <section class="user-input">
          <h2>Task Description</h2>
          <div class="form-group">
            <textarea id="taskDescription" rows="5" placeholder="Describe the task for Marco AI..."></textarea>
          </div>
          <button id="saveTaskBtn" class="primary-button">
            <span class="codicon codicon-save"></span>
            <span>Save Task</span>
          </button>
        </section>

        <section class="workflow-state">
          <h2>Workflow Progress</h2>
          <div class="progress-container">
            <div class="progress-step" data-state="initializing">
              <div class="step-indicator"></div>
              <div class="step-label">Initializing</div>
            </div>
            <div class="progress-step" data-state="creating-branch">
              <div class="step-indicator"></div>
              <div class="step-label">Branch Setup</div>
            </div>
            <div class="progress-step" data-state="sending-task">
              <div class="step-indicator"></div>
              <div class="step-label">Send Task</div>
            </div>
            <div class="progress-step" data-state="requesting-tests">
              <div class="step-indicator"></div>
              <div class="step-label">Tests</div>
            </div>
            <div class="progress-step" data-state="verifying-completion">
              <div class="step-indicator"></div>
              <div class="step-label">Verification</div>
            </div>
            <div class="progress-step" data-state="completed">
              <div class="step-indicator"></div>
              <div class="step-label">Complete</div>
            </div>
          </div>
        </section>

        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
    }
}