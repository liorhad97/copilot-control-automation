import * as vscode from 'vscode';
import { ConfigurationError } from '../errors/WorkflowErrors';

/**
 * Manages configuration settings for the extension
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private readonly EXTENSION_ID = 'marco';

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance of ConfigurationManager
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Get the VS Code configuration for this extension
   */
  private getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(this.EXTENSION_ID);
  }

  /**
   * Get whether background mode is enabled
   */
  public getBackgroundMode(): boolean {
    return this.getConfig().get<boolean>('backgroundMode') || false;
  }

  /**
   * Get the agent mode setting (Agent, Edit, Ask)
   */
  public getAgentMode(): string {
    return this.getConfig().get<string>('agentMode') || 'Agent';
  }

  /**
   * Get the preferred AI models in order of preference
   */
  public getPreferredModels(): string[] {
    return this.getConfig().get<string[]>('preferredModels') || 
      ["Claude 3.7 Sonnet", "Gemini 2.5", "GPT 4.1"];
  }

  /**
   * Get whether to create a new branch when starting a workflow
   */
  public shouldCreateBranch(): boolean {
    return this.getConfig().get<boolean>('initCreateBranch') || false;
  }

  /**
   * Get whether to include test writing steps in the workflow
   */
  public shouldWriteTests(): boolean {
    return this.getConfig().get<boolean>('needToWriteTest') || false;
  }

  /**
   * Get the maximum number of iterations for a workflow
   */
  public getMaxIterations(): number {
    return this.getConfig().get<number>('maxIterations') || 5;
  }

  /**
   * Get the idle timeout in seconds
   */
  public getIdleTimeoutSeconds(): number {
    return this.getConfig().get<number>('idleTimeoutSeconds') || 30;
  }

  /**
   * Get frequency for checking agent status in milliseconds
   */
  public getCheckAgentFrequency(): number {
    return this.getConfig().get<number>('checkAgentFrequency') || 10000;
  }

  /**
   * Get frequency for ensuring chat is open in milliseconds
   */
  public getEnsureChatFrequency(): number {
    return this.getConfig().get<number>('ensureChatFrequency') || 300000;
  }

  /**
   * Update a configuration setting
   * @param key The configuration key to update
   * @param value The new value
   * @param target The configuration target (User, Workspace, etc.)
   * @throws ConfigurationError if updating fails
   */
  public async updateSetting<T>(
    key: string,
    value: T,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    try {
      await this.getConfig().update(key, value, target);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ConfigurationError(`Failed to update setting '${key}': ${errorMessage}`);
    }
  }
}