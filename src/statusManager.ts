import * as vscode from 'vscode';

/**
 * Workflow states for the status bar
 */
export enum WorkflowState {
    Idle = 'idle',
    Initializing = 'initializing',
    CreatingBranch = 'creating-branch',
    SendingTask = 'sending-task',
    CheckingStatus = 'checking-status',
    RequestingTests = 'requesting-tests',
    VerifyingChecklist = 'verifying-checklist',
    VerifyingCompletion = 'verifying-completion',
    ContinuingIteration = 'continuing-iteration',
    Paused = 'paused',
    Completed = 'completed',
    Error = 'error'
}

type StateChangeListener = (state: WorkflowState, message?: string) => void;

/**
 * Manages the status bar display and workflow state
 */
export class StatusManager {
    private static instance: StatusManager;
    private currentState: WorkflowState = WorkflowState.Idle;
    private lastActivityTime: Date | null = null;
    private stateChangeListeners: StateChangeListener[] = [];

    // Status bar items
    private playPauseButton: vscode.StatusBarItem | undefined;
    private stopButton: vscode.StatusBarItem | undefined;
    private restartButton: vscode.StatusBarItem | undefined;
    private stateLabel: vscode.StatusBarItem | undefined;

    // Activity bar badge
    private badge: vscode.StatusBarItem | undefined;

    // Animation properties
    private animationFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private animationIndex = 0;
    private animationInterval: NodeJS.Timeout | undefined;

    // Private constructor for singleton pattern
    private constructor() { }

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
     * Initialize status bar items
     * @param context VS Code extension context
     */
    public initialize(context: vscode.ExtensionContext): void {
        // Create play/pause button
        this.playPauseButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.playPauseButton.command = 'marco.toggleWorkflow';
        this.playPauseButton.tooltip = "Start Marco AI workflow";
        context.subscriptions.push(this.playPauseButton);

        // Create stop button
        this.stopButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.stopButton.command = 'marco.toggleWorkflow';
        this.stopButton.tooltip = "Stop Marco AI workflow";
        context.subscriptions.push(this.stopButton);

        // Create restart button
        this.restartButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
        this.restartButton.command = 'marco.restart';
        this.restartButton.tooltip = "Restart Marco AI workflow";
        context.subscriptions.push(this.restartButton);

        // Create state label
        this.stateLabel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97);
        context.subscriptions.push(this.stateLabel);

        // Create badge for activity bar (will be used later for commands to show/hide)
        this.badge = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
        this.badge.text = "$(rocket) Marco";
        // this.badge.command = 'marco.openSidebar'; // Removed command to prevent auto-opening sidebar
        this.badge.tooltip = "Marco AI Status"; // Updated tooltip
        this.badge.show(); // Always show the badge
        context.subscriptions.push(this.badge);

