import * as vscode from 'vscode';

/**
 * AI Model preferences
 */
export enum AIModel {
    Claude37Sonnet = 'Claude 3.7 Sonnet',
    Gemini25 = 'Gemini 2.5',
    GPT41 = 'GPT 4.1'
}

/**
 * Service for handling AI model selection and preferences
 */
export class ModelService {
    private static instance: ModelService;
    private preferredModelOrder: AIModel[] = [
        AIModel.Claude37Sonnet,
        AIModel.Gemini25,
        AIModel.GPT41
    ];
    private currentModel: AIModel | null = null;
    
    private constructor() {}
    
    /**
     * Get the singleton instance of ModelService
     */
    public static getInstance(): ModelService {
        if (!ModelService.instance) {
            ModelService.instance = new ModelService();
        }
        return ModelService.instance;
    }
    
    /**
     * Try to select the preferred AI model
     * @returns Promise resolving to the selected model or null if not available
     */
    public async selectPreferredModel(): Promise<AIModel | null> {
        // Try each model in order of preference
        for (const model of this.preferredModelOrder) {
            const success = await this.trySelectModel(model);
            if (success) {
                this.currentModel = model;
                return model;
            }
        }
        
        // No model could be selected
        return null;
    }
    
    /**
     * Try to select a specific AI model
     * @param model The model to select
     * @returns Promise resolving to true if successful
     */
    private async trySelectModel(model: AIModel): Promise<boolean> {
        try {
            // Note: In a real implementation, this would use VS Code API to select the model
            // For now, we'll just simulate success
            console.log(`Attempting to select model: ${model}`);
            
            // Simulate success for Claude 3.7 Sonnet and Gemini 2.5
            const success = (model === AIModel.Claude37Sonnet || model === AIModel.Gemini25);
            
            if (success) {
                console.log(`Successfully selected model: ${model}`);
                return true;
            } else {
                console.log(`Failed to select model: ${model}`);
                return false;
            }
        } catch (error) {
            console.error(`Error selecting model ${model}:`, error);
            return false;
        }
    }
    
    /**
     * Get the current model in use
     * @returns The current AI model or null if none selected
     */
    public getCurrentModel(): AIModel | null {
        return this.currentModel;
    }
    
    /**
     * Set custom preferred model order
     * @param models Array of models in order of preference
     */
    public setPreferredModelOrder(models: AIModel[]): void {
        if (models.length > 0) {
            this.preferredModelOrder = [...models];
        }
    }
    
    /**
     * Get the current preferred model order
     * @returns Array of models in order of preference
     */
    public getPreferredModelOrder(): AIModel[] {
        return [...this.preferredModelOrder];
    }
}