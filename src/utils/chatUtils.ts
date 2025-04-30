import * as vscode from 'vscode';

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
                await vscode.commands.executeCommand('workbench.view.extension.github-copilot-chat');
                console.log('Successfully opened chat via view extension command');

                if (focusChat) {
                    await focusChatTab();
                }

                return true;
            } catch (error) {
                console.log(`View extension attempt ${attempt} failed:`, error);

                // Try yet another approach
                try {
                    await vscode.commands.executeCommand('vscode.editorChat.start');
                    console.log('Successfully started editor chat');

                    if (focusChat) {
                        await focusChatTab();
                    }

                    return true;
                } catch (error) {
                    console.log(`Editor chat start attempt ${attempt} failed:`, error);
                }
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
        await vscode.commands.executeCommand('workbench.view.extension.github-copilot-chat');
        console.log('Successfully focused Copilot Chat view.');
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

        // Wait for chat to be fully ready - increased delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        let sentSuccessfully = false;

        try {
            // Method 1: Try to send message using the chat.sendMessage command
            console.log('Attempting to send message using github.copilot-chat.sendMessage');
            await vscode.commands.executeCommand('github.copilot-chat.sendMessage', { message });
            console.log('Message sent using github.copilot-chat.sendMessage');
            sentSuccessfully = true;
        } catch (error) {
            console.log('Failed to send message via sendMessage command, trying fallback method:', error);

            try {
                // Method 2: Focus the chat and insert the message, then use command to send
                await focusChatTab();
                console.log('Chat tab focused, inserting message');
                await new Promise(resolve => setTimeout(resolve, 500));

                // Use the clipboard as intermediary to paste message
                const originalClipboard = await vscode.env.clipboard.readText();
                await vscode.env.clipboard.writeText(message);

                // Try to clear any existing text first
                await vscode.commands.executeCommand('editor.action.selectAll');
                await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                await vscode.env.clipboard.writeText(originalClipboard); // Restore clipboard

                // Send message - try multiple methods
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log('Attempting to send message with command');

                try {
                    // Method 3: Try specific chat send command
                    await vscode.commands.executeCommand('workbench.action.chat.send');
                    console.log('Message sent using workbench.action.chat.send');
                    sentSuccessfully = true;
                } catch (sendError) {
                    console.log('Failed to send using command, trying keyboard shortcut:', sendError);

                    try {
                        // Method 4: Try keyboard shortcut - Enter key
                        await vscode.commands.executeCommand('type', { text: '\n' });
                        console.log('Message sent using Enter key');
                        sentSuccessfully = true;
                    } catch (typeError) {
                        console.log('Failed to send using Enter key:', typeError);

                        try {
                            // Method 5: Last resort - Shift+Enter keyboard sequence
                            await vscode.commands.executeCommand('cursorEnd');
                            await vscode.commands.executeCommand('editor.action.insertLineAfter');
                            console.log('Attempted to send using Shift+Enter sequence');
                            sentSuccessfully = true;
                        } catch (finalError) {
                            console.error('All send methods failed:', finalError);
                        }
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback clipboard method failed:', fallbackError);
            }
        }

        // If in background mode, try to restore original focus
        if (backgroundMode && activeTabToRestore) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Increased delay before restoring focus
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

        return false; // Should not happen if viewColumn is valid

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
        console.log(`Attempting to select AI model: ${modelName}`);

        // First ensure the chat is open
        const chatOpened = await ensureChatOpen(3, 1000, true);
        if (!chatOpened) {
            console.log(`Failed to open chat before selecting model ${modelName}`);
            return false;
        }

        // Try to find and click on the model selector
        await vscode.commands.executeCommand('github.copilot-chat.selectModel', modelName);

        console.log(`Successfully selected model: ${modelName}`);
        return true;
    } catch (error) {
        console.log(`Error selecting model ${modelName}:`, error);
        return false;
    }
}

/**
 * Check if the Copilot agent might be idle
 * This is a heuristic and may not be 100% accurate
 */
export async function isAgentIdle(): Promise<boolean> {
    // This is a placeholder implementation
    // In a real implementation, you would check for indicators of agent idleness
    // For example, checking for certain UI elements or patterns in the chat

    // For now, we'll check if the last message in chat is from the agent and older than 30 seconds
    // This would require accessing the chat history which may not be directly available through API

    // Return false (not idle) by default
    return false;
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
