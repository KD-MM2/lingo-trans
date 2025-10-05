/**
 * OpenAI API Client
 * Supports Chat Completions API and Responses API (beta)
 * Also compatible with OpenAI-compatible endpoints (Ollama, vLLM, etc.)
 */

import type { ProviderConfig, APIRequest, APIResponse, APIError, APIClientOptions, OpenAIChatRequest, OpenAIResponsesRequest, OpenAIResponse, ModelsListResponse } from '../types';
import { parseStreamingResponse } from '../streaming';

const joinEndpoint = (baseUrl: string, path: string): string => {
    const sanitizedBase = baseUrl.replace(/\/+$/, '');
    const sanitizedPath = path.replace(/^\/+/, '');
    return `${sanitizedBase}/${sanitizedPath}`;
};

/**
 * Create headers for OpenAI API requests
 */
function createHeaders(config: ProviderConfig): HeadersInit {
    const headers: HeadersInit = {
        'Content-Type': 'application/json'
    };

    if (config.apiKey) {
        headers.Authorization = `Bearer ${config.apiKey}`;
    }

    // Add custom headers if provided
    if (config.customHeaders) {
        Object.entries(config.customHeaders).forEach(([key, value]) => {
            headers[key] = value;
        });
    }

    return headers;
}

/**
 * Parse API error from response
 */
async function parseAPIError(response: Response): Promise<APIError> {
    let message = `API request failed with status ${response.status}`;
    let type: APIError['type'] = 'server_error';
    let retryAfter: number | undefined;

    try {
        const errorData = await response.json();
        if (errorData.error?.message) {
            message = errorData.error.message;
        }
    } catch {
        // Use default message if JSON parsing fails
    }

    // Determine error type based on status code
    if (response.status === 401 || response.status === 403) {
        type = 'auth';
    } else if (response.status === 429) {
        type = 'rate_limit';
        // Check for Retry-After header
        const retryAfterHeader = response.headers.get('retry-after');
        if (retryAfterHeader) {
            retryAfter = parseInt(retryAfterHeader, 10);
        }
    } else if (response.status === 400 || response.status === 422) {
        type = 'invalid_request';
    } else if (response.status >= 500) {
        type = 'server_error';
    }

    const retryable = type === 'rate_limit' || type === 'server_error';

    return {
        type,
        message,
        statusCode: response.status,
        retryable,
        retryAfter
    };
}

/**
 * Make API request with retry logic
 */