        // Set initial state
        this.setState(WorkflowState.Idle, 'Ready');
    }

    /**
     * Set the current workflow state and update status bar
     * @param state New workflow state
     * @param message Optional status message
     */
    public setState(state: WorkflowState, message?: string): void {
        this.currentState = state;
        this.lastActivityTime = new Date();
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
    public getCurrentState(): WorkflowState {
        return this.currentState;
    }

    /**
     * Get the time of the last activity
     */
    public getLastActivityTime(): Date | null {
        return this.lastActivityTime;
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
        if (!this.playPauseButton || !this.stopButton || !this.restartButton || !this.stateLabel) {
            return;
        }

        // Update all status bar items
        switch (this.currentState) {
            case WorkflowState.Idle:
                this.playPauseButton.text = "$(play) Marco AI";
                this.playPauseButton.tooltip = "Start Marco AI workflow";
                this.stopButton.text = "$(debug-stop) Stop";
                this.stopButton.tooltip = "Stop Marco AI workflow";
                this.restartButton.text = "$(debug-restart) Restart";
                this.restartButton.tooltip = "Restart Marco AI workflow";
                this.stateLabel.text = `$(info) Marco AI: ${message || 'Ready'}`;

                this.showPlayPauseButton(true);
                this.showStopButton(false);
                this.showRestartButton(false);
                break;

            case WorkflowState.Paused:
                this.playPauseButton.text = "$(play) Resume";
                this.playPauseButton.tooltip = "Resume Marco AI workflow";
                this.stateLabel.text = `$(pause) Marco AI: ${message || 'Paused'}`;

                this.showPlayPauseButton(true);
                this.showStopButton(true);
                this.showRestartButton(true);
                break;

            case WorkflowState.Completed:
                this.stateLabel.text = `$(check) Marco AI: ${message || 'Completed'}`;

                this.showPlayPauseButton(false);
                this.showStopButton(false);
                this.showRestartButton(true);
                break;

            case WorkflowState.Error:
                this.stateLabel.text = `$(error) Marco AI: ${message || 'Error'}`;

                this.showPlayPauseButton(false);
                this.showStopButton(false);
                this.showRestartButton(true);
                break;

            default:
                // Any active state
                this.playPauseButton.text = "$(pause) Pause";
                this.playPauseButton.tooltip = "Pause Marco AI workflow";
                this.stopButton.text = "$(debug-stop) Stop";
                this.stopButton.tooltip = "Stop Marco AI workflow";
                this.restartButton.text = "$(debug-restart) Restart";
                this.restartButton.tooltip = "Restart Marco AI workflow";

                // Show state-specific icon
                let icon = "$(loading~spin)";
                switch (this.currentState) {
                    case WorkflowState.Initializing:
                        icon = "$(loading~spin)";
                        break;
                    case WorkflowState.CreatingBranch:
                        icon = "$(git-branch)";
                        break;
                    case WorkflowState.SendingTask:
                        icon = "$(comment)";
                        break;
                    case WorkflowState.RequestingTests:
                        icon = "$(beaker)";
                        break;
                    case WorkflowState.VerifyingChecklist:
                        icon = "$(checklist)";
                        break;
                    case WorkflowState.ContinuingIteration:
                        icon = "$(sync)";
                        break;
                }

                // Get elapsed time
                const elapsedTime = this.getElapsedTime();
                this.stateLabel.text = `${icon} Marco AI: ${message || this.formatStateName(this.currentState)} ${elapsedTime}`;

                this.showPlayPauseButton(true);
                this.showStopButton(true);
                this.showRestartButton(true);
                break;
        }

        // Set status bar colors
        this.setStatusBarColor();

        // Update badge based on state
        this.updateBadge();
    }

    /**
     * Update the activity bar badge based on current state
     */
    private updateBadge(): void {
        if (!this.badge) {
            return;
        }

        if (this.currentState !== WorkflowState.Idle) {
            // Show badge with state indication when workflow is active
            let badgeIcon = "$(rocket)";

            if (this.currentState === WorkflowState.Paused) {
                badgeIcon = "$(debug-pause)";
            } else if (this.currentState === WorkflowState.Error) {
                badgeIcon = "$(error)";
            } else if (this.currentState === WorkflowState.Completed) {
                badgeIcon = "$(check)";
            }

            this.badge.text = `${badgeIcon} Marco`;
            this.badge.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        } else {
            // Reset badge when idle
            this.badge.text = "$(rocket) Marco";
            this.badge.backgroundColor = undefined;
        }
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
     * Set status bar color based on state
     */
    private setStatusBarColor(): void {
        if (!this.stateLabel) {
            return;
        }

        switch (this.currentState) {
            case WorkflowState.Error:
                this.stateLabel.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
            case WorkflowState.Completed:
                this.stateLabel.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            case WorkflowState.Paused:
                this.stateLabel.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            default:
                this.stateLabel.backgroundColor = undefined;
                break;
        }
    }

    /**
     * Calculate elapsed time since last state change
     */
    private getElapsedTime(): string {
        if (!this.lastActivityTime) {
            return '';
        }

        const now = new Date();
        const elapsed = Math.floor((now.getTime() - this.lastActivityTime.getTime()) / 1000);

        if (elapsed < 60) {
            return `(${elapsed}s)`;
        } else {
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            return `(${minutes}m ${seconds}s)`;
        }
    }

    /**
     * Show or hide the play/pause button
     */
    private showPlayPauseButton(show: boolean): void {
        if (this.playPauseButton) {
            if (show) {
                this.playPauseButton.show();
            } else {
                this.playPauseButton.hide();
            }
        }
    }

    /**
     * Show or hide the stop button
     */
    private showStopButton(show: boolean): void {
        if (this.stopButton) {
            if (show) {
                this.stopButton.show();
            } else {
                this.stopButton.hide();
            }
        }
    }

    /**
     * Show or hide the restart button
     */
    private showRestartButton(show: boolean): void {
        if (this.restartButton) {
            if (show) {
                this.restartButton.show();
            } else {
                this.restartButton.hide();
            }
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
     * Dispose all status bar items
     */
    public dispose(): void {
        this.stopAnimation();

        if (this.playPauseButton) {
            this.playPauseButton.dispose();
        }

        if (this.stopButton) {
            this.stopButton.dispose();
        }

        if (this.restartButton) {
            this.restartButton.dispose();
        }

        if (this.stateLabel) {
            this.stateLabel.dispose();
        }

        if (this.badge) {
            this.badge.dispose();
        }
    }
}