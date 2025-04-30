import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Generates a nonce string for use with Content Security Policy
 * @returns Random nonce string
 */
export function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Format a string to title case
 * @param str String to format
 * @returns Title cased string
 */
export function toTitleCase(str: string): string {
    return str.replace(
        /\w\S*/g,
        txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );
}

/**
 * Reads a prompt file from the prompts directory
 * @param filename The name of the prompt file (with or without .md extension)
 * @returns The content of the prompt file as a string
 */
export async function readPromptFile(filename: string): Promise<string> {
    try {
        // Add .md extension if not provided
        if (!filename.endsWith('.md')) {
            filename = `${filename}.md`;
        }

        // Get the extension path
        const extensionPath = vscode.extensions.getExtension('your-publisher.marco-ai')?.extensionUri ||
            vscode.Uri.file(__dirname).with({ path: path.resolve(__dirname, '../..') });

        // Build the full path to the prompt file
        const promptPath = vscode.Uri.joinPath(extensionPath, 'src', 'prompts', filename);

        // Read the file content
        const content = await vscode.workspace.fs.readFile(promptPath);

        // Convert Buffer to string
        return new TextDecoder().decode(content);
    } catch (error) {
        console.error(`Failed to read prompt file ${filename}:`, error);
        throw new Error(`Failed to read prompt file ${filename}: ${error}`);
    }
}

/**
 * Sends a prompt to the Copilot Chat
 * @param promptContent The content to send to the chat
 */
export async function sendPromptToChat(promptContent: string): Promise<void> {
    try {
        // First ensure the chat is open
        await vscode.commands.executeCommand('github.copilot-chat.openChat');

        // Send the message to the chat
        await vscode.commands.executeCommand('github.copilot-chat.sendMessage', { message: promptContent });
    } catch (error) {
        console.error('Failed to send prompt to chat:', error);
        throw new Error(`Failed to send prompt to chat: ${error}`);
    }
}

/**
 * Checks if the Copilot Chat view is open
 * @returns True if the chat view is open, false otherwise
 */
export function isChatViewOpen(): boolean {
    return vscode.window.tabGroups.all
        .flatMap(group => group.tabs)
        .some(tab => tab.label.includes('Copilot Chat'));
}

/**
 * Opens the Copilot Chat view if it's not already open
 */
export async function ensureChatViewOpen(): Promise<void> {
    if (!isChatViewOpen()) {
        await vscode.commands.executeCommand('github.copilot-chat.openChat');
    }
}

/**
 * Sets the Copilot agent mode (Agent, Edit, Ask)
 * @param mode The mode to set
 */
export async function setAgentMode(mode: 'Agent' | 'Edit' | 'Ask'): Promise<void> {
    try {
        // This requires knowledge of the internal commands for changing modes
        // Replace with actual command if available in the Copilot API
        await vscode.commands.executeCommand('github.copilot-chat.setAgentMode', { mode });
    } catch (error) {
        console.error(`Failed to set agent mode to ${mode}:`, error);
    }
}

/**
 * Sleep for a specified number of milliseconds
 * @param ms Number of milliseconds to sleep
 * @returns A promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}