async function makeRequest(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // If successful, return response
            if (response.ok) {
                return response;
            }

            // Parse error
            const apiError = await parseAPIError(response);

            // If not retryable, throw immediately
            if (!apiError.retryable) {
                throw new Error(apiError.message);
            }

            // Wait before retry (exponential backoff)
            if (attempt < maxRetries - 1) {
                const delay = apiError.retryAfter ? apiError.retryAfter * 1000 : Math.min(1000 * Math.pow(2, attempt), 10000);
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                throw new Error(apiError.message);
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // If this is an abort error, don't retry
            if (lastError.name === 'AbortError') {
                throw lastError;
            }

            // If last attempt, throw error
            if (attempt === maxRetries - 1) {
                throw lastError;
            }

            // Wait before retry
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error('Request failed after retries');
}

/**
 * Call OpenAI Chat Completions API
 */
export async function callChatCompletions(config: ProviderConfig, request: APIRequest, options?: APIClientOptions): Promise<APIResponse> {
    const url = joinEndpoint(config.baseUrl, '/chat/completions');

    const chatRequest: OpenAIChatRequest = {
        model: request.model,
        messages: [
            {
                role: 'user',
                content: request.prompt
            }
        ],
        stream: request.stream || false,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens
    };

    const requestOptions: RequestInit = {
        method: 'POST',
        headers: createHeaders(config),
        body: JSON.stringify(chatRequest),
        signal: options?.signal
    };

    // Handle streaming
    if (request.stream && options?.onStream) {
        const response = await makeRequest(url, requestOptions);

        let fullContent = '';

        await parseStreamingResponse(response, {
            onChunk: (chunk) => {
                if (chunk.content) {
                    fullContent += chunk.content;
                }
                options.onStream?.(chunk);
            },
            onError: (error) => {
                console.error('Streaming error:', error);
            }
        });

        return {
            content: fullContent
        };
    }

    // Handle non-streaming
    const response = await makeRequest(url, requestOptions);
    const data = (await response.json()) as OpenAIResponse;

    const content = data.choices[0]?.message?.content || '';

    return {
        content,
        usage: data.usage
            ? {
                  promptTokens: data.usage.prompt_tokens,
                  completionTokens: data.usage.completion_tokens,
                  totalTokens: data.usage.total_tokens
              }
            : undefined,
        model: data.model,
        finishReason: data.choices[0]?.finish_reason
    };
}

/**
 * Call OpenAI Responses API (beta)
 */
export async function callResponsesAPI(config: ProviderConfig, request: APIRequest, options?: APIClientOptions): Promise<APIResponse> {
    const url = joinEndpoint(config.baseUrl, '/responses');

    const responsesRequest: OpenAIResponsesRequest = {
        model: request.model,
        input: request.prompt,
        stream: request.stream || false,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens
    };

    const requestOptions: RequestInit = {
        method: 'POST',
        headers: createHeaders(config),
        body: JSON.stringify(responsesRequest),
        signal: options?.signal
    };

    // Handle streaming
    if (request.stream && options?.onStream) {
        const response = await makeRequest(url, requestOptions);

        let fullContent = '';

        await parseStreamingResponse(response, {
            onChunk: (chunk) => {
                if (chunk.content) {
                    fullContent += chunk.content;
                }
                options.onStream?.(chunk);
            },
            onError: (error) => {
                console.error('Streaming error:', error);
            }
        });

        return {
            content: fullContent
        };
    }

    // Handle non-streaming
    const response = await makeRequest(url, requestOptions);
    const data = (await response.json()) as OpenAIResponse;

    const content = data.choices[0]?.text || data.choices[0]?.message?.content || '';

    return {
        content,
        usage: data.usage
            ? {
                  promptTokens: data.usage.prompt_tokens,
                  completionTokens: data.usage.completion_tokens,
                  totalTokens: data.usage.total_tokens
              }
            : undefined,
        model: data.model,
        finishReason: data.choices[0]?.finish_reason
    };
}

/**
 * Main API call function - routes to correct endpoint based on protocol
 */
export async function callOpenAI(config: ProviderConfig, request: APIRequest, options?: APIClientOptions): Promise<APIResponse> {
    if (config.protocol === 'responses') {
        return callResponsesAPI(config, request, options);
    }

    // Default to chat completions
    return callChatCompletions(config, request, options);
}

/**
 * Fetch available models from provider
 */
export async function fetchModels(config: ProviderConfig, signal?: AbortSignal): Promise<ModelsListResponse> {
    const url = joinEndpoint(config.baseUrl, '/models');

    try {
        const response = await fetch(url, {
            headers: createHeaders(config),
            signal
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data = await response.json();

        // Transform to our format
        const models = (data.data || []).map((model: { id: string; created?: number; description?: string }) => ({
            id: model.id,
            name: model.id,
            provider: config.type,
            created: model.created,
            description: model.description
        }));

        return { models };
    } catch (error) {
        console.error('Error fetching models:', error);
        throw error;
    }
}

/**
 * Health check - verify API connectivity and credentials
 */
export async function healthCheck(config: ProviderConfig, signal?: AbortSignal): Promise<{ ok: boolean; message: string }> {
    try {
        // Try to fetch models first
        await fetchModels(config, signal);
        return {
            ok: true,
            message: 'Connection successful'
        };
    } catch (error) {
        // If models endpoint fails, try a simple completion request
        try {
            const testRequest: APIRequest = {
                prompt: 'Say "OK" if you can read this.',
                model: config.model,
                stream: false,
                maxTokens: 10
            };

            await callOpenAI(config, testRequest, { signal });

            return {
                ok: true,
                message: 'Connection successful (via test request)'
            };
        } catch {
            return {
                ok: false,
                message: error instanceof Error ? error.message : 'Connection failed'
            };
        }
    }
}
