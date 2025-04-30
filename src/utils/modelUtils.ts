import * as vscode from 'vscode';

/**
 * Attempts to select an AI model for the Copilot Chat
 * @param modelName The name of the model to select
 * @returns Promise resolving to true if model selected successfully
 */
export async function selectAIModel(modelName: string): Promise<boolean> {
    try {
        // Check if model selection command exists
        const commands = await vscode.commands.getCommands();
        const hasModelSelection = commands.some(cmd => cmd.includes('selectModel') || cmd.includes('model.select'));
        
        if (!hasModelSelection) {
            console.warn(`Model selection not available for: ${modelName}`);
            return false;
        }
        
        // Attempt to select the model - this will need to be adapted based on the
        // actual command name available in the Copilot extension
        await vscode.commands.executeCommand('github.copilot-chat.selectModel', {
            model: modelName
        });
        
        console.log(`Successfully selected model: ${modelName}`);
        return true;
    } catch (error) {
        console.error(`Failed to select model ${modelName}:`, error);
        return false;
    }
}