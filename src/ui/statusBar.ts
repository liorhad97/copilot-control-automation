import * as vscode from 'vscode';

/**
 * Interface for status bar button configuration
 */
interface StatusBarButton {
    id: string;
    icon: string;
    alignment: vscode.StatusBarAlignment;
    priority: number;
}

/**
 * Create and manage the status bar items for the Marco AI extension
 */
export class StatusBarManager {
    private static instance: StatusBarManager;
    private items: Map<string, vscode.StatusBarItem> = new Map();
    
    private constructor() {}
    
    /**
     * Get the singleton instance of StatusBarManager
     */
    public static getInstance(): StatusBarManager {
        if (!StatusBarManager.instance) {
            StatusBarManager.instance = new StatusBarManager();
        }
        return StatusBarManager.instance;
    }
    
    /**
     * Initialize the status bar with buttons
     * @param context The extension context
     */
    public initialize(context: vscode.ExtensionContext): void {
        // Create standard workflow control buttons
        const buttons: StatusBarButton[] = [
            { id: 'play',    icon: 'triangle-right', alignment: vscode.StatusBarAlignment.Left, priority: 100 },
            { id: 'pause',   icon: 'debug-pause',    alignment: vscode.StatusBarAlignment.Left, priority: 99 },
            { id: 'stop',    icon: 'debug-stop',     alignment: vscode.StatusBarAlignment.Left, priority: 98 },
            { id: 'restart', icon: 'debug-restart',  alignment: vscode.StatusBarAlignment.Left, priority: 97 }
        ];
        
        // Create and add each button
        buttons.forEach(btn => {
            const item = vscode.window.createStatusBarItem(btn.alignment, btn.priority);
            item.text = `$(${btn.icon}) ${btn.id.charAt(0).toUpperCase() + btn.id.slice(1)}`;
            item.command = `marco.${btn.id}`;
            item.tooltip = `Marco AI: ${btn.id.charAt(0).toUpperCase() + btn.id.slice(1)}`;
            item.show();
            
            // Store in our map
            this.items.set(btn.id, item);
            
            // Add to subscriptions for proper disposal
            context.subscriptions.push(item);
        });
    }
    
    /**
     * Get a specific status bar item
     * @param id The ID of the item to get
     * @returns The status bar item or undefined if not found
     */
    public getItem(id: string): vscode.StatusBarItem | undefined {
        return this.items.get(id);
    }
    
    /**
     * Show a specific status bar item
     * @param id The ID of the item to show
     */
    public showItem(id: string): void {
        const item = this.items.get(id);
        if (item) {
            item.show();
        }
    }
    
    /**
     * Hide a specific status bar item
     * @param id The ID of the item to hide
     */
    public hideItem(id: string): void {
        const item = this.items.get(id);
        if (item) {
            item.hide();
        }
    }
    
    /**
     * Update a status bar item's text
     * @param id The ID of the item to update
     * @param text The new text for the item
     */
    public updateText(id: string, text: string): void {
        const item = this.items.get(id);
        if (item) {
            item.text = text;
        }
    }
    
    /**
     * Show all status bar items
     */
    public showAll(): void {
        this.items.forEach(item => item.show());
    }
    
    /**
     * Hide all status bar items
     */
    public hideAll(): void {
        this.items.forEach(item => item.hide());
    }
    
    /**
     * Dispose all status bar items
     */
    public dispose(): void {
        this.items.forEach(item => item.dispose());
        this.items.clear();
    }
}