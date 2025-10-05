/**
 * Unified API Interface
 * Routes requests to appropriate provider based on settings
 */

import type { ProviderConfig, APIRequest, APIResponse, APIClientOptions, TranslationRequest, RewritingRequest, ModelsListResponse } from './types';
import { callOpenAI, fetchModels as fetchOpenAIModels, healthCheck as openaiHealthCheck } from './providers/openai';
import { resolveLanguageLabel } from '@src/lib/languages';
import type { Settings } from '@src/types/settings';

/**
 * Create provider config from settings
 */
function createProviderConfig(settings: Settings): ProviderConfig {
    const { modelProvider, model, customHeaders } = settings;

    let baseUrl = '';
    let apiKey = '';

    switch (modelProvider) {
        case 'openai':
            baseUrl = 'https://api.openai.com/v1';
            apiKey = settings.openaiApiKey;
            break;

        case 'claude':
            baseUrl = 'https://api.anthropic.com/v1';
            apiKey = settings.claudeApiKey;
            break;

        case 'self-hosted':
            baseUrl = settings.selfHostedHost.replace(/\/$/, ''); // Remove trailing slash
            apiKey = settings.selfHostedApiKey;
            break;
    }

    return {
        type: modelProvider,
        baseUrl,
        apiKey,
        model,
        protocol: 'chat', // Default to chat completions, can be overridden
        customHeaders
    };
}

/**
 * Validate settings before making API call
 */
function validateSettings(settings: Settings): { valid: boolean; error?: string } {
    const { modelProvider, model } = settings;

    if (!model) {
        return { valid: false, error: 'No model selected. Please configure a model in Settings.' };
    }

    switch (modelProvider) {
        case 'openai':
            if (!settings.openaiApiKey) {
                return { valid: false, error: 'OpenAI API key is required. Please configure it in Settings.' };
            }
            break;

        case 'claude':
            if (!settings.claudeApiKey) {
                return { valid: false, error: 'Claude API key is required. Please configure it in Settings.' };
            }
            break;

        case 'self-hosted':
            if (!settings.selfHostedHost) {
                return { valid: false, error: 'Self-hosted host URL is required. Please configure it in Settings.' };
            }
            break;
    }

    return { valid: true };
}

/**
 * Make a generic API call
 */
export async function callAPI(settings: Settings, request: APIRequest, options?: APIClientOptions): Promise<APIResponse> {
    // Validate settings
    const validation = validateSettings(settings);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const config = createProviderConfig(settings);

    // Route to appropriate provider
    // For now, all providers use OpenAI-compatible interface
    // Claude will need a separate implementation later
    return callOpenAI(config, request, options);
}

/**
 * Translate text
 */
export async function translate(settings: Settings, request: TranslationRequest, options?: APIClientOptions): Promise<APIResponse> {
    // Build prompt from template
    // For now, use a simple default template
    const prompt = buildTranslationPrompt(request);

    const apiRequest: APIRequest = {
        prompt,
        model: settings.model,
        stream: options?.onStream !== undefined,
        temperature: 0.3,
        maxTokens: 2000
    };

    return callAPI(settings, apiRequest, options);
}

/**
 * Rewrite text
 */
export async function rewrite(settings: Settings, request: RewritingRequest, options?: APIClientOptions): Promise<APIResponse> {
    // Build prompt from template
    const prompt = buildRewritingPrompt(request);

    const apiRequest: APIRequest = {
        prompt,
        model: settings.model,
        stream: options?.onStream !== undefined,
        temperature: 0.5,
        maxTokens: 2000
    };

    return callAPI(settings, apiRequest, options);
}

/**
 * Build translation prompt (simplified - template engine will enhance this)
 */
function buildTranslationPrompt(request: TranslationRequest): string {
    const { text, targetLanguage, sourceLanguage, preserveHtml } = request;

    const targetLabel = resolveLanguageLabel(targetLanguage) || targetLanguage;
    const sourceLabel = sourceLanguage && sourceLanguage !== 'auto' ? resolveLanguageLabel(sourceLanguage) || sourceLanguage : null;

    let prompt = `Translate the following text to ${targetLabel}`;

    if (sourceLabel) {
        prompt += ` (from ${sourceLabel})`;
    }

    prompt += '.\n\n';

    if (preserveHtml) {
        prompt += 'IMPORTANT: Preserve all HTML tags and attributes exactly as they are. Only translate the text content between tags.\n\n';
    }

    prompt += 'Instructions:\n';
    prompt += '- Maintain the original meaning, tone, and punctuation\n';
    prompt += '- Do not add explanations or comments\n';
    prompt += '- Output only the translated text\n';

    if (request.glossary && Object.keys(request.glossary).length > 0) {
        prompt += '\nGlossary (use these exact translations):\n';
        Object.entries(request.glossary).forEach(([term, translation]) => {
            prompt += `- ${term} → ${translation}\n`;
        });
    }

    prompt += `\nText to translate:\n${text}`;

    return prompt;
}

/**
 * Build rewriting prompt (simplified - template engine will enhance this)
 */
function buildRewritingPrompt(request: RewritingRequest): string {
    const { text, targetLanguage, tone = 'neutral' } = request;

    const targetLabel = resolveLanguageLabel(targetLanguage) || targetLanguage;

    let toneInstruction = '';
    switch (tone) {
        case 'formal':
            toneInstruction = 'Use formal, professional language.';
            break;
        case 'casual':
            toneInstruction = 'Use casual, friendly language.';
            break;
        case 'concise':
            toneInstruction = 'Make it concise and to the point.';
            break;
        default:
            toneInstruction = 'Maintain a neutral tone.';
    }

    const prompt = `Rewrite the following text in ${targetLabel}.

${toneInstruction}

Instructions:
- Preserve the original facts and meaning
- Do not add explanations or comments
- Output only the rewritten text

Text to rewrite:
${text}`;

    return prompt;
}

/**
 * Fetch available models
 */
export async function fetchModels(settings: Settings, signal?: AbortSignal): Promise<ModelsListResponse> {
    const config = createProviderConfig(settings);

    // Route to appropriate provider
    return fetchOpenAIModels(config, signal);
}

/**
 * Health check
 */
export async function healthCheck(settings: Settings, signal?: AbortSignal): Promise<{ ok: boolean; message: string }> {
    const validation = validateSettings(settings);
    if (!validation.valid) {
        return {
            ok: false,
            message: validation.error || 'Invalid settings'
        };
    }

    const config = createProviderConfig(settings);

    // Route to appropriate provider
    return openaiHealthCheck(config, signal);
}
