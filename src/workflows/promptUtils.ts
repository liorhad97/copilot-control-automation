import * as vscode from 'vscode';

/**
 * Loads a prompt file from the prompts directory using the extension context
 * @param context The VS Code extension context
 * @param fileName The name of the prompt file (without extension)
 * @returns The content of the prompt file
 */
export async function loadPromptFile(context: vscode.ExtensionContext, fileName: string): Promise<string> {
    const filePathBase = vscode.Uri.joinPath(context.extensionUri, 'src', 'prompts', fileName);
    const txtFilePath = filePathBase.with({ path: filePathBase.path + '.txt' });
    const mdFilePath = filePathBase.with({ path: filePathBase.path + '.md' });

    try {
        console.log(`Attempting to load prompt from: ${txtFilePath.fsPath}`);
        const contentBytes = await vscode.workspace.fs.readFile(txtFilePath);
        const content = new TextDecoder().decode(contentBytes);
        console.log(`Successfully loaded prompt from ${txtFilePath.fsPath}`);
        return content;
    } catch (error) {
        console.warn(`Failed to load prompt ${fileName}.txt: ${error}. Trying .md fallback.`);
        try {
            console.log(`Attempting to load prompt from: ${mdFilePath.fsPath}`);
            const contentBytes = await vscode.workspace.fs.readFile(mdFilePath);
            const content = new TextDecoder().decode(contentBytes);
            console.log(`Successfully loaded prompt from ${mdFilePath.fsPath}`);
            return content;
        } catch (mdError) {
            console.error(`Failed to load prompt ${fileName} (.txt or .md):`, mdError);
            // Return a specific error message that can be sent to chat if needed
            return `Error: Could not load prompt file '${fileName}'. Please check extension installation and file paths.`;
        }
    }
}

/**
 * Sends the development checklist to the chat
 * @param context The VS Code extension context
 * @param backgroundMode Whether to preserve user's current focus after sending
 */
export async function sendChecklistToChat(context: vscode.ExtensionContext, backgroundMode: boolean): Promise<void> {
    // Import here to avoid circular dependencies
    const { sendChatMessage } = await import('../utils/chatUtils');
    
    // Load checklist from prompt file (pass filename without extension)
    const checklist = await loadPromptFile(context, 'checklist');
    await sendChatMessage(checklist, backgroundMode);
}

/**
 * Sends test writing instructions to the chat
 * @param context The VS Code extension context
 * @param backgroundMode Whether to preserve user's current focus after sending
 */
export async function sendTestInstructionsToChat(context: vscode.ExtensionContext, backgroundMode: boolean): Promise<void> {
    // This function is a placeholder in the original code
    // Implementation can be added as needed
}
