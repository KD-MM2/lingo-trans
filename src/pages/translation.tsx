import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { browser } from 'wxt/browser';
import { CopyIcon } from 'lucide-react';

import { Button } from '@src/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@src/components/ui/card';
import { Label } from '@src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@src/components/ui/select';
import { Textarea } from '@src/components/ui/textarea';
import { SUPPORTED_LANGUAGES, resolveLanguageLabel } from '@src/lib/languages';
import { DEFAULT_SETTINGS } from '@src/lib/settings';
import { useSettings } from '@src/hooks/use-settings';
import { translate } from '@src/lib/api';
import { SIDE_PANEL_TRANSLATE_STORAGE_KEY, isSidePanelTranslateRequest } from '@src/lib/extension-messages';
import type { TranslationRequest } from '@src/lib/api/types';

const MAX_CHARACTERS = 5000;

export default function Translation() {
    const { settings, hydrated } = useSettings();
    const defaultLanguageRef = useRef(DEFAULT_SETTINGS.defaultTargetLanguage);
    const [targetLanguage, setTargetLanguage] = useState(DEFAULT_SETTINGS.defaultTargetLanguage);
    const [inputText, setInputText] = useState('');
    const [translatedText, setTranslatedText] = useState('');
    const [lastRequestedLanguage, setLastRequestedLanguage] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyResetRef = useRef<number | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastSidePanelTimestampRef = useRef<number | null>(null);

    const languageOptions = useMemo(() => [...SUPPORTED_LANGUAGES].sort((a, b) => a.english.localeCompare(b.english)), []);

    const runTranslation = useCallback(
        async (text: string, language: string) => {
            const normalized = text.trim();
            if (!normalized || !language) {
                return;
            }

            abortControllerRef.current?.abort();

            const controller = new AbortController();
            abortControllerRef.current = controller;

            setInputText(text);
            setTargetLanguage(language);
            setIsTranslating(true);
            setTranslatedText('');
            setLastRequestedLanguage(language);

            try {
                const request: TranslationRequest = {
                    text,
                    targetLanguage: language,
                    sourceLanguage: 'auto'
                };

                await translate(settings, request, {
                    signal: controller.signal,
                    onStream: (chunk) => {
                        if (chunk.content) {
                            setTranslatedText((prev) => prev + chunk.content);
                        }
                        if (chunk.error) {
                            console.error('Translation error:', chunk.error);
                        }
                    }
                });
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error('Translation failed:', error);
                    setTranslatedText(`Error: ${error instanceof Error ? error.message : 'Translation failed. Please check your settings and try again.'}`);
                }
            } finally {
                if (abortControllerRef.current === controller) {
                    abortControllerRef.current = null;
                }
                setIsTranslating(false);
            }
        },
        [settings]
    );

    useEffect(() => {
        if (!hydrated) return;

        const nextDefault = settings.defaultTargetLanguage || DEFAULT_SETTINGS.defaultTargetLanguage;
        setTargetLanguage((previous) => {
            const shouldUpdate = !previous || previous === defaultLanguageRef.current;
            defaultLanguageRef.current = nextDefault;
            return shouldUpdate ? nextDefault : previous;
        });
    }, [hydrated, settings.defaultTargetLanguage]);

    useEffect(() => {
        if (!hydrated) return;
        if (!browser.storage?.local) return;

        let cancelled = false;

        const consumePendingPayload = async () => {
            try {
                const result = await browser.storage.local.get(SIDE_PANEL_TRANSLATE_STORAGE_KEY);
                const raw = result?.[SIDE_PANEL_TRANSLATE_STORAGE_KEY] as { text?: string; targetLanguage?: string; timestamp?: number } | undefined;
                if (cancelled || !raw) {
                    return;
                }

                await browser.storage.local.remove(SIDE_PANEL_TRANSLATE_STORAGE_KEY);

                const pendingText = typeof raw.text === 'string' ? raw.text : '';
                const text = pendingText.trim();
                if (!text) {
                    return;
                }

                const timestamp = typeof raw.timestamp === 'number' ? raw.timestamp : null;
                if (timestamp !== null && lastSidePanelTimestampRef.current === timestamp) {
                    return;
                }

                lastSidePanelTimestampRef.current = timestamp;

                const nextLanguage = raw.targetLanguage || settings.defaultTargetLanguage || DEFAULT_SETTINGS.defaultTargetLanguage;
                void runTranslation(pendingText, nextLanguage);
            } catch (error) {
                console.debug('[Translation] Failed to consume pending side panel payload', error);
            }
        };

        void consumePendingPayload();

        return () => {
            cancelled = true;
        };
    }, [hydrated, runTranslation, settings.defaultTargetLanguage]);

    useEffect(() => {
        if (!hydrated) return;
        if (!browser.runtime?.onMessage) {
            return;
        }

        const handler = (message: unknown) => {
            if (!isSidePanelTranslateRequest(message)) {
                return;
            }

            const pendingText = typeof message.text === 'string' ? message.text : '';
            const text = pendingText.trim();
            if (!text) {
                return;
            }

            const timestamp = typeof message.timestamp === 'number' ? message.timestamp : null;
            if (timestamp !== null && lastSidePanelTimestampRef.current === timestamp) {
                return;
            }

            lastSidePanelTimestampRef.current = timestamp;

            const nextLanguage = message.targetLanguage || settings.defaultTargetLanguage || DEFAULT_SETTINGS.defaultTargetLanguage;
            void runTranslation(pendingText, nextLanguage);
        };

        try {
            browser.runtime.onMessage.addListener(handler);
        } catch (error) {
            console.debug('[Translation] Failed to subscribe to runtime translation messages', error);
        }

        return () => {
            try {
                browser.runtime.onMessage.removeListener(handler);
            } catch (error) {
                console.debug('[Translation] Failed to remove runtime translation message listener', error);
            }
        };
    }, [hydrated, runTranslation, settings.defaultTargetLanguage]);

    useEffect(
        () => () => {
            if (copyResetRef.current) {
                window.clearTimeout(copyResetRef.current);
            }
            abortControllerRef.current?.abort();
        },
        []
    );

    const handleSubmit = useCallback(
        (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void runTranslation(inputText, targetLanguage);
        },
        [inputText, runTranslation, targetLanguage]
    );

    const handleCopy = async () => {
        if (!translatedText.trim()) return;
        if (typeof navigator === 'undefined' || !navigator.clipboard) return;

        try {
            await navigator.clipboard.writeText(translatedText);
            setCopied(true);
            if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
            copyResetRef.current = window.setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.warn('Failed to copy translated text', error);
        }
    };

    const charactersUsed = inputText.length;
    const charactersRemaining = MAX_CHARACTERS - charactersUsed;
    const disableSubmit = !targetLanguage || !inputText.trim() || isTranslating;

    return (
        <div className="flex flex-1 flex-col gap-6 p-4">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold">Translate text</h1>
                <p className="text-muted-foreground text-sm">Paste content below, choose a target language, and trigger translation when you&apos;re ready.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader className="gap-2">
                        <CardTitle>Source content</CardTitle>
                        <CardDescription>Enter up to {MAX_CHARACTERS.toLocaleString()} characters to translate.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                            <div className="grid gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="target-language">Target language</Label>
                                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                                        <SelectTrigger id="target-language" className="w-full sm:w-64">
                                            <SelectValue placeholder="Choose language" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {languageOptions.map((language) => (
                                                <SelectItem key={language.code} value={language.code}>
                                                    <span className="flex w-full items-center justify-between gap-2">{language.english}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="source-text">Text to translate</Label>
                                    <Textarea id="source-text" value={inputText} maxLength={MAX_CHARACTERS} placeholder="Paste or type the content you want translated." onChange={(event) => setInputText(event.target.value)} />
                                    <p className={`text-xs text-right ${charactersRemaining <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                        {charactersUsed.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()} characters
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <Button type="submit" className="min-w-32" disabled={disableSubmit}>
                                    {isTranslating ? 'Translating…' : 'Translate'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="gap-2">
                        <div>
                            <CardTitle>Translation</CardTitle>
                            <CardDescription>{translatedText ? `Translated into ${resolveLanguageLabel(lastRequestedLanguage ?? targetLanguage)}` : 'Your translated content will appear here.'}</CardDescription>
                        </div>
                        {translatedText ? (
                            <CardAction>
                                <Button variant="outline" size="sm" className="gap-2" onClick={handleCopy}>
                                    <CopyIcon className="size-4" /> {copied ? 'Copied' : 'Copy'}
                                </Button>
                            </CardAction>
                        ) : null}
                    </CardHeader>
                    <CardContent>
                        <div className="bg-muted/40 min-h-48 whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed">{translatedText || (isTranslating ? 'Working on it…' : 'Run a translation to see the output.')}</div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
