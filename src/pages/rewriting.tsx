import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CopyIcon } from 'lucide-react';

import { Button } from '@src/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@src/components/ui/card';
import { Label } from '@src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@src/components/ui/select';
import { Textarea } from '@src/components/ui/textarea';
import { SUPPORTED_LANGUAGES, resolveLanguageLabel } from '@src/lib/languages';
import { DEFAULT_SETTINGS } from '@src/lib/settings';
import { useSettings } from '@src/hooks/use-settings';

const MAX_CHARACTERS = 5000;

export default function Rewriting() {
    const { settings, hydrated } = useSettings();
    const defaultLanguageRef = useRef(DEFAULT_SETTINGS.defaultTargetLanguage);
    const [targetLanguage, setTargetLanguage] = useState(DEFAULT_SETTINGS.defaultTargetLanguage);
    const [inputText, setInputText] = useState('');
    const [rewrittenText, setRewrittenText] = useState('');
    const [lastRequestedLanguage, setLastRequestedLanguage] = useState<string | null>(null);
    const [isRewriting, setIsRewriting] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyResetRef = useRef<number | null>(null);

    const languageOptions = useMemo(() => [...SUPPORTED_LANGUAGES].sort((a, b) => a.english.localeCompare(b.english)), []);

    useEffect(() => {
        if (!hydrated) return;

        const nextDefault = settings.defaultTargetLanguage || DEFAULT_SETTINGS.defaultTargetLanguage;
        setTargetLanguage((previous) => {
            const shouldUpdate = !previous || previous === defaultLanguageRef.current;
            defaultLanguageRef.current = nextDefault;
            return shouldUpdate ? nextDefault : previous;
        });
    }, [hydrated, settings.defaultTargetLanguage]);

    useEffect(
        () => () => {
            if (copyResetRef.current) {
                window.clearTimeout(copyResetRef.current);
            }
        },
        []
    );

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!inputText.trim() || !targetLanguage) {
            return;
        }

        setIsRewriting(true);
        setRewrittenText('');
        setLastRequestedLanguage(targetLanguage);

        try {
            await new Promise((resolve) => window.setTimeout(resolve, 350));
            setRewrittenText(inputText);
        } finally {
            setIsRewriting(false);
        }
    };

    const handleCopy = async () => {
        if (!rewrittenText.trim()) return;
        if (typeof navigator === 'undefined' || !navigator.clipboard) return;

        try {
            await navigator.clipboard.writeText(rewrittenText);
            setCopied(true);
            if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
            copyResetRef.current = window.setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.warn('Failed to copy rewritten text', error);
        }
    };

    const charactersUsed = inputText.length;
    const charactersRemaining = MAX_CHARACTERS - charactersUsed;
    const disableSubmit = !targetLanguage || !inputText.trim() || isRewriting;

    return (
        <div className="flex flex-1 flex-col gap-6 p-4">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold">Rewrite sentence</h1>
                <p className="text-muted-foreground text-sm">Paste content below, choose a target language, and trigger rewriting when you&apos;re ready.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader className="gap-2">
                        <CardTitle>Source content</CardTitle>
                        <CardDescription>Enter up to {MAX_CHARACTERS.toLocaleString()} characters to rewrite.</CardDescription>
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
                                <p className="text-muted-foreground text-xs">Rewriting is simulated for now. Integrate your provider to get real results.</p>
                                <Button type="submit" className="min-w-32" disabled={disableSubmit}>
                                    {isRewriting ? 'Rewriting…' : 'Rewrite'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="gap-2">
                        <div>
                            <CardTitle>Rewriting</CardTitle>
                            <CardDescription>{rewrittenText ? `Rewritten into ${resolveLanguageLabel(lastRequestedLanguage ?? targetLanguage)}` : 'Your rewritten content will appear here.'}</CardDescription>
                        </div>
                        {rewrittenText ? (
                            <CardAction>
                                <Button variant="outline" size="sm" className="gap-2" onClick={handleCopy}>
                                    <CopyIcon className="size-4" /> {copied ? 'Copied' : 'Copy'}
                                </Button>
                            </CardAction>
                        ) : null}
                    </CardHeader>
                    <CardContent>
                        <div className="bg-muted/40 min-h-48 whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed">{rewrittenText || (isRewriting ? 'Working on it…' : 'Run a rewriting to see the output.')}</div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
