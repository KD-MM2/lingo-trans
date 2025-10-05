/**
 * SSE (Server-Sent Events) Streaming Parser
 * Handles streaming responses from OpenAI and compatible APIs
 */

import type { StreamChunk, OpenAIStreamChunk } from './types';

export interface StreamParserOptions {
    onChunk: (chunk: StreamChunk) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
}

/**
 * Parse SSE data line and extract JSON
 */
function parseSSELine(line: string): string | null {
    if (!line.trim()) return null;

    // SSE format: "data: {...}"
    if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();

        // OpenAI sends "[DONE]" when stream ends
        if (data === '[DONE]') {
            return null;
        }

        return data;
    }

    return null;
}

/**
 * Extract content from OpenAI chat completion stream chunk
 */
function extractContentFromChunk(chunk: OpenAIStreamChunk): string {
    if (!chunk.choices || chunk.choices.length === 0) {
        return '';
    }

    const choice = chunk.choices[0];
    return choice.delta?.content || '';
}

/**
 * Parse and process a streaming response
 */
export async function parseStreamingResponse(response: Response, options: StreamParserOptions): Promise<void> {
    const { onChunk, onError, onComplete } = options;

    if (!response.body) {
        throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            // Decode chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Split by newlines to process complete lines
            const lines = buffer.split('\n');

            // Keep the last incomplete line in buffer
            buffer = lines.pop() || '';

            // Process each complete line
            for (const line of lines) {
                const data = parseSSELine(line);

                if (data === null) {
                    continue;
                }

                try {
                    const parsed = JSON.parse(data) as OpenAIStreamChunk;
                    const content = extractContentFromChunk(parsed);

                    if (content) {
                        onChunk({
                            content,
                            done: false
                        });
                    }

                    // Check if stream is complete
                    const finishReason = parsed.choices[0]?.finish_reason;
                    if (finishReason && finishReason !== null) {
                        onChunk({
                            content: '',
                            done: true
                        });
                    }
                } catch (parseError) {
                    console.warn('Failed to parse SSE chunk:', parseError);
                    // Continue processing other chunks
                }
            }
        }

        // Send completion signal
        onComplete?.();
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);

        onChunk({
            content: '',
            done: true,
            error: err.message
        });
    } finally {
        reader.releaseLock();
    }
}

/**
 * Create a streaming parser with abort support
 */
export class StreamParser {
    private abortController: AbortController;

    constructor() {
        this.abortController = new AbortController();
    }

    get signal(): AbortSignal {
        return this.abortController.signal;
    }

    abort(): void {
        this.abortController.abort();
    }

    async parse(response: Response, options: StreamParserOptions): Promise<void> {
        return parseStreamingResponse(response, options);
    }
}

/**
 * Utility to collect all chunks from a stream into a single string
 */
export async function collectStream(response: Response, signal?: AbortSignal): Promise<string> {
    let fullContent = '';

    const parser = new StreamParser();

    // Handle external abort signal
    if (signal) {
        signal.addEventListener('abort', () => parser.abort());
    }

    await parser.parse(response, {
        onChunk: (chunk) => {
            if (chunk.content) {
                fullContent += chunk.content;
            }
        },
        onError: (error) => {
            throw error;
        }
    });

    return fullContent;
}

/**
 * Test if a response is a streaming response
 */
export function isStreamingResponse(response: Response): boolean {
    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('text/event-stream');
}
