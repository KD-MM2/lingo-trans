/**
 * API Types and Interfaces for LingoTrans
 * Supports OpenAI, Claude, and OpenAI-compatible providers
 */

export type ProviderType = 'openai' | 'claude' | 'self-hosted';
export type ProtocolType = 'chat' | 'responses';

export interface ProviderConfig {
    type: ProviderType;
    baseUrl: string;
    apiKey: string;
    model: string;
    protocol: ProtocolType;
    customHeaders?: Record<string, string>;
}

export interface TranslationRequest {
    text: string;
    targetLanguage: string;
    sourceLanguage?: string;
    template?: string;
    preserveHtml?: boolean;
    preservePlaceholders?: boolean;
    glossary?: Record<string, string>;
}

export interface RewritingRequest {
    text: string;
    targetLanguage: string;
    tone?: 'neutral' | 'formal' | 'casual' | 'concise';
    template?: string;
}

export interface APIRequest {
    prompt: string;
    model: string;
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
}

export interface StreamChunk {
    content: string;
    done: boolean;
    error?: string;
}

export interface APIResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model?: string;
    finishReason?: string;
}

export interface APIError {
    type: 'auth' | 'rate_limit' | 'timeout' | 'network' | 'invalid_request' | 'server_error';
    message: string;
    statusCode?: number;
    retryable: boolean;
    retryAfter?: number;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export interface APIClientOptions {
    signal?: AbortSignal;
    onStream?: StreamCallback;
    timeout?: number;
}

// OpenAI-specific types
export interface OpenAIChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OpenAIChatRequest {
    model: string;
    messages: OpenAIChatMessage[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
}

export interface OpenAIResponsesRequest {
    model: string;
    input: string;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
}

export interface OpenAIStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta?: {
            role?: string;
            content?: string;
        };
        finish_reason?: string | null;
    }>;
}

export interface OpenAIResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message?: {
            role: string;
            content: string;
        };
        text?: string;
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// Model list types
export interface ModelInfo {
    id: string;
    name: string;
    provider: ProviderType;
    created?: number;
    description?: string;
}

export interface ModelsListResponse {
    models: ModelInfo[];
}
