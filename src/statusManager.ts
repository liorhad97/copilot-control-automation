import * as vscode from 'vscode';

/**
 * Enum representing the different states of the Marco AI workflow
 */
export enum WorkflowState {
    Idle = 'idle',
    Initializing = 'initializing',
    CreatingBranch = 'creating-branch',
    SendingTask = 'sending-task',
    CheckingStatus = 'checking-status',
    RequestingTests = 'requesting-tests',
    VerifyingCompletion = 'verifying-completion',
    VerifyingChecklist = 'verifying-checklist',
    ContinuingIteration = 'continuing-iteration',
    Paused = 'paused',
    Completed = 'completed',
    Error = 'error'
}

type StateChangeListener = (state: WorkflowState, message?: string) => void;

/**
 * Manages the status display for the Marco AI workflow
 */
export class StatusManager {
    private static instance: StatusManager;
    private currentState: WorkflowState = WorkflowState.Idle;
    private statusBarItem: vscode.StatusBarItem;
    private lastUpdateTime: Date = new Date();
    private animationFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private animationIndex = 0;
    private animationInterval: NodeJS.Timeout | undefined;
    private stateChangeListeners: StateChangeListener[] = [];

    private constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
        this.updateStatusBar();
        this.statusBarItem.show();
    }

    /**
     * Get the singleton instance of StatusManager
     */
    public static getInstance(): StatusManager {
        if (!StatusManager.instance) {
            StatusManager.instance = new StatusManager();
        }
        return StatusManager.instance;
    }

    /**
     * Initialize the StatusManager with extension context
     * @param context The extension context
     */
    public initialize(context: vscode.ExtensionContext): void {
        // Add to subscriptions to ensure proper cleanup on deactivation
        context.subscriptions.push(this.statusBarItem);
    }

    /**
     * Set the current workflow state
     * @param state The new workflow state
     * @param message Optional message to display with the state
     */
    public setState(state: WorkflowState, message?: string): void {
        this.currentState = state;
        this.lastUpdateTime = new Date();
        this.updateStatusBar(message);

        // Start or stop animation based on state
        if (state === WorkflowState.Idle || state === WorkflowState.Paused ||
            state === WorkflowState.Completed || state === WorkflowState.Error) {
            this.stopAnimation();
        } else {
            this.startAnimation();
        }

        // Show notification for state changes
        if (message) {
            this.showStateNotification(state, message);
        }

        // Notify listeners of the state change
        this.notifyStateChangeListeners(state, message);
    }

    /**
     * Get the current workflow state
     */
    public getState(): WorkflowState {
        return this.currentState;
    }

    /**
     * Register a listener for state changes
     * @param listener The callback function to be called when the state changes
     */
    public onStateChanged(listener: StateChangeListener): vscode.Disposable {
        this.stateChangeListeners.push(listener);

        // Return a disposable to remove the listener
        return {
            dispose: () => {
                const index = this.stateChangeListeners.indexOf(listener);
                if (index !== -1) {
                    this.stateChangeListeners.splice(index, 1);
                }
            }
        };
    }

    /**
     * Notify all listeners of a state change
     */
    private notifyStateChangeListeners(state: WorkflowState, message?: string): void {
        for (const listener of this.stateChangeListeners) {
            listener(state, message);
        }
    }

    /**
     * Update the status bar display
     */
    private updateStatusBar(message?: string): void {
        const stateEmoji = this.getStateEmoji();
        const stateName = this.formatStateName(this.currentState);
        const elapsedTime = this.getElapsedTime();

        if (message) {
            this.statusBarItem.text = `${stateEmoji} Marco: ${stateName} - ${message} ${elapsedTime}`;
        } else {
            this.statusBarItem.text = `${stateEmoji} Marco: ${stateName} ${elapsedTime}`;
        }

        this.statusBarItem.tooltip = `Marco AI - Current state: ${stateName}\nLast updated: ${this.lastUpdateTime.toLocaleTimeString()}`;
        this.setStatusBarColor();
    }

    /**
     * Format the state enum name for display
     */
    private formatStateName(state: WorkflowState): string {
        return state.replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Get emoji representation for the current state
     */
    private getStateEmoji(): string {
        switch (this.currentState) {
            case WorkflowState.Idle: return '$(debug-pause)';
            case WorkflowState.Initializing: return '$(sync)';
            case WorkflowState.CreatingBranch: return '$(git-branch)';
            case WorkflowState.SendingTask: return '$(arrow-right)';
            case WorkflowState.CheckingStatus: return '$(question)';
            case WorkflowState.RequestingTests: return '$(beaker)';
            case WorkflowState.VerifyingCompletion: return '$(checklist)';
            case WorkflowState.Paused: return '$(debug-pause)';
            case WorkflowState.Completed: return '$(check)';
            case WorkflowState.Error: return '$(error)';
            default: return '$(question)';
        }
    }

    /**
     * Set status bar color based on state
     */
    private setStatusBarColor(): void {
        switch (this.currentState) {
            case WorkflowState.Error:
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
            case WorkflowState.Completed:
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            case WorkflowState.Paused:
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            default:
                this.statusBarItem.backgroundColor = undefined;
                break;
        }
    }

    /**
     * Calculate elapsed time since last state change
     */
    private getElapsedTime(): string {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - this.lastUpdateTime.getTime()) / 1000);

        if (elapsed < 60) {
            return `(${elapsed}s)`;
        } else {
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            return `(${minutes}m ${seconds}s)`;
        }
    }

    /**
     * Start animation for active states
     */
    private startAnimation(): void {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
        }

        this.animationInterval = setInterval(() => {
            this.animationIndex = (this.animationIndex + 1) % this.animationFrames.length;
            this.updateStatusBar();
        }, 100);
    }

    /**
     * Stop animation
     */
    private stopAnimation(): void {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = undefined;
        }
    }

    /**
     * Show a notification for state changes
     */
    private showStateNotification(state: WorkflowState, message: string): void {
        switch (state) {
            case WorkflowState.Error:
                vscode.window.showErrorMessage(`Marco AI: ${message}`);
                break;
            case WorkflowState.Completed:
                vscode.window.showInformationMessage(`Marco AI: ${message}`);
                break;
            case WorkflowState.Paused:
                vscode.window.showWarningMessage(`Marco AI: ${message}`);
                break;
            default:
                // Don't show notifications for normal state transitions
                break;
        }
    }

    /**
     * Dispose the status bar item
     */
    public dispose(): void {
        this.stopAnimation();
        this.statusBarItem.dispose();
    }
}