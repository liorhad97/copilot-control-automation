/**
 * Service locator
 * Central registry for all services in the application
 * Acts as an adapter/binding layer between core and services
 */

import * as vscode from 'vscode';
import { IEnvironmentService, IWorkflowService } from '../core/interfaces';
import { CopilotEnvironmentService } from '../services/copilotEnvironmentService';
import { WindsurfEnvironmentService } from '../services/windsurfEnvironmentService';
import { WorkflowService } from '../services/workflowService';
import { CommandFactory } from '../core/commands/commandFactory';
import { CopilotChatAdapter } from './copilotChatAdapter';
import { MarcoToolProvider } from './marcoToolProvider';

/**
 * Service locator to manage all service instances
 * Acts as a dependency injection container
 */
export class ServiceLocator {
  private static instance: ServiceLocator;
  private services: Map<string, any> = new Map();
  
  /**
   * Singleton getter
   */
  static getInstance(): ServiceLocator {
    if (!ServiceLocator.instance) {
      ServiceLocator.instance = new ServiceLocator();
    }
    return ServiceLocator.instance;
  }
  
  /**
   * Private constructor for singleton
   */
  private constructor() {}
  
  /**
   * Initializes all services
   * @param context VS Code extension context
   */
  initialize(context: vscode.ExtensionContext): void {
    // Get environment type from configuration
    const config = vscode.workspace.getConfiguration('marco');
    const environmentType = config.get<string>('environmentType') || 'copilot';
    
    // Create environment service based on configuration
    let environmentService: IEnvironmentService;
    if (environmentType === 'windsurf') {
      environmentService = new WindsurfEnvironmentService();
    } else {
      environmentService = new CopilotEnvironmentService();
    }
    
    // Register environment service
    this.register('environmentService', environmentService);
    
    // Create and register workflow service
    const workflowService = new WorkflowService(environmentService);
    this.register('workflowService', workflowService);
    
    // Create and register command factory
    const commandFactory = new CommandFactory(workflowService, environmentService);
    this.register('commandFactory', commandFactory);
    
    // Register all commands with VS Code
    commandFactory.registerAllCommands(context);
    
    // Initialize Copilot Chat integration if API is available
    this.initializeCopilotIntegration(context, workflowService, environmentService);
  }
  
  /**
   * Initializes Copilot Chat integration components
   */
  private initializeCopilotIntegration(
    context: vscode.ExtensionContext,
    workflowService: IWorkflowService,
    environmentService: IEnvironmentService
  ): void {
    // Check if Copilot Chat API is available before initializing
    const enableCopilotIntegration = vscode.workspace.getConfiguration('marco')
      .get<boolean>('enableCopilotIntegration', true);
      
    if (enableCopilotIntegration) {
      // Initialize chat participant adapter
      const chatAdapter = new CopilotChatAdapter(workflowService, environmentService, context);
      this.register('copilotChatAdapter', chatAdapter);
      
      // Register the chat participant
      chatAdapter.register();
      
      // Initialize tool provider
      const toolProvider = new MarcoToolProvider(workflowService, environmentService, context);
      this.register('marcoToolProvider', toolProvider);
      
      // Register tools
      toolProvider.register();
    }
  }
  
  /**
   * Registers a service in the locator
   * @param name Service name
   * @param service Service instance
   */
  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }
  
  /**
   * Gets a service from the locator
   * @param name Service name
   * @returns Service instance
   */
  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }
    return service as T;
  }
  
  /**
   * Gets the environment service
   */
  getEnvironmentService(): IEnvironmentService {
    return this.get<IEnvironmentService>('environmentService');
  }
  
  /**
   * Gets the workflow service
   */
  getWorkflowService(): IWorkflowService {
    return this.get<IWorkflowService>('workflowService');
  }
  
  /**
   * Gets the command factory
   */
  getCommandFactory(): CommandFactory {
    return this.get<CommandFactory>('commandFactory');
  }
}
