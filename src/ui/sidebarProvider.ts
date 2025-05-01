import * as vscode from 'vscode';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { StatusManager, WorkflowState } from '../services/StatusManager';
import { getNonce } from '../utils/helpers';
import { isWorkflowRunning, pauseWorkflow, resumeWorkflow, runWorkflow, stopWorkflow } from '../workflows/workflow';

/**
 * Provides the sidebar webview for Marco AI
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'marco-ai.sidebar';
  private _view?: vscode.WebviewView;
  private context: vscode.ExtensionContext;
  private configManager: ConfigurationManager;

  /**
   * Create a new SidebarProvider
   * @param extensionUri The extension URI
   * @param context The extension context
   */
  constructor(
    private readonly extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this.context = context;
    this.configManager = ConfigurationManager.getInstance();
  }

  /**
   * Resolves the webview view
   * @param webviewView The webview view to resolve
   * @param context The webview view resolve context
   * @param token A cancellation token
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'toggleWorkflow': {
          if (isWorkflowRunning(this.context)) {
            await stopWorkflow(this.context);
            await this._updateToggleButtonState(false);
          } else {
            await runWorkflow(this.context, 'play');
            await this._updateToggleButtonState(true);
          }
          break;
        }
        case 'pauseWorkflow': {
          if (isWorkflowRunning(this.context)) {
            pauseWorkflow(this.context);
          } else {
            resumeWorkflow(this.context);
          }
          break;
        }
        case 'restartWorkflow': {
          await runWorkflow(this.context, 'restart');
          await this._updateToggleButtonState(true);
          break;
        }
        case 'updateConfig': {
          await this.configManager.updateSetting(
            data.key,
            data.value,
            vscode.ConfigurationTarget.Global
          );
          break;
        }
        case 'userInput': {
          // Store user input in context for use in workflow
          this.context.workspaceState.update('marco.userInput', data.value);
          break;
        }
        case 'getConfigValues': {
          // Send current config values to the webview
          this._view?.webview.postMessage({
            type: 'configValues',
            initCreateBranch: this.configManager.shouldCreateBranch(),
            needToWriteTest: this.configManager.shouldWriteTests(),
            agentMode: this.configManager.getAgentMode(),
            workflowRunning: isWorkflowRunning(this.context)
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
          isRunning: isWorkflowRunning(this.context),
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
      vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar.js')
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar.css')
    );

    // For simplicity, we're not including the codicons CSS directly, but in a real implementation, you would

    // Use a nonce to only allow a specific script to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}'">
        <title>Marco AI</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sidebar-background);
            padding: 0;
            margin: 0;
          }
          
          header {
            padding: 10px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          
          h1 {
            font-size: 14px;
            margin: 0 0 5px 0;
          }
          
          .status-indicator {
            display: flex;
            align-items: center;
            font-size: 12px;
          }
          
          section {
            padding: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          
          h2 {
            font-size: 13px;
            margin: 0 0 10px 0;
          }
          
          .buttons {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
          }
          
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 5px 10px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .primary-button {
            background-color: var(--vscode-button-background);
          }
          
          .form-group {
            margin-bottom: 10px;
          }
          
          label {
            font-size: 12px;
            display: block;
            margin-bottom: 4px;
          }
          
          input[type="checkbox"] {
            margin-right: 5px;
          }
          
          select {
            width: 100%;
            padding: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
          }
          
          textarea {
            width: 100%;
            resize: vertical;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 5px;
          }
          
          .progress-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }
          
          .progress-step {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .step-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: var(--vscode-descriptionForeground);
            opacity: 0.5;
          }
          
          .step-indicator.active {
            background-color: var(--vscode-progressBar-background);
            opacity: 1;
          }
          
          .step-indicator.completed {
            background-color: var(--vscode-terminal-ansiGreen);
            opacity: 1;
          }
          
          .step-label {
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>Marco AI</h1>
          <div class="status-indicator">
            <span id="status-icon">⬤</span>
            <span id="status-text">Idle</span>
          </div>
        </header>
        
        <section class="controls">
          <div class="buttons">
            <button id="toggleBtn" class="primary-button">
              <span id="toggleBtnIcon">▶</span>
              <span id="toggleBtnText">Start Workflow</span>
            </button>
            <button id="pauseBtn" disabled>
              <span>⏸</span>
              <span>Pause</span>
            </button>
            <button id="restartBtn">
              <span>🔄</span>
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
            <span>💾</span>
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

        <script nonce="${nonce}">
          (function() {
            const vscode = acquireVsCodeApi();
            
            // DOM Elements
            const toggleBtn = document.getElementById('toggleBtn');
            const toggleBtnText = document.getElementById('toggleBtnText');
            const toggleBtnIcon = document.getElementById('toggleBtnIcon');
            const pauseBtn = document.getElementById('pauseBtn');
            const restartBtn = document.getElementById('restartBtn');
            const initCreateBranchCheckbox = document.getElementById('initCreateBranch');
            const needToWriteTestCheckbox = document.getElementById('needToWriteTest');
            const agentModeSelect = document.getElementById('agentMode');
            const taskDescriptionTextarea = document.getElementById('taskDescription');
            const saveTaskBtn = document.getElementById('saveTaskBtn');
            const statusIcon = document.getElementById('status-icon');
            const statusText = document.getElementById('status-text');
            const progressSteps = document.querySelectorAll('.progress-step');
            
            // Load initial configuration values
            vscode.postMessage({ type: 'getConfigValues' });
            
            // Setup event listeners
            toggleBtn.addEventListener('click', () => {
              vscode.postMessage({ type: 'toggleWorkflow' });
            });
            
            pauseBtn.addEventListener('click', () => {
              vscode.postMessage({ type: 'pauseWorkflow' });
            });
            
            restartBtn.addEventListener('click', () => {
              vscode.postMessage({ type: 'restartWorkflow' });
            });
            
            initCreateBranchCheckbox.addEventListener('change', () => {
              vscode.postMessage({
                type: 'updateConfig',
                key: 'initCreateBranch',
                value: initCreateBranchCheckbox.checked
              });
            });
            
            needToWriteTestCheckbox.addEventListener('change', () => {
              vscode.postMessage({
                type: 'updateConfig',
                key: 'needToWriteTest',
                value: needToWriteTestCheckbox.checked
              });
            });
            
            agentModeSelect.addEventListener('change', () => {
              vscode.postMessage({
                type: 'updateConfig',
                key: 'agentMode',
                value: agentModeSelect.value
              });
            });
            
            saveTaskBtn.addEventListener('click', () => {
              vscode.postMessage({
                type: 'userInput',
                value: taskDescriptionTextarea.value
              });
              
              // Show feedback
              saveTaskBtn.textContent = 'Saved!';
              setTimeout(() => {
                saveTaskBtn.innerHTML = '<span>💾</span><span>Save Task</span>';
              }, 1500);
            });
            
            // Handle messages from the extension
            window.addEventListener('message', event => {
              const message = event.data;
              
              switch (message.type) {
                case 'configValues':
                  initCreateBranchCheckbox.checked = message.initCreateBranch;
                  needToWriteTestCheckbox.checked = message.needToWriteTest;
                  agentModeSelect.value = message.agentMode;
                  
                  // Update UI based on workflow state
                  updateWorkflowState(message.workflowRunning);
                  break;
                  
                case 'workflowToggle':
                  updateWorkflowState(message.isRunning);
                  break;
                  
                case 'stateUpdate':
                  updateWorkflowProgress(message.state, message.isRunning, message.isPaused);
                  break;
              }
            });
            
            // Update UI based on workflow state
            function updateWorkflowState(isRunning) {
              if (isRunning) {
                toggleBtnText.textContent = 'Stop Workflow';
                toggleBtnIcon.textContent = '⏹'; // Stop icon
                pauseBtn.disabled = false;
              } else {
                toggleBtnText.textContent = 'Start Workflow';
                toggleBtnIcon.textContent = '▶'; // Play icon
                pauseBtn.disabled = true;
                pauseBtn.textContent = 'Pause';
                
                // Reset the progress indicators
                resetProgressIndicators();
              }
            }
            
            // Update workflow progress indicators
            function updateWorkflowProgress(state, isRunning, isPaused) {
              // Update status text and icon
              statusText.textContent = state.charAt(0).toUpperCase() + state.slice(1).replace(/-/g, ' ');
              
              if (isPaused) {
                statusIcon.textContent = '⏸'; // Pause icon
                statusIcon.style.color = 'var(--vscode-notificationsWarningIcon-foreground)';
                pauseBtn.innerHTML = '<span>▶</span><span>Resume</span>';
              } else if (isRunning) {
                statusIcon.textContent = '⏳'; // Running icon
                statusIcon.style.color = 'var(--vscode-progressBar-background)';
                pauseBtn.innerHTML = '<span>⏸</span><span>Pause</span>';
              } else if (state === 'completed') {
                statusIcon.textContent = '✅'; // Checkmark
                statusIcon.style.color = 'var(--vscode-terminal-ansiGreen)';
              } else if (state === 'error') {
                statusIcon.textContent = '❌'; // X mark
                statusIcon.style.color = 'var(--vscode-errorForeground)';
              } else {
                statusIcon.textContent = '⬤'; // Dot
                statusIcon.style.color = 'var(--vscode-descriptionForeground)';
              }
              
              // Update progress steps
              resetProgressIndicators();
              
              if (isRunning || state === 'completed' || state === 'error') {
                // Find the current step and all previous steps
                let currentFound = false;
                progressSteps.forEach(step => {
                  const stepState = step.getAttribute('data-state');
                  const indicator = step.querySelector('.step-indicator');
                  
                  if (stepState === state) {
                    indicator.classList.add('active');
                    currentFound = true;
                  } else if (!currentFound) {
                    indicator.classList.add('completed');
                  }
                });
                
                // If completed, mark all steps as completed
                if (state === 'completed') {
                  progressSteps.forEach(step => {
                    const indicator = step.querySelector('.step-indicator');
                    indicator.classList.remove('active');
                    indicator.classList.add('completed');
                  });
                }
              }
            }
            
            // Reset all progress indicators
            function resetProgressIndicators() {
              progressSteps.forEach(step => {
                const indicator = step.querySelector('.step-indicator');
                indicator.classList.remove('active', 'completed');
              });
            }
          })();
        </script>
      </body>
      </html>`;
  }
}