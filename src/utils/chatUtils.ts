import * as vscode from 'vscode';
import { sleep } from './helpers';

/**
 * Ensures that the Copilot Chat panel is open
 * @param maxAttempts Maximum number of attempts to open chat
 * @param interval Interval between attempts in milliseconds
 * @param focus Whether to focus the chat panel
 * @returns Promise resolving to true if chat opened successfully
 */
export async function ensureChatOpen(maxAttempts: number = 5, interval: number = 1000, focus: boolean = true): Promise<boolean> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            // Try to open Copilot Chat
            await vscode.commands.executeCommand('github.copilot.interactiveEditor.explain');
            
            // Give the chat time to open
            await sleep(interval);
            
            // If focus is requested, ensure it's in focus
            if (focus) {
                await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
            }
            
            return true;
        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
                console.error('Failed to open Copilot Chat after multiple attempts:', error);
                return false;
            }
            
            // Wait before trying again
            await sleep(interval);
        }
    }
    
    return false;
}

/**
 * Sends a message to the Copilot Chat
 * @param message Message content to send
 * @param backgroundMode Whether to operate in background mode (don't focus)
 * @returns Promise resolving when message is sent
 */
export async function sendChatMessage(message: string, backgroundMode: boolean = false): Promise<void> {
    try {
        // Ensure chat is open but honor background mode for focus
        await ensureChatOpen(5, 1000, !backgroundMode);
        
        // Send the message to Copilot Chat
        await vscode.commands.executeCommand('github.copilot-chat.sendMessage', {
            message: message
        });
        
        // If in background mode, we might want to minimize or unfocus the chat
        if (backgroundMode) {
            // Switch focus back to editor after sending message
            await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        }
    } catch (error) {
        console.error('Error sending message to Copilot Chat:', error);
        throw error;
    }
}