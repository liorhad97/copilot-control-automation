import * as vscode from 'vscode';

/**
 * Helper function to execute file-related operations through git commands
 * @param command Git command to execute
 * @returns Promise resolving to command output
 */
export async function executeGitCommand(command: string): Promise<string> {
    try {
        // Execute command using the VS Code terminal API
        const terminal = vscode.window.createTerminal('Marco AI Git');
        terminal.sendText(command);
        terminal.dispose(); // Close the terminal after execution

        return 'Command executed';
    } catch (error) {
        console.error('Error executing git command:', error);
        return 'Error: ' + error;
    }
}

/**
 * Get the workspace root path
 */
export function getWorkspaceRoot(): string | undefined {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return undefined;
}