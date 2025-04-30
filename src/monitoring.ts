import * as vscode from 'vscode';
import { StatusManager, WorkflowState } from './statusManager';
import { ensureChatOpen, isAgentWorking } from './utils/chatUtils';
import { PromptService } from './services/promptService';

/**
 * Class responsible for monitoring the agent's status
 */
export class AgentMonitor {
    private static instance: AgentMonitor;
    private checkAgentIntervalId: NodeJS.Timeout | undefined;
    private ensureChatIntervalId: NodeJS.Timeout | undefined;
    private statusManager: StatusManager;
    private promptService: PromptService;

    private constructor() {
        this.statusManager = StatusManager.getInstance();
        this.promptService = PromptService.getInstance();
    }

    /**
     * Get the singleton instance of AgentMonitor
     */
    public static getInstance(): AgentMonitor {
        if (!AgentMonitor.instance) {
            AgentMonitor.instance = new AgentMonitor();
        }
        return AgentMonitor.instance;
    }

    /**
     * Start monitoring the agent's status
     * @param context The extension context
     */
    public startMonitoring(context: vscode.ExtensionContext): void {
        this.stopMonitoring(); // Clear any existing intervals

        // Check agent status every 10 seconds
        this.checkAgentIntervalId = setInterval(() => {
            this.checkAgentAlive().catch(err => {
                console.error('Error in agent monitoring:', err);
            });
        }, 10_000);

        // Ensure chat is open every 5 minutes
        this.ensureChatIntervalId = setInterval(() => {
            this.ensureChatIsOpen().catch(err => {
                console.error('Error ensuring chat is open:', err);
            });
        }, 5 * 60_000);

        // Add to subscriptions to ensure proper cleanup on deactivation
        context.subscriptions.push({
            dispose: () => this.stopMonitoring()
        });
    }

    /**
     * Stop all monitoring activities
     */
    public stopMonitoring(): void {
        if (this.checkAgentIntervalId) {
            clearInterval(this.checkAgentIntervalId);
            this.checkAgentIntervalId = undefined;
        }

        if (this.ensureChatIntervalId) {
            clearInterval(this.ensureChatIntervalId);
            this.ensureChatIntervalId = undefined;
        }
    }

    /**
     * Check if the agent is alive and prompt if idle
     */
    private async checkAgentAlive(): Promise<void> {
        const currentState = this.statusManager.getState();

        // Skip check for these states
        if (currentState === WorkflowState.Idle ||
            currentState === WorkflowState.Paused ||
            currentState === WorkflowState.Error ||
            currentState === WorkflowState.Completed) {
            return;
        }

        // Check for idleness based on time and status
        const isIdle = await this.isAgentIdle();
        if (isIdle) {
            console.log('Agent appears to be idle, sending prompt...');
            await this.promptService.sendMessage('Are you still working on the task? Please provide an update on your progress.');
        }
    }

    /**
     * Determine if the agent is idle
     */
    private async isAgentIdle(): Promise<boolean> {
        // Check if agent is actively working (e.g., generating content)
        const isWorking = await isAgentWorking();
        if (isWorking) {
            return false;
        }

        // Check based on time since last status update
        const lastActivityTime = this.statusManager.getLastUpdateTime();
        if (!lastActivityTime) {
            return false;
        }

        const config = vscode.workspace.getConfiguration('marco');
        const idleTimeoutMs = config.get<number>('idleTimeoutSeconds', 30) * 1000;

        const timeSinceLastActivity = Date.now() - lastActivityTime.getTime();
        return timeSinceLastActivity > idleTimeoutMs;
    }

    /**
     * Ensure the Copilot Chat panel is open
     */
    private async ensureChatIsOpen(): Promise<void> {
        const currentState = this.statusManager.getState();

        // Only ensure chat is open if we're in an active workflow state
        if (currentState !== WorkflowState.Idle &&
            currentState !== WorkflowState.Paused &&
            currentState !== WorkflowState.Error &&
            currentState !== WorkflowState.Completed) {

            await ensureChatOpen(3, 1000, false);
        }
    }
}