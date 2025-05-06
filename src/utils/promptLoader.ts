/**
 * Prompt Loader Utility
 * Loads prompt templates from files and performs variable substitution
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Manages the loading and processing of prompt templates
 */
export class PromptLoader {
    /**
     * Loads a prompt template from the prompts directory and substitutes variables
     * @param context VS Code extension context
     * @param promptName Name of the prompt file (without extension)
     * @param variables Object containing variable names and values for substitution
     * @returns The processed prompt text
     */
    public static async loadPrompt(
        context: vscode.ExtensionContext,
        promptName: string,
        variables: Record<string, string> = {}
    ): Promise<string> {
        try {
            // Get path to the prompt file
            const promptsPath = path.join(context.extensionPath, 'src', 'prompts');
            const promptFilePath = path.join(promptsPath, `${promptName}.txt`);
            
            // Read the prompt template
            let promptTemplate = fs.readFileSync(promptFilePath, 'utf8');
            
            // Substitute variables
            Object.entries(variables).forEach(([key, value]) => {
                promptTemplate = promptTemplate.replace(`$${key}$`, value);
            });
            
            return promptTemplate;
        } catch (error) {
            console.error(`Error loading prompt '${promptName}':`, error);
            throw new Error(`Failed to load prompt '${promptName}': ${error}`);
        }
    }
}
