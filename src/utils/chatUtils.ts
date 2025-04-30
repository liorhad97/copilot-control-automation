import * as vscode from 'vscode';

/**
 * Ensures the Copilot Chat is open with multiple retry attempts
 * @param retries Number of retry attempts (default: 3)
 * @param delayMs Delay between attempts in milliseconds (default: 1000)
 * @param focusChat Whether to focus on the chat after opening (default: false)
 * @returns Promise resolving to true if chat was opened successfully, false otherwise
 */
export async function ensureChatOpen(retries = 3, delayMs = 1000, focusChat = false): Promise<boolean> {
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
            // Try standard command
            await vscode.commands.executeCommand('workbench.action.chat.open', { query: '' });
            console.log('Successfully opened chat');

            if (focusChat) {
                await focusChatTab();
            }

            return true;
        } catch (error) {
            console.log(`Attempt ${attempt} failed with standard command:`, error);

            // Wait before trying next approach
            await new Promise(resolve => setTimeout(resolve, delayMs));

            try {
                // Try backup command
                await vscode.commands.executeCommand('github.copilot.chat.focus');
                console.log('Successfully opened chat via focus command');

                if (focusChat) {
                    await focusChatTab();
                }

                return true;
            } catch (error) {
                console.log(`Focus attempt ${attempt} failed:`, error);
            }
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
        await vscode.commands.executeCommand('github.copilot.chat.focus');
        console.log('Successfully focused Copilot Chat view.');
        return true;
    } catch (error) {
        console.error('Error focusing chat tab via command:', error);
        // Try alternative focus method
        try {
            await vscode.commands.executeCommand('workbench.action.chat.open', { query: '' });
            return true;
        } catch (err) {
            console.error('Alternative focus method failed:', err);
            return false;
        }
    }
}

/**
 * Send a message to GitHub Copilot Chat
 * @param message The message to send to the chat
 * @param backgroundMode Whether to preserve user's current focus after sending (default: false)
 * @returns Promise resolving to true if message was sent successfully
 */
export async function sendChatMessage(message: string, backgroundMode = false): Promise<boolean> {
    // Store current active tab if we need to restore it later (when in background mode)
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
        // First ensure chat is open, focusing on it if not in background mode
        const chatOpened = await ensureChatOpen(3, 1000, !backgroundMode);
        if (!chatOpened) {
            console.error('Failed to open chat');
            return false;
        }

        // Wait for chat to be fully ready
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            // Primary method: Use direct command to send message
            await vscode.commands.executeCommand('github.copilot.chat.sendMessage', { message });
            console.log('Message sent successfully');
            return true;
        } catch (error) {
            console.log('Failed to send message via direct command, trying alternative:', error);
            
            // Alternative method: Try to use chat.accepted command
            try {
                // Focus the chat panel first
                await focusChatTab();
                
                // Use clipboard as an intermediary
                const originalClipboard = await vscode.env.clipboard.readText();
                await vscode.env.clipboard.writeText(message);
                
                // Clear any existing text and paste the message
                await vscode.commands.executeCommand('editor.action.selectAll');
                await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                
                // Send the message
                await vscode.commands.executeCommand('workbench.action.chat.sendMessage');
                
                // Restore original clipboard content
                await vscode.env.clipboard.writeText(originalClipboard);
                
                console.log('Message sent via alternative method');
                return true;
            } catch (altError) {
                console.error('Alternative send method failed:', altError);
                return false;
            }
        }
    } catch (error) {
        console.error('Failed to send message:', error);
        return false;
    } finally {
        // If in background mode, try to restore original focus
        if (backgroundMode && activeTabToRestore) {
            await new Promise(resolve => setTimeout(resolve, 500));
            await restoreFocus(activeTabToRestore);
        }
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

        // Try to focus the group containing the tab
        const group = tabToRestore.group;
        await vscode.window.showTextDocument(vscode.Uri.file(''), {
            viewColumn: group.viewColumn,
            preserveFocus: false
        });
        
        return true;
    } catch (error) {
        console.error('Error restoring focus:', error);
        return false;
    }
}

/**
 * Check if the Copilot agent is currently working
 * @returns Promise<boolean> True if the agent is actively working, false otherwise
 */
export async function isAgentWorking(): Promise<boolean> {
    try {
        // Check if chat is open
        const views = vscode.window.tabGroups.all;
        const chatOpen = views.some(g => g.tabs.some(t => t.label.includes('Copilot Chat')));
        
        if (!chatOpen) {
            return false;
        }
        
        // Check for active generation
        const commands = await vscode.commands.getCommands(true);
        const hasStopCommand = commands.some(cmd => {
            return cmd === 'github.copilot.chat.stopGenerating' || 
                   cmd.includes('stopGenerating');
        });
        
        return hasStopCommand;
    } catch (error) {
        console.error('Failed to check if agent is working:', error);
        return false;
    }
}
