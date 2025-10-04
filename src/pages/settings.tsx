import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, RotateCcw, Save } from 'lucide-react';

import { Button } from '@src/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@src/components/ui/card';
import { Input } from '@src/components/ui/input';
import { Label } from '@src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@src/components/ui/select';
import { Textarea } from '@src/components/ui/textarea';
import { SUPPORTED_LANGUAGES } from '@src/lib/languages';
import { DEFAULT_SETTINGS, MODEL_PROVIDERS, TEXT_SELECTION_BEHAVIORS, sanitizeCustomHeaders } from '@src/lib/settings';
import { useSettings } from '@src/hooks/use-settings';
import type { ModelProvider, Settings, TextSelectionBehavior } from '@src/types/settings';

type SettingsFormState = {
    openaiApiKey: string;
    claudeApiKey: string;
    selfHostedHost: string;
    selfHostedApiKey: string;
    modelProvider: ModelProvider;
    model: string;
    customHeadersJson: string;
    selectionBehavior: TextSelectionBehavior;
    defaultTargetLanguage: string;
    popupTimeoutSeconds: string;
};

const providerLabels: Record<ModelProvider, string> = {
    openai: 'OpenAI',
    claude: 'Claude (Anthropic)',
    'self-hosted': 'Self-hosted (OpenAI compatible)'
};

const selectionBehaviorLabels: Record<TextSelectionBehavior, string> = {
    'float-icon': 'Show floating icon (quick translate)',
    'auto-translate': 'Auto translate on selection',
    off: 'Do nothing'
};

const formatHeaders = (headers: Record<string, string>) => {
    const entries = Object.entries(headers);
    if (!entries.length) return '{}';
    return JSON.stringify(
        entries.reduce<Record<string, string>>((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {}),
        null,
        2
    );
};

const toFormState = (settings: Settings): SettingsFormState => ({
    openaiApiKey: settings.openaiApiKey,
    claudeApiKey: settings.claudeApiKey,
    selfHostedHost: settings.selfHostedHost,
    selfHostedApiKey: settings.selfHostedApiKey,
    modelProvider: settings.modelProvider,
    model: settings.model,
    customHeadersJson: formatHeaders(settings.customHeaders),
    selectionBehavior: settings.selectionBehavior,
    defaultTargetLanguage: settings.defaultTargetLanguage || DEFAULT_SETTINGS.defaultTargetLanguage,
    popupTimeoutSeconds: String(settings.popupTimeoutSeconds ?? DEFAULT_SETTINGS.popupTimeoutSeconds)
});

const normalizeHost = (host: string) => host.trim().replace(/\/+$/, '');

const parseCustomHeadersJson = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return { headers: {} as Record<string, string>, error: null as string | null };

    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Custom headers must be a JSON object.');

        const sanitized = sanitizeCustomHeaders(parsed);
        return { headers: sanitized, error: null as string | null };
    } catch (error) {
        return {
            headers: {} as Record<string, string>,
            error: error instanceof Error ? error.message : 'Invalid custom headers JSON.'
        };
    }
};

const fromFormState = (form: SettingsFormState, customHeaders: Record<string, string>): Settings => {
    const timeout = Number.parseInt(form.popupTimeoutSeconds, 10);

    return {
        openaiApiKey: form.openaiApiKey.trim(),
        claudeApiKey: form.claudeApiKey.trim(),
        selfHostedHost: normalizeHost(form.selfHostedHost),
        selfHostedApiKey: form.selfHostedApiKey.trim(),
        modelProvider: form.modelProvider,
        model: form.model.trim(),
        customHeaders,
        selectionBehavior: form.selectionBehavior,
        defaultTargetLanguage: form.defaultTargetLanguage,
        popupTimeoutSeconds: Number.isFinite(timeout) && timeout > 0 ? Math.min(timeout, 300) : DEFAULT_SETTINGS.popupTimeoutSeconds
    } satisfies Settings;
};

