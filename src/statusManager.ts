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

/**
 * Manages the status bar display and workflow state
 */
export class StatusManager {
    private static instance: StatusManager;
    private playPauseButton: vscode.StatusBarItem | undefined;
    private stopButton: vscode.StatusBarItem | undefined;
    private restartButton: vscode.StatusBarItem | undefined;
    private stateLabel: vscode.StatusBarItem | undefined;
    private currentState: WorkflowState = WorkflowState.Idle;
    private lastActivityTime: Date | null = null;

    // Private constructor for singleton pattern
    private constructor() {}

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
        this.playPauseButton.command = 'marco.pauseWorkflow';
        context.subscriptions.push(this.playPauseButton);

        // Create stop button
        this.stopButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.stopButton.command = 'marco.toggleWorkflow';
        context.subscriptions.push(this.stopButton);

        // Create restart button
        this.restartButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
        this.restartButton.command = 'marco.restart';
        context.subscriptions.push(this.restartButton);

        // Create state label
        this.stateLabel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97);
        context.subscriptions.push(this.stateLabel);

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
    }

    /**
     * Update status bar items based on current state
     * @param message Optional status message
     */
    private updateStatusBar(message?: string): void {
        if (!this.playPauseButton || !this.stopButton || !this.restartButton || !this.stateLabel) {
            return;
        }

        // Update all status bar items
        switch (this.currentState) {
            case WorkflowState.Idle:
                this.playPauseButton.text = "$(play) Play";
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

                this.stateLabel.text = `${icon} Marco AI: ${message || this.currentState}`;

                this.showPlayPauseButton(true);
                this.showStopButton(true);
                this.showRestartButton(true);
                break;
        }
    }

    /**
     * Show or hide the play/pause button
     * @param show Whether to show the button
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
     * @param show Whether to show the button
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
     * @param show Whether to show the button
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
     * Get the current workflow state
     * @returns The current workflow state
     */
    public getCurrentState(): WorkflowState {
        return this.currentState;
    }

    /**
     * Get the time of the last activity
     * @returns The last activity time or null if no activity has occurred
     */
    public getLastActivityTime(): Date | null {
        return this.lastActivityTime;
    }
}