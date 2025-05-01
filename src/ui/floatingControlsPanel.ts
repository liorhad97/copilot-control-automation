import * as vscode from 'vscode';
import { isWorkflowPaused, isWorkflowRunning, runWorkflow, stopWorkflow } from '../workflows/workflowManager';

/**
 * Manages a floating panel with workflow control buttons (play, stop, reset)
 * that appears in the right panel of VS Code.
 */
export class FloatingControlsPanel {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];
    private statusBarItem: vscode.StatusBarItem;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        // Create a status bar item to reopen the panel if closed
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1001);
        this.statusBarItem.text = "$(debug-console) Marco Controls";
        this.statusBarItem.tooltip = "Show Marco AI Controls Panel";
        this.statusBarItem.command = 'marco.showFloatingControls';
        this.context.subscriptions.push(this.statusBarItem);
    }

    /**
     * Shows the floating controls panel in the right side or brings it to front if already visible
     */
    public show(): void {
        if (this.panel) {
            // If panel exists, just make it visible
            this.panel.reveal(vscode.ViewColumn.Three); // Column Three is the right-most panel
            return;
        }

        // Create the floating panel in the rightmost column
        this.panel = vscode.window.createWebviewPanel(
            'marcoControls',
            'Marco Controls',
            {
                viewColumn: vscode.ViewColumn.Three, // Use the rightmost column
                preserveFocus: true
            },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        // Configure the panel
        this.panel.webview.options = {
            enableScripts: true
        };

        // Set the initial HTML content
        this.updatePanelContent();

        // Hide the status bar item when panel is visible
        this.statusBarItem.hide();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'play':
                        await runWorkflow(this.context, 'play');
                        this.updatePanelContent();
                        break;
                    case 'pause':
                        await runWorkflow(this.context, 'pause');
                        this.updatePanelContent();
                        break;
                    case 'stop':
                        await stopWorkflow();
                        this.updatePanelContent();
                        break;
                    case 'restart':
                        await runWorkflow(this.context, 'restart');
                        this.updatePanelContent();
                        break;
                    case 'continue':
                        await runWorkflow(this.context, 'continue');
                        this.updatePanelContent();
                        break;
                }
            },
            undefined,
            this.disposables
        );

        // When the panel is disposed, clean up resources and show the status bar item
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;

                // Show the status bar item when panel is closed
                this.statusBarItem.show();

                // Dispose all disposables
                while (this.disposables.length) {
                    const disposable = this.disposables.pop();
                    if (disposable) {
                        disposable.dispose();
                    }
                }
            },
            null,
            this.disposables
        );

        // Update the panel content periodically to reflect workflow state
        const updateInterval = setInterval(() => {
            if (this.panel) {
                this.updatePanelContent();
            } else {
                clearInterval(updateInterval);
            }
        }, 1000);

        this.disposables.push({ dispose: () => clearInterval(updateInterval) });
    }

    /**
     * Updates the panel content based on current workflow state
     */
    private updatePanelContent(): void {
        if (!this.panel) {
            return;
        }

        const isRunning = isWorkflowRunning();
        const isPaused = isWorkflowPaused();

        // Get the media resources
        const scriptUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'sidebar.js')
        );
        const styleUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'sidebar.css')
        );

        // Set HTML content with dynamic buttons based on workflow state
        this.panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Marco Controls</title>
            <link rel="stylesheet" href="${styleUri}">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-panel-background);
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin: 0;
                    overflow: hidden;
                }
                .controls-container {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    width: 100%;
                    padding: 8px;
                    background-color: var(--vscode-panel-background);
                    border-radius: 6px;
                }
                .control-button {
                    font-size: 14px;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    border: none;
                    gap: 8px;
                    width: 100%;
                    text-align: left;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .control-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .control-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .control-button.stop {
                    background-color: var(--vscode-errorForeground);
                }
                .control-button.stop:hover {
                    opacity: 0.9;
                }
                .icon {
                    width: 16px;
                    height: 16px;
                    fill: currentColor;
                }
                h3 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    text-align: center;
                    width: 100%;
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .status {
                    margin-top: 15px;
                    font-size: 12px;
                    text-align: center;
                    height: 16px;
                    padding: 5px;
                    width: 100%;
                    border-top: 1px solid var(--vscode-panel-border);
                }
                .status-indicator {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    margin-right: 5px;
                }
                .status-indicator.running {
                    background-color: var(--vscode-testing-runAction);
                    animation: pulse 1.5s infinite;
                }
                .status-indicator.paused {
                    background-color: var(--vscode-notificationsWarningIcon-foreground);
                }
                .status-indicator.idle {
                    background-color: var(--vscode-editorGutter-commentRangeForeground);
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            </style>
        </head>
        <body>
            <h3>Marco AI Controls</h3>
            <div class="controls-container">
                <button class="control-button" id="playButton" ${isRunning && !isPaused ? 'disabled' : ''}>
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    Play Workflow
                </button>
                <button class="control-button" id="pauseButton" ${!isRunning || isPaused ? 'disabled' : ''}>
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                    Pause Workflow
                </button>
                <button class="control-button stop" id="stopButton" ${!isRunning ? 'disabled' : ''}>
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M6 6h12v12H6z"/>
                    </svg>
                    Stop Workflow
                </button>
                <button class="control-button" id="restartButton">
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                    Reset Workflow
                </button>
                <button class="control-button" id="continueButton" ${!isRunning ? 'disabled' : ''}>
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M4 18l8.5-6L4 6v12zm9-12v12h2V6h-2zm5 0v12h2V6h-2z"/>
                    </svg>
                    Continue Next Step
                </button>
            </div>
            <div class="status">
                <span class="status-indicator ${isRunning ? (isPaused ? 'paused' : 'running') : 'idle'}"></span>
                ${isRunning ? (isPaused ? 'Workflow paused' : 'Workflow running') : 'Workflow idle'}
            </div>
            
            <script>
                (function() {
                    // Button event listeners
                    document.getElementById('playButton').addEventListener('click', () => {
                        vscode.postMessage({ command: 'play' });
                    });
                    
                    document.getElementById('pauseButton').addEventListener('click', () => {
                        vscode.postMessage({ command: 'pause' });
                    });
                    
                    document.getElementById('stopButton').addEventListener('click', () => {
                        vscode.postMessage({ command: 'stop' });
                    });
                    
                    document.getElementById('restartButton').addEventListener('click', () => {
                        vscode.postMessage({ command: 'restart' });
                    });
                    
                    document.getElementById('continueButton').addEventListener('click', () => {
                        vscode.postMessage({ command: 'continue' });
                    });
                    
                    // Initialize by acquiring vscode API
                    const vscode = acquireVsCodeApi();
                })();
            </script>
        </body>
        </html>
        `;
    }

    /**
     * Dispose the panel and clean up resources
     */
    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }

        this.statusBarItem.dispose();

        // Dispose all resources
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}