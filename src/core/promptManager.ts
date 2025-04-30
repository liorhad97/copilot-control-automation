import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Manages prompt templates for agent interactions
 */
export class PromptManager {
    private static instance: PromptManager;
    private prompts: Map<string, string> = new Map();
    private promptsDir: string | undefined;

    private constructor() {
        this.initializePromptDirectory();
    }

    /**
     * Get the singleton instance of PromptManager
     */
    public static getInstance(): PromptManager {
        if (!PromptManager.instance) {
            PromptManager.instance = new PromptManager();
        }
        return PromptManager.instance;
    }

    /**
     * Initialize the prompt directory path
     */
    private initializePromptDirectory(): void {
        const extensionPath = vscode.extensions.getExtension('marco-ai.marco-ai')?.extensionPath;
        if (extensionPath) {
            this.promptsDir = path.join(extensionPath, 'src', 'prompts');
        }
    }

    /**
     * Get a prompt by name, loading it if necessary
     * @param promptName The filename of the prompt
     * @returns The prompt content
     */
    public async getPrompt(promptName: string): Promise<string> {
        // Check if we already loaded this prompt
        if (this.prompts.has(promptName)) {
            return this.prompts.get(promptName) || '';
        }

        // Load the prompt
        try {
            const promptContent = await this.loadPromptFile(promptName);
            this.prompts.set(promptName, promptContent);
            return promptContent;
        } catch (error) {
            console.error(`Error loading prompt ${promptName}:`, error);
            const fallbackMessage = `Could not load prompt ${promptName}. Please continue with the development.`;
            return fallbackMessage;
        }
    }

    /**
     * Loads a prompt file from the prompts directory
     * @param fileName The name of the prompt file
     * @returns The content of the prompt file
     */
    private async loadPromptFile(fileName: string): Promise<string> {
        if (!this.promptsDir) {
            throw new Error('Prompt directory not initialized');
        }

        const promptPath = path.join(this.promptsDir, fileName);
        return new Promise<string>((resolve, reject) => {
            fs.readFile(promptPath, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    /**
     * Preload commonly used prompts to improve performance
     */
    public async preloadCommonPrompts(): Promise<void> {
        const commonPrompts = [
            'init.md',
            'check_agent.md',
            'check_checklist.md',
            'checklist.md',
            'continue_iteration.md'
        ];

        for (const promptName of commonPrompts) {
            try {
                await this.getPrompt(promptName);
            } catch (error) {
                // Just log but continue with other prompts
                console.warn(`Failed to preload prompt ${promptName}:`, error);
            }
        }
    }
}