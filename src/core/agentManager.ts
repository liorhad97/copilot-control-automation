import * as vscode from 'vscode';
import { ensureChatOpen, sendChatMessage } from '../utils/chatUtils';
import { selectAIModel } from '../utils/modelUtils';

/**
 * Manages interactions with the AI agent (Copilot)
 */
export class AgentManager {
    private static instance: AgentManager;
    private backgroundMode: boolean = false;
    private lastInteractionTime: Date = new Date();

    private constructor() {}

    /**
     * Get the singleton instance of AgentManager
     */
    public static getInstance(): AgentManager {
        if (!AgentManager.instance) {
            AgentManager.instance = new AgentManager();
        }
        return AgentManager.instance;
    }

    /**
     * Sets whether the agent should operate in background mode
     * @param enabled Whether background mode is enabled
     */
    public setBackgroundMode(enabled: boolean): void {
        this.backgroundMode = enabled;
    }

    /**
     * Gets whether the agent is operating in background mode
     */
    public isBackgroundMode(): boolean {
        return this.backgroundMode;
    }

    /**
     * Records the time of the last interaction with the agent
     */
    public updateLastInteractionTime(): void {
        this.lastInteractionTime = new Date();
    }

    /**
     * Gets the time of the last interaction with the agent
     */
    public getLastInteractionTime(): Date {
        return this.lastInteractionTime;
    }

    /**
     * Ensures the Copilot Chat panel is open
     * @param maxAttempts Maximum number of attempts to open chat
     * @param interval Interval between attempts in milliseconds
     * @param focus Whether to focus the chat panel
     */
    public async ensureChatOpen(maxAttempts: number = 5, interval: number = 1000, focus: boolean = true): Promise<boolean> {
        return ensureChatOpen(maxAttempts, interval, focus);
    }

    /**
     * Sends a message to the Copilot Chat
     * @param message Message content to send
     * @param background Whether to operate in background mode
     */
    public async sendChatMessage(message: string, background?: boolean): Promise<void> {
        const useBackgroundMode = background !== undefined ? background : this.backgroundMode;
        await sendChatMessage(message, useBackgroundMode);
        this.updateLastInteractionTime();
    }

    /**
     * Attempts to select an AI model for the agent
     * @param modelName The name of the model to select
     */
    public async selectModel(modelName: string): Promise<boolean> {
        return await selectAIModel(modelName);
    }

    /**
     * Determines if the agent appears idle based on time since last activity
     * @param timeoutSeconds Seconds after which agent is considered idle
     */
    public isIdle(timeoutSeconds: number = 30): boolean {
        const elapsedMs = new Date().getTime() - this.lastInteractionTime.getTime();
        return elapsedMs > (timeoutSeconds * 1000);
    }
}
