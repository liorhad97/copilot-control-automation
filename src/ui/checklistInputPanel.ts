/**
 * Checklist Input Panel
 * Implements a custom VS Code webview panel for capturing user checklist input
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Manages the checklist input webview panel
 */
export class ChecklistInputPanel {
    public static currentPanel: ChecklistInputPanel | undefined;
    private static readonly viewType = 'checklistInput';
    
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionContext: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    private _resolveInputPromise: ((value: string | null) => void) | undefined;
    
    /**
     * Create or show a checklist input panel
     * @param extensionContext The extension context
     * @returns The panel instance
     */
    public static async createOrShow(extensionContext: vscode.ExtensionContext): Promise<ChecklistInputPanel> {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
            
        // If we already have a panel, show it
        if (ChecklistInputPanel.currentPanel) {
            ChecklistInputPanel.currentPanel._panel.reveal(column);
            return ChecklistInputPanel.currentPanel;
        }
        
        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            ChecklistInputPanel.viewType,
            'Checklist Input',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(extensionContext.extensionPath, 'media'))
                ],
                retainContextWhenHidden: true
            }
        );
        
        ChecklistInputPanel.currentPanel = new ChecklistInputPanel(panel, extensionContext);
        return ChecklistInputPanel.currentPanel;
    }
    
    /**
     * Show the panel and get user input
     * @returns Promise resolving to the user's input or null if cancelled
     */
    public async getUserInput(): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            this._resolveInputPromise = resolve;
        });
    }
    
    private constructor(panel: vscode.WebviewPanel, extensionContext: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionContext = extensionContext;
        
        // Set the webview's initial html content
        this._update();
        
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            () => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );
        
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'submit':
                        if (this._resolveInputPromise) {
                            this._resolveInputPromise(message.text);
                            this._resolveInputPromise = undefined;
                        }
                        this._panel.dispose();
                        return;
                    case 'cancel':
                        if (this._resolveInputPromise) {
                            this._resolveInputPromise(null);
                            this._resolveInputPromise = undefined;
                        }
                        this._panel.dispose();
                        return;
                }
            },
            null,
            this._disposables
        );
    }
    
    /**
     * Clean up resources when the panel is closed
     */
    public dispose() {
        ChecklistInputPanel.currentPanel = undefined;
        
        // If there's a pending promise, resolve it with null (cancelled)
        if (this._resolveInputPromise) {
            this._resolveInputPromise(null);
            this._resolveInputPromise = undefined;
        }
        
        // Clean up our resources
        this._panel.dispose();
        
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    
    /**
     * Update the webview content
     */
    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'Checklist Input';
        webview.html = this._getHtmlForWebview(webview);
    }
    
    /**
     * Get the HTML for the webview content
     */
    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Checklist Input</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                }
                h1 {
                    color: var(--vscode-editor-foreground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .description {
                    margin-bottom: 20px;
                    color: var(--vscode-descriptionForeground);
                }
                textarea {
                    width: 100%;
                    height: 300px;
                    padding: 10px;
                    margin-bottom: 20px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    resize: vertical;
                }
                .button-container {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                button {
                    padding: 8px 16px;
                    cursor: pointer;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 2px;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                button.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .example {
                    margin-bottom: 10px;
                    padding: 10px;
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-focusBorder);
                }
            </style>
        </head>
        <body>
            <h1>Task Checklist Input</h1>
            
            <div class="description">
                Enter each task on a new line in the text area below. 
                These tasks will be used to guide the AI agent through the development process.
            </div>
            
            <div class="example">
                <strong>Example Tasks:</strong><br>
                Create a login component with username and password fields<br>
                Implement form validation with error messages<br>
                Add a "Forgot Password" link that opens a modal dialog
            </div>
            
            <textarea id="taskInput" placeholder="Enter your tasks here..."></textarea>
            
            <div class="button-container">
                <button class="secondary" id="cancelButton">Cancel</button>
                <button id="submitButton">Submit Tasks</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                document.getElementById('submitButton').addEventListener('click', () => {
                    const text = document.getElementById('taskInput').value.trim();
                    if (text) {
                        vscode.postMessage({
                            command: 'submit',
                            text: text
                        });
                    } else {
                        alert('Please enter at least one task');
                    }
                });
                
                document.getElementById('cancelButton').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'cancel'
                    });
                });
                
                // Add keyboard shortcut for submit
                document.addEventListener('keydown', (e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        document.getElementById('submitButton').click();
                    }
                });
                
                // Focus on the textarea
                document.getElementById('taskInput').focus();
            </script>
        </body>
        </html>`;
    }
}
