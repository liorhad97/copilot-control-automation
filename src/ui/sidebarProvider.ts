import * as vscode from 'vscode';
import { isWorkflowPaused, isWorkflowRunning } from '../workflows/workflowManager';

/**
 * Provides the webview content for the Marco AI sidebar
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

    /**
     * Called when the webview is first created
     * @param webviewView The webview view to initialize
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Set up message handling
        this._setWebviewMessageListener(webviewView.webview);

        // Update sidebar state regularly
        const updateInterval = setInterval(() => {
            if (this._view) {
                this.updateSidebarState();
            } else {
                clearInterval(updateInterval);
            }
        }, 1000);

        // Clear interval when webview is disposed
        webviewView.onDidDispose(() => {
            clearInterval(updateInterval);
        });
    }

    /**
     * Update the sidebar state to reflect current workflow status
     */
    private updateSidebarState() {
        if (!this._view) {
            return;
        }

        // Get current workflow state
        const state = {
            isRunning: isWorkflowRunning(),
            isPaused: isWorkflowPaused()
        };

        // Send state update to webview
        this._view.webview.postMessage({
            type: 'update-state',
            data: state
        });
    }

    /**
     * Set up message listeners for the webview
     * @param webview The webview to listen to messages from
     */
    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case 'play':
                        vscode.commands.executeCommand('marco.toggleWorkflow');
                        break;
                    case 'pause':
                        vscode.commands.executeCommand('marco.pauseWorkflow');
                        break;
                    case 'stop':
                        vscode.commands.executeCommand('marco.toggleWorkflow');
                        break;
                    case 'restart':
                        vscode.commands.executeCommand('marco.restart');
                        break;
                    case 'toggleBackground':
                        vscode.commands.executeCommand('marco.toggleBackgroundMode');
                        break;
                }
            },
            undefined,
            this._context.subscriptions
        );
    }

    /**
     * Generate the HTML for the webview
     * @param webview The webview to generate HTML for
     * @returns The HTML content
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the local path to main script and convert to webview uri
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.js')
        );

        // Get the local path to CSS styles
        const stylesUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.css')
        );

        // Use a nonce to only allow specific scripts to be run
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesUri}" rel="stylesheet">
                <title>Marco AI</title>
            </head>
            <body>
                <div class="container">
                    <h2>Marco AI Controls</h2>
                    
                    <div class="controls">
                        <button id="playBtn" class="control-btn">
                            <span class="icon play-icon">▶</span> Play
                        </button>
                        <button id="pauseBtn" class="control-btn">
                            <span class="icon pause-icon">⏸</span> Pause
                        </button>
                        <button id="stopBtn" class="control-btn">
                            <span class="icon stop-icon">⏹</span> Stop
                        </button>
                        <button id="restartBtn" class="control-btn">
                            <span class="icon restart-icon">↻</span> Restart
                        </button>
                    </div>
                    
                    <div class="settings">
                        <h3>Settings</h3>
                        <div class="setting-item">
                            <label class="setting-label">
                                <input type="checkbox" id="backgroundMode"> Background Mode
                            </label>
                        </div>
                    </div>
                    
                    <div class="status" id="statusDisplay">
                        <h3>Status</h3>
                        <div id="statusText">Idle</div>
                    </div>
                </div>
                
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    /**
     * Generate a random nonce string for security
     * @returns A random nonce string
     */
    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}