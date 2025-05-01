/**
 * Defines custom error types used throughout the application
 */

/**
 * Error thrown when a workflow is cancelled by the user or system
 */
export class WorkflowCancelledError extends Error {
  constructor(message = 'Workflow cancelled') {
    super(message);
    this.name = 'WorkflowCancelledError';
  }
}

/**
 * Error thrown when a workflow operation times out
 */
export class WorkflowTimeoutError extends Error {
  constructor(message = 'Workflow operation timed out') {
    super(message);
    this.name = 'WorkflowTimeoutError';
  }
}

/**
 * Error thrown when an invalid configuration is detected
 */
export class ConfigurationError extends Error {
  constructor(message = 'Invalid configuration') {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when communication with the chat interface fails
 */
export class CommunicationError extends Error {
  constructor(message = 'Failed to communicate with the chat interface') {
    super(message);
    this.name = 'CommunicationError';
  }
}

/**
 * Error thrown when a Git operation fails
 */
export class GitOperationError extends Error {
  constructor(message = 'Git operation failed') {
    super(message);
    this.name = 'GitOperationError';
  }
}

/**
 * Error thrown when loading a prompt file fails
 */
export class PromptLoadError extends Error {
  constructor(promptName: string, originalError?: Error) {
    const message = `Failed to load prompt file '${promptName}': ${originalError?.message || ''}`;
    super(message);
    this.name = 'PromptLoadError';
  }
}
