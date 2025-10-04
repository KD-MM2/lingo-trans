import { SUPPORTED_LANGUAGES } from '@src/lib/languages';
import type { ModelProvider, Settings, TextSelectionBehavior } from '@src/types/settings';

const SETTINGS_STORAGE_KEY = 'lingo-trans:settings';

const MODEL_PROVIDERS: ModelProvider[] = ['openai', 'claude', 'self-hosted'];
const TEXT_SELECTION_BEHAVIORS: TextSelectionBehavior[] = ['float-icon', 'auto-translate', 'off'];

const KNOWN_LANGUAGE_CODES = new Set<string>(['auto', ...SUPPORTED_LANGUAGES.map((language) => language.code)]);

const DEFAULT_SETTINGS: Settings = {
    openaiApiKey: '',
    claudeApiKey: '',
    selfHostedHost: '',
    selfHostedApiKey: '',
    modelProvider: 'openai',
    model: '',
    customHeaders: {},
    selectionBehavior: 'float-icon',
    defaultTargetLanguage: 'en',
    popupTimeoutSeconds: 8
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const sanitizeCustomHeaders = (value: unknown): Record<string, string> => {
    if (!isRecord(value)) return {};

    const next: Record<string, string> = {};

    for (const [key, raw] of Object.entries(value)) {
        if (typeof key !== 'string') continue;
        const trimmedKey = key.trim();
        if (!trimmedKey) continue;

        if (typeof raw === 'string') {
            next[trimmedKey] = raw;
            continue;
        }

        if (typeof raw === 'number' || typeof raw === 'boolean') {
            next[trimmedKey] = String(raw);
            continue;
        }

        if (raw === null) {
            next[trimmedKey] = '';
            continue;
        }
    }

    return next;
};

const sanitizeSettings = (value: unknown): Settings => {
    if (!isRecord(value)) return { ...DEFAULT_SETTINGS };

    const openaiApiKey = typeof value.openaiApiKey === 'string' ? value.openaiApiKey.trim() : '';
    const claudeApiKey = typeof value.claudeApiKey === 'string' ? value.claudeApiKey.trim() : '';

    const selfHostedHost = typeof value.selfHostedHost === 'string' ? value.selfHostedHost.trim() : '';
    const selfHostedApiKey = typeof value.selfHostedApiKey === 'string' ? value.selfHostedApiKey.trim() : '';

    const modelProvider = MODEL_PROVIDERS.includes(value.modelProvider as ModelProvider) ? (value.modelProvider as ModelProvider) : DEFAULT_SETTINGS.modelProvider;
    const model = typeof value.model === 'string' ? value.model.trim() : '';

    const selectionBehavior = TEXT_SELECTION_BEHAVIORS.includes(value.selectionBehavior as TextSelectionBehavior) ? (value.selectionBehavior as TextSelectionBehavior) : DEFAULT_SETTINGS.selectionBehavior;

    const defaultTargetLanguage = KNOWN_LANGUAGE_CODES.has(typeof value.defaultTargetLanguage === 'string' ? value.defaultTargetLanguage : '') ? (value.defaultTargetLanguage as string) : DEFAULT_SETTINGS.defaultTargetLanguage;

    const popupTimeoutSecondsRaw = typeof value.popupTimeoutSeconds === 'number' ? value.popupTimeoutSeconds : Number.parseFloat(String(value.popupTimeoutSeconds ?? NaN));
    const popupTimeoutSeconds = Number.isFinite(popupTimeoutSecondsRaw) && popupTimeoutSecondsRaw > 0 ? Math.min(popupTimeoutSecondsRaw, 300) : DEFAULT_SETTINGS.popupTimeoutSeconds;

    const customHeaders = sanitizeCustomHeaders(value.customHeaders);

    return {
        openaiApiKey,
        claudeApiKey,
        selfHostedHost,
        selfHostedApiKey,
        modelProvider,
        model,
        customHeaders,
        selectionBehavior,
        defaultTargetLanguage,
        popupTimeoutSeconds
    } satisfies Settings;
};

export { DEFAULT_SETTINGS, MODEL_PROVIDERS, SETTINGS_STORAGE_KEY, TEXT_SELECTION_BEHAVIORS, sanitizeCustomHeaders, sanitizeSettings };
