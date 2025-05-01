import * as vscode from 'vscode';
import { CommunicationError } from '../errors/WorkflowErrors';
import { retry, sleep } from '../utils/Helpers';

/**
 * Service for interacting with the Copilot chat interface
 */
export class ChatUtils {
  // Tracking last message time for idle detection
  private static lastMessageTime: number | null = null;
  private static readonly IDLE_THRESHOLD = 60000; // 60 seconds in milliseconds

  /**
   * Ensures the Copilot Chat is open with multiple retry attempts
   * @param maxAttempts Number of retry attempts (default: 5)
   * @param delayBetweenAttempts Delay between attempts in milliseconds (default: 1000)
   * @param shouldFocus Whether to focus on the chat after opening (default: false)
   * @returns Promise resolving to true if chat was opened successfully, false otherwise
   */
  public static async ensureChatOpen(
    maxAttempts = 5,
    delayBetweenAttempts = 1000,
    shouldFocus = false
  ): Promise<boolean> {
    console.log('Attempting to ensure chat is open...');

    // First check if chat is already open
    try {
      const views = vscode.window.tabGroups.all;
      const chatOpen = views.some(g => g.tabs.some(t => t.label.includes('Copilot Chat')));

      if (chatOpen) {
        console.log('Chat is already open');

        // Focus on chat if requested
        if (shouldFocus) {
          await this.focusChatTab();
        }

        return true;
      }
    } catch (err) {
      console.log('Error checking if chat is open:', err);
    }

    // If not open, try to open it with retries
    return await retry(
      async () => {
        try {
          // Try standard command - this seems more reliable
          await vscode.commands.executeCommand('workbench.action.chat.open', { query: '' });
          console.log('Successfully opened chat using workbench.action.chat.open');

          if (shouldFocus) {
            await this.focusChatTab();
          }

          return true;
        } catch (error) {
          console.log(`Chat open attempt failed with standard command:`, error);
          throw new CommunicationError(`Failed to open chat: ${error}`);
        }
      },
      maxAttempts,
      delayBetweenAttempts
    ).catch(error => {
      // All attempts failed
      vscode.window.showWarningMessage('Failed to open GitHub Copilot Chat. Please make sure the extension is installed.');
      return false;
    });
  }

  /**
   * Attempt to focus on the Copilot Chat tab
   */
  private static async focusChatTab(): Promise<boolean> {
    try {
      // Use the command designed to show/focus the chat view
      await vscode.commands.executeCommand('workbench.action.chat.open');
      console.log('Attempted to focus Copilot Chat view');
      return true;
    } catch (error) {
      console.error('Error focusing chat tab via command:', error);
      // If the command fails, it likely means chat isn't available/installed correctly.
      return false;
    }
  }

