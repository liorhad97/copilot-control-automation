import * as vscode from 'vscode';
import { PromptLoadError } from '../errors/WorkflowErrors';

/**
 * Service for loading prompt files from the extension's prompts directory
 */
export class PromptLoader {
  private context: vscode.ExtensionContext;

  /**
   * Create a new PromptLoader
   * @param context The extension context
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Loads a prompt file from the prompts directory
   * @param fileName The name of the prompt file (without extension)
   * @returns Promise resolving to the content of the prompt file
   * @throws PromptLoadError if the file cannot be loaded
   */
  public async loadPromptFile(fileName: string): Promise<string> {
    // Try with .txt extension first, then fall back to .md
    const filePathBase = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'prompts', fileName);
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
        throw new PromptLoadError(fileName, mdError instanceof Error ? mdError : new Error(String(mdError)));
      }
    }
  }
}