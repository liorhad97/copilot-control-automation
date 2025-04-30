import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getWorkspaceRoot } from '../utils';
import { sendChatMessage } from '../utils/chatUtils';

/**
 * Service for handling prompts and sending them to the chat
 */
export class PromptService {
    private static instance: PromptService;

    private constructor() {}

    /**
     * Get the singleton instance of PromptService
     */
    public static getInstance(): PromptService {
        if (!PromptService.instance) {
            PromptService.instance = new PromptService();
        }
        return PromptService.instance;
    }

    /**
     * Read a prompt file from the prompts directory
     * @param fileName The name of the prompt file to read
     * @returns Promise resolving to the content of the prompt file
     */
    public async readPromptFile(fileName: string): Promise<string> {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
            throw new Error("Workspace root not found.");
        }

        // Handle both with and without .txt extension
        const fileNameWithExt = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
        const filePath = path.join(workspaceRoot, 'src', 'prompts', fileNameWithExt);

        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return content;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read prompt file: ${fileName}`);
            console.error(`Error reading prompt file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Send a prompt file to the chat
     * @param fileName The name of the prompt file to send
     * @param backgroundMode Whether to preserve user's current focus after sending
     * @returns Promise resolving to true if the prompt was sent successfully
     */
    public async sendPromptFileToChat(fileName: string, backgroundMode = false): Promise<boolean> {
        try {
            const content = await this.readPromptFile(fileName);
            return await sendChatMessage(content, backgroundMode);
        } catch (error) {
            console.error(`Failed to send prompt file ${fileName} to chat:`, error);
            return false;
        }
    }

    /**
     * Send a direct message to the chat
     * @param message The message to send
     * @param backgroundMode Whether to preserve user's current focus after sending
     * @returns Promise resolving to true if the message was sent successfully
     */
    public async sendMessage(message: string, backgroundMode = false): Promise<boolean> {
        return await sendChatMessage(message, backgroundMode);
    }
}