  /**
   * Send a message to GitHub Copilot Chat
   * @param message The message to send to the chat
   * @param backgroundMode Whether to preserve user's current focus after sending (default: false)
   * @returns Promise resolving to true if message was sent successfully
   */
  public static async sendChatMessage(message: string, backgroundMode = false): Promise<boolean> {
    let activeTabToRestore: vscode.Tab | undefined = undefined;

    if (backgroundMode) {
      try {
        const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
        activeTabToRestore = activeTabGroup?.activeTab;
      } catch (error) {
        console.log('Error getting active tab info:', error);
      }
    }

    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', message);
      await sleep(1000);
      await vscode.commands.executeCommand('workbench.action.chat.send');

      // Update last message time
      this.lastMessageTime = Date.now();
      console.log(`Updated lastMessageTime: ${this.lastMessageTime}`);

      if (backgroundMode && activeTabToRestore) {
        await sleep(1500);
        await this.restoreFocus(activeTabToRestore);
      }
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  /**
   * Attempt to restore focus to a previously active tab
   */
  private static async restoreFocus(tabToRestore: vscode.Tab): Promise<boolean> {
    try {
      // For text documents (most common case)
      if (tabToRestore.input instanceof vscode.TabInputText) {
        const uri = tabToRestore.input.uri;
        const viewColumn = tabToRestore.group.viewColumn;

        // Show the document and give it focus
        await vscode.window.showTextDocument(uri, {
          viewColumn,
          preserveFocus: false
        });
        console.log(`Restored focus to text document: ${tabToRestore.label}`);
        return true;
      }

      // For non-text document tabs, try to focus the group containing the tab
      const group = tabToRestore.group;
      const viewColumn = group.viewColumn;
      let focusCommand: string | undefined;

      // Map viewColumn to focus commands
      switch (viewColumn) {
        case vscode.ViewColumn.One: focusCommand = 'workbench.action.focusFirstEditorGroup'; break;
        case vscode.ViewColumn.Two: focusCommand = 'workbench.action.focusSecondEditorGroup'; break;
        case vscode.ViewColumn.Three: focusCommand = 'workbench.action.focusThirdEditorGroup'; break;
        case vscode.ViewColumn.Four: focusCommand = 'workbench.action.focusFourthEditorGroup'; break;
        case vscode.ViewColumn.Five: focusCommand = 'workbench.action.focusFifthEditorGroup'; break;
        case vscode.ViewColumn.Six: focusCommand = 'workbench.action.focusSixthEditorGroup'; break;
        case vscode.ViewColumn.Seven: focusCommand = 'workbench.action.focusSeventhEditorGroup'; break;
        case vscode.ViewColumn.Eight: focusCommand = 'workbench.action.focusEighthEditorGroup'; break;
        case vscode.ViewColumn.Nine: focusCommand = 'workbench.action.focusNinthEditorGroup'; break;
        default:
          console.warn(`Cannot reliably focus non-text tab in view column: ${viewColumn}`);
          return false;
      }

      if (focusCommand) {
        await vscode.commands.executeCommand(focusCommand);
        console.log(`Attempted to restore focus to group containing tab: ${tabToRestore.label}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error restoring focus:', error);
      return false;
    }
  }

  /**
   * Attempt to select specific AI model in Copilot Chat
   * @param modelName The name of the model to select
   * @returns Promise resolving to true if successful
   */
  public static async selectAIModel(modelName: string): Promise<boolean> {
    try {
      console.log(`Attempting to select AI model: ${modelName}`);

      // First ensure the chat is open
      const chatOpened = await this.ensureChatOpen(3, 1000, true);
      if (!chatOpened) {
        console.log(`Failed to open chat before selecting model ${modelName}`);
        return false;
      }

      // Try to select the model
      await vscode.commands.executeCommand('github.copilot-chat.selectModel', modelName);

      console.log(`Successfully selected model: ${modelName}`);
      return true;
    } catch (error) {
      console.log(`Error selecting model ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Check if the Copilot agent might be idle based on time since last message
   * @returns Promise resolving to true if agent appears to be idle
   */
  public static async isAgentIdle(): Promise<boolean> {
    if (this.lastMessageTime === null) {
      console.log('isAgentIdle: No message sent yet, assuming idle.');
      return true; // No message sent yet, assume idle
    }
    const timeSinceLastMessage = Date.now() - this.lastMessageTime;
    const isIdle = timeSinceLastMessage > this.IDLE_THRESHOLD;
    console.log(`isAgentIdle: Time since last message = ${timeSinceLastMessage}ms. Idle = ${isIdle}`);
    return isIdle;
  }

  /**
   * Checks if the Copilot agent is currently working
   * @returns Promise resolving to true if agent is actively working
   */
  public static async isAgentWorking(): Promise<boolean> {
    try {
      // Check for active chat view
      const chatView = vscode.window.tabGroups.all
        .flatMap(group => group.tabs)
        .find(tab => tab.label.includes('Copilot Chat'));

      if (!chatView) {
        return false; // Chat view not open, agent can't be working
      }

      // Look for the "Stop Generating" button which indicates active generation
      const stopGeneratingCommand = await vscode.commands.getCommands(true)
        .then(commands => commands.find(cmd =>
          cmd === 'github.copilot-chat.stopGenerating' ||
          cmd.includes('stopGenerating')
        ));

      // If the command exists and is enabled, the agent is likely working
      if (stopGeneratingCommand) {
        // We can't directly check if the command is enabled without executing it
        // Instead, we can check if chat view is active and has focus
        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        return !!(activeTab && activeTab.label.includes('Copilot Chat'));
      }

      return false;
    } catch (error) {
      console.error('Failed to check if agent is working:', error);
      return false; // Assume not working in case of error
    }
  }
}