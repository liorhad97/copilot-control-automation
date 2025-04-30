import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Get the root path of the current workspace
 * @returns The workspace root path or undefined if not available
 */
export function getWorkspaceRoot(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    
    return workspaceFolders[0].uri.fsPath;
}

/**
 * Check if a command exists in VS Code
 * @param commandId The ID of the command to check
 * @returns Promise resolving to true if the command exists
 */
export async function commandExists(commandId: string): Promise<boolean> {
    try {
        const commands = await vscode.commands.getCommands(true);
        return commands.includes(commandId);
    } catch (error) {
        console.error(`Error checking if command ${commandId} exists:`, error);
        return false;
    }
}

/**
 * Get the extension's path to resources
 * @param context The extension context
 * @param relativePath The relative path within the extension
 * @returns The full path to the resource
 */
export function getExtensionResourcePath(context: vscode.ExtensionContext, relativePath: string): string {
    return path.join(context.extensionPath, relativePath);
}

/**
 * Log a message with timestamp
 * @param message The message to log
 * @param level The log level (log, warn, error)
 */
export function logWithTimestamp(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;
    
    switch (level) {
        case 'warn':
            console.warn(formattedMessage);
            break;
        case 'error':
            console.error(formattedMessage);
            break;
        default:
            console.log(formattedMessage);
            break;
    }
}
