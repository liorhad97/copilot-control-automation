/**
 * Custom error type for workflow cancellation
 */
export class WorkflowCancelledError extends Error {
    constructor(message = 'Workflow cancelled') {
        super(message);
        this.name = 'WorkflowCancelledError';
    }
}

/**
 * Custom error type for workflow timeouts
 */
export class WorkflowTimeoutError extends Error {
    constructor(message = 'Workflow operation timed out') {
        super(message);
        this.name = 'WorkflowTimeoutError';
    }
}

/**
 * Custom error type for configuration errors
 */
export class ConfigurationError extends Error {
    constructor(message = 'Invalid configuration') {
        super(message);
        this.name = 'ConfigurationError';
    }
}

/**
 * Custom error type for communication errors
 */
export class CommunicationError extends Error {
    constructor(message = 'Failed to communicate with the chat interface') {
        super(message);
        this.name = 'CommunicationError';
    }
}

/**
 * Custom error type for Git operation errors
 */
export class GitOperationError extends Error {
    constructor(message = 'Git operation failed') {
        super(message);
        this.name = 'GitOperationError';
    }
}

/**
 * Custom error type for prompt loading errors
 */
export class PromptLoadError extends Error {
    constructor(promptName: string, originalError?: Error) {
        const message = `Failed to load prompt file '${promptName}': ${originalError?.message || ''}`;
        super(message);
        this.name = 'PromptLoadError';
    }
}