const getModelEndpoint = (provider: ModelProvider, host: string) => {
    if (provider === 'openai') return 'https://api.openai.com/v1/models';
    if (provider === 'claude') return 'https://api.anthropic.com/v1/models';

    const normalized = normalizeHost(host);
    if (!normalized) return '';
    return `${normalized}/models`;
};

export default function SettingsPage() {
    const { settings, hydrated, saveSettings, reloadSettings } = useSettings();
    const [formState, setFormState] = useState<SettingsFormState>(() => toFormState(settings));
    const [models, setModels] = useState<string[]>(() => (settings.model ? [settings.model] : []));
    const [hasChanges, setHasChanges] = useState(false);
    const [customHeadersError, setCustomHeadersError] = useState<string | null>(null);
    const [modelError, setModelError] = useState<string | null>(null);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saved'>('idle');

    useEffect(() => {
        if (!hydrated) return;

        setFormState(toFormState(settings));
        setHasChanges(false);
        setCustomHeadersError(null);
        setModelError(null);
        setModels(settings.model ? [settings.model] : []);
    }, [hydrated, settings]);

    useEffect(() => {
        if (saveFeedback === 'idle') return;

        const timeout = window.setTimeout(() => setSaveFeedback('idle'), 2500);
        return () => window.clearTimeout(timeout);
    }, [saveFeedback]);

    const handleFieldChange = <Key extends keyof SettingsFormState>(key: Key, value: SettingsFormState[Key]) => {
        setFormState((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleCustomHeadersChange = (value: string) => {
        handleFieldChange('customHeadersJson', value);
        const { error } = parseCustomHeadersJson(value);
        setCustomHeadersError(error);
    };

    const handleFetchModels = async () => {
        const { headers, error } = parseCustomHeadersJson(formState.customHeadersJson);
        if (error) {
            setCustomHeadersError(error);
            return;
        }

        const provider = formState.modelProvider;
        const endpoint = getModelEndpoint(provider, formState.selfHostedHost);

        if (!endpoint) {
            setModelError('Please provide a valid host URL for your self-hosted server (e.g. https://example.com/v1).');
            return;
        }

        const requestHeaders = new Headers();
        for (const [key, value] of Object.entries(headers)) {
            requestHeaders.set(key, value);
        }

        if (provider === 'openai') {
            if (!formState.openaiApiKey.trim()) {
                setModelError('OpenAI API key is required to fetch models.');
                return;
            }
            requestHeaders.set('Authorization', `Bearer ${formState.openaiApiKey.trim()}`);
        }

        if (provider === 'claude') {
            if (!formState.claudeApiKey.trim()) {
                setModelError('Claude API key is required to fetch models.');
                return;
            }
            requestHeaders.set('x-api-key', formState.claudeApiKey.trim());
            if (!requestHeaders.has('anthropic-version')) {
                requestHeaders.set('anthropic-version', '2023-06-01');
            }
        }

        if (provider === 'self-hosted' && formState.selfHostedApiKey.trim()) {
            requestHeaders.set('Authorization', `Bearer ${formState.selfHostedApiKey.trim()}`);
        }

        setModelsLoading(true);
        setModelError(null);

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: requestHeaders
            });

            if (!response.ok) {
                let message = `${response.status} ${response.statusText}`;
                try {
                    const body = (await response.json()) as { error?: { message?: string }; message?: string };
                    if (body?.error?.message) message = body.error.message;
                    else if (body?.message) message = body.message;
                } catch (error) {
                    console.warn('[settings] Failed to parse error response from model fetch:', error);
                }

                throw new Error(message);
            }

            let payload: unknown;
            try {
                payload = await response.json();
            } catch {
                throw new Error('Failed to parse model list response as JSON.');
            }

            const collected = new Set<string>();

            if (payload && typeof payload === 'object') {
                const record = payload as Record<string, unknown>;
                if (Array.isArray(record.data)) {
                    for (const item of record.data) {
                        if (typeof item === 'string') {
                            collected.add(item);
                        } else if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
                            collected.add((item as { id: string }).id.trim());
                        }
                    }
                }

                if (Array.isArray(record.models)) {
                    for (const item of record.models) {
                        if (typeof item === 'string') collected.add(item.trim());
                    }
                }
            }

            if (Array.isArray(payload)) {
                for (const item of payload) {
                    if (typeof item === 'string') collected.add(item.trim());
                }
            }

            const nextModels = Array.from(collected).filter(Boolean).sort();

            if (!nextModels.length) {
                setModelError('Received an empty model list. Try adjusting your credentials or endpoint.');
                setModels([]);
                return;
            }

            setModels(nextModels);
            if (!nextModels.includes(formState.model)) {
                handleFieldChange('model', nextModels[0]);
            }
        } catch (error) {
            setModelError(error instanceof Error ? error.message : 'Unexpected error while fetching models.');
        } finally {
            setModelsLoading(false);
        }
    };

    const handleSave = () => {
        const { headers, error } = parseCustomHeadersJson(formState.customHeadersJson);
        if (error) {
            setCustomHeadersError(error);
            return;
        }

        const next = fromFormState(formState, headers);
        saveSettings(next);
        setHasChanges(false);
        setSaveFeedback('saved');
        reloadSettings();
    };

    const handleResetForm = () => {
        setFormState(toFormState(DEFAULT_SETTINGS));
        setHasChanges(true);
        setCustomHeadersError(null);
    };

    const canFetchModels = formState.modelProvider !== 'self-hosted' || Boolean(formState.selfHostedHost.trim());
    const canSave = hydrated && !customHeadersError && hasChanges;

    const languageOptions = useMemo(
        () =>
            SUPPORTED_LANGUAGES.map((language) => ({
                code: language.code,
                label: `${language.english} (${language.code})`
            })),
        []
    );

    return (
        <div className="flex flex-1 flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold">Settings</h1>
                <p className="text-muted-foreground text-sm">Configure API access, translation behavior, and quick translate preferences.</p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Provider credentials</CardTitle>
                            <CardDescription>Store your API keys securely in the browser. They never leave your device.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="openaiKey">OpenAI API key</Label>
                                <Input id="openaiKey" type="password" placeholder="sk-..." value={formState.openaiApiKey} onChange={(event) => handleFieldChange('openaiApiKey', event.target.value)} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="claudeKey">Claude API key</Label>
                                <Input id="claudeKey" type="password" placeholder="sk-ant-..." value={formState.claudeApiKey} onChange={(event) => handleFieldChange('claudeApiKey', event.target.value)} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="selfHostUrl">Self-hosted base URL</Label>
                                <Input id="selfHostUrl" placeholder="https://llm.local/v1" value={formState.selfHostedHost} onChange={(event) => handleFieldChange('selfHostedHost', event.target.value)} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="selfHostKey">Self-hosted API key</Label>
                                <Input id="selfHostKey" type="password" placeholder="Optional" value={formState.selfHostedApiKey} onChange={(event) => handleFieldChange('selfHostedApiKey', event.target.value)} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Model selection</CardTitle>
                            <CardDescription>Select the primary provider and fetch the available models.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label>Provider</Label>
                                <Select
                                    value={formState.modelProvider}
                                    onValueChange={(value) => {
                                        handleFieldChange('modelProvider', value as ModelProvider);
                                        setModelError(null);
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MODEL_PROVIDERS.map((provider) => (
                                            <SelectItem key={provider} value={provider}>
                                                {providerLabels[provider]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label>Model</Label>
                                <Select value={formState.model} onValueChange={(value) => handleFieldChange('model', value)} disabled={!models.length}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder={modelsLoading ? 'Loading models…' : 'Choose a model'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {models.map((model) => (
                                            <SelectItem key={model} value={model}>
                                                {model}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-muted-foreground text-xs">{models.length ? `${models.length} models available.` : 'Fetch models from your provider to populate this list.'}</p>
                                {modelError && <p className="text-destructive text-xs">{modelError}</p>}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" variant="outline" onClick={handleFetchModels} disabled={!canFetchModels || modelsLoading}>
                                    {modelsLoading ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            Fetching models…
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="size-4" />
                                            Fetch models
                                        </>
                                    )}
                                </Button>
                                {formState.modelProvider === 'self-hosted' && !formState.selfHostedHost.trim() && <p className="text-muted-foreground text-xs">Provide your self-hosted endpoint before fetching models.</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Advanced configuration</CardTitle>
                            <CardDescription>Customize request headers, translation behavior, and popup preferences.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="customHeaders">Custom request headers (JSON)</Label>
                                <Textarea id="customHeaders" rows={6} value={formState.customHeadersJson} onChange={(event) => handleCustomHeadersChange(event.target.value)} spellCheck={false} />
                                <p className="text-muted-foreground text-xs">Provide a JSON object of additional headers sent with every model request.</p>
                                {customHeadersError && <p className="text-destructive text-xs">{customHeadersError}</p>}
                            </div>

                            <div className="grid gap-2">
                                <Label>On text selection</Label>
                                <Select value={formState.selectionBehavior} onValueChange={(value) => handleFieldChange('selectionBehavior', value as TextSelectionBehavior)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Choose behavior" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TEXT_SELECTION_BEHAVIORS.map((behavior) => (
                                            <SelectItem key={behavior} value={behavior}>
                                                {selectionBehaviorLabels[behavior]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label>Default target language</Label>
                                <Select value={formState.defaultTargetLanguage} onValueChange={(value) => handleFieldChange('defaultTargetLanguage', value)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Choose language" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[320px]">
                                        {languageOptions.map((language) => (
                                            <SelectItem key={language.code} value={language.code}>
                                                {language.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="popupTimeout">Translate popup timeout (seconds)</Label>
                                <Input id="popupTimeout" type="number" min={1} max={300} value={formState.popupTimeoutSeconds} onChange={(event) => handleFieldChange('popupTimeoutSeconds', event.target.value.replace(/[^0-9]/g, ''))} />
                                <p className="text-muted-foreground text-xs">Time before the translation popup automatically closes. Max 300 seconds.</p>
                            </div>
                        </CardContent>
                        <CardFooter className="justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Button type="button" variant="outline" onClick={handleResetForm}>
                                    <RotateCcw className="size-4" />
                                    Reset to defaults
                                </Button>
                                <Button type="button" variant="default" onClick={handleSave} disabled={!canSave}>
                                    <Save className="size-4" />
                                    Save settings
                                </Button>
                            </div>
                            {saveFeedback === 'saved' && <span className="text-emerald-600 text-sm">Settings saved.</span>}
                        </CardFooter>
                    </Card>
                </div>

                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle>Tips</CardTitle>
                        <CardDescription>Need help configuring? Start here.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 text-sm text-muted-foreground">
                        <div>
                            <h3 className="font-medium text-foreground">OpenAI</h3>
                            <p>
                                Use <span className="font-mono">https://api.openai.com/v1</span> and set your secret key. Only server-side proxies are recommended for production due to CORS restrictions.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-medium text-foreground">Claude</h3>
                            <p>
                                Ensure you include the Anthropic version header. We default to <span className="font-mono">2023-06-01</span> if you leave it blank.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-medium text-foreground">Self-hosted</h3>
                            <p>Point to any OpenAI-compatible endpoint (e.g. OpenRouter, local server). If authentication is optional, you may leave the API key empty.</p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                const latest = reloadSettings();
                                setFormState(toFormState(latest));
                                setModels(latest.model ? [latest.model] : []);
                                setHasChanges(false);
                            }}
                        >
                            <RefreshCw className="size-4" />
                            Reload stored settings
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
