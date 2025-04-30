/**
 * Types for the Marco AI extension
 */

/**
 * Agent mode options
 */
export enum AgentMode {
    Agent = 'Agent',
    Edit = 'Edit',
    Ask = 'Ask'
}

/**
 * Extension configuration
 */
export interface MarcoConfig {
    initCreateBranch: boolean;
    needToWriteTest: boolean;
    backgroundMode: boolean;
    idleTimeoutSeconds: number;
    agentMode: AgentMode;
    preferredModels: string[];
    checkAgentFrequency: number;
    ensureChatFrequency: number;
}

/**
 * Function callback type for state change listeners
 */
export type StateChangeListener = (state: string, message?: string) => void;

/**
 * Chat message interface
 */
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
}
