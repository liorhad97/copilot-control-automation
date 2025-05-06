import * as vscode from 'vscode';

// Added for idle check
let lastMessageTime: number | null = null;
const IDLE_THRESHOLD = 300000; // 5 minutes in milliseconds

/**
 * Ensures the Copilot Chat is open with multiple retry attempts
 * @param retries Number of retry attempts (default: 5)
 * @param delayMs Delay between attempts in milliseconds (default: 1000)
 * @param focusChat Whether to focus on the chat after opening (default: false)
 * @returns Promise resolving to true if chat was opened successfully, false otherwise
 */
export async function ensureChatOpen(retries = 5, delayMs = 1000, focusChat = false): Promise<boolean> {
    console.log('Attempting to ensure chat is open...');

    // First check if chat is already open
    try {
        const views = vscode.window.tabGroups.all;
        const chatOpen = views.some(g => g.tabs.some(t => t.label.includes('Copilot Chat')));

        if (chatOpen) {
            console.log('Chat is already open');

            // Focus on chat if requested
            if (focusChat) {
                await focusChatTab();
            }

            return true;
        }
    } catch (err) {
        console.log('Error checking if chat is open:', err);
    }

    // If not open, try to open it
    for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`Chat open attempt ${attempt}/${retries}`);

        try {
            // Try standard command - this seems more reliable
            await vscode.commands.executeCommand('workbench.action.chat.open', { query: '' });
            console.log('Successfully opened chat using workbench.action.chat.open');

            if (focusChat) {
                await focusChatTab(); // Still attempt to focus
            }

            return true;
        } catch (error) {
            console.log(`Attempt ${attempt} failed with standard command:`, error);

            // Wait before trying next approach (if any were added back)
            await new Promise(resolve => setTimeout(resolve, delayMs));

            // Removed the attempt using 'workbench.view.extension.github-copilot-chat' as it was failing
            // Removed the attempt using 'vscode.editorChat.start' as it opens editor chat, not the view

        }

        // Wait before next retry cycle
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // All attempts failed
    vscode.window.showWarningMessage('Failed to open GitHub Copilot Chat. Please make sure the extension is installed.');
    return false;
}

/**
 * Attempt to focus on the Copilot Chat tab
 */
async function focusChatTab(): Promise<boolean> {
    try {
        // Use the command designed to show/focus the chat view
        // Try the standard open command again, hoping it brings focus
        await vscode.commands.executeCommand('workbench.action.chat.open');
        console.log('Attempted to focus Copilot Chat view via workbench.action.chat.open');
        // It's hard to guarantee focus was set, but we tried.
        return true;
    } catch (error) {
        console.error('Error focusing chat tab via command:', error);
        // If the command fails, it likely means chat isn't available/installed correctly.
        return false;
    }
}

/**
 * Send a message to GitHub Copilot Chat using multiple fallback approaches
 * @param message The message to send to the chat
 * @param backgroundMode Whether to preserve user's current focus after sending (default: false)
 * @returns Promise resolving to true if message was sent successfully
 */
export async function sendChatMessage(message: string, backgroundMode = false): Promise<boolean> {
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
        await new Promise(resolve => setTimeout(resolve, 1000));
        await vscode.commands.executeCommand('workbench.action.chat.send');

        let sentSuccessfully = false;

        // Try different methods to send a message
        try {
            // Assuming one of the methods sets sentSuccessfully = true on success
            sentSuccessfully = true; // Placeholder for actual logic
        } catch (error) {
            console.error('Error during message sending:', error);
        }

        // Update last message time if sent successfully
        if (sentSuccessfully) {
            lastMessageTime = Date.now();
            console.log(`Updated lastMessageTime: ${lastMessageTime}`);
        }

        if (backgroundMode && activeTabToRestore) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await restoreFocus(activeTabToRestore);
        }
        return sentSuccessfully;
    } catch (error) {
        console.error('Failed to send message:', error);
        return false;
    }
}

/**
 * Attempt to restore focus to a previously active tab
 */
async function restoreFocus(tabToRestore: vscode.Tab): Promise<boolean> {
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
                // Fallback or indicate failure
                return false;
        }

        if (focusCommand) {
            await vscode.commands.executeCommand(focusCommand);
            console.log(`Attempted to restore focus to group containing tab: ${tabToRestore.label}`);
            // Note: This focuses the group, not necessarily the specific tab within it.
            return true;
        }

        // This case should ideally not be reached if viewColumn is valid
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
export async function selectAIModel(modelName: string): Promise<boolean> {
    try {
        console.log(`Model preference logged: ${modelName}`);
        
        // We no longer attempt to select models via commands
        // Instead, we leave this for the user to configure via the API
        
        // This is now just a logging function that returns true
        // to indicate we've acknowledged the model preference
        return true;
    } catch (error) {
        console.log(`Error logging model preference ${modelName}:`, error);
        return false;
    }
}

/**
 * Check if the Copilot agent might be idle based on time since last message sent by this extension
 * This is a heuristic and may not be 100% accurate
 */
export async function isAgentIdle(): Promise<boolean> {
    if (lastMessageTime === null) {
        console.log('isAgentIdle: No message sent yet, assuming idle.');
        return true; // No message sent yet, assume idle
    }
    const timeSinceLastMessage = Date.now() - lastMessageTime;
    const isIdle = timeSinceLastMessage > IDLE_THRESHOLD;
    console.log(`isAgentIdle: Time since last message = ${timeSinceLastMessage}ms. Idle = ${isIdle}`);
    return isIdle;
}

/**
 * Checks if the Copilot agent is currently working by examining the UI elements
 * @returns Promise<boolean> True if the agent is actively working, false otherwise
 */
export async function isAgentWorking(): Promise<boolean> {
    try {
        // Check for active input state in the chat view
        const chatView = vscode.window.tabGroups.all
            .flatMap(group => group.tabs)
            .find(tab => tab.label.includes('Copilot Chat'));

        if (!chatView) {
            return false; // Chat view not open, agent can't be working
        }

        // Look for the "Stop Generating" button which indicates active generation
        // This requires accessing internal API which may not be stable
        // For a more reliable implementation, consider using the VS Code API when available
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
