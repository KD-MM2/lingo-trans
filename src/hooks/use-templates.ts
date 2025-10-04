import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Template, TemplateCategory, TemplateDraft, TemplateUpdate } from '@src/types/template';

const STORAGE_KEY = 'lingo-trans:templates';

const DEFAULT_TEMPLATE_DEFINITIONS: Array<Omit<TemplateDraft, 'tags'> & { tags: string[] }> = [
    {
        name: 'Translate product announcement',
        description: 'Convert an English product announcement into another language while preserving tone and key details.',
        content: `You are a professional marketing translator. Translate the following announcement into {{target_language}}.

Guidelines:
- Keep the original tone: confident and inspiring.
- Preserve product names and feature terminology.
- Rewrite measurements using the metric system if applicable.
- Return the translated copy in markdown with headings and bullet lists retained.

Announcement:
{{text}}`,
        tags: ['translation', 'marketing', 'launch'],
        category: 'translation'
    },
    {
        name: 'Rewrite for clarity',
        description: 'Polish copy to make it clear and concise while keeping the original intent.',
        content: `Rewrite the text below to improve clarity and flow.

Rules:
- Keep the original meaning and factual claims intact.
- Use short sentences and active voice where possible.
- Replace jargon with approachable wording.
- Return the result as plain paragraphs.

Text:
{{text}}`,
        tags: ['rewriting', 'editing'],
        language: 'English',
        category: 'rewriting'
    },
    {
        name: 'Summarize support ticket',
        description: 'Create a short summary of a customer support ticket for internal handover.',
        content: `Summarize the customer ticket below for an internal support handover.

Include:
1. A two-sentence overview of the customer issue.
2. The troubleshooting steps already taken.
3. Any requested follow-up or deadlines.
4. Suggested next action for the receiving agent.

Ticket:
{{text}}`,
        tags: ['summarization', 'support'],
        language: 'English',
        category: 'summarization'
    }
];

const VALID_CATEGORIES = new Set<TemplateCategory>(['translation', 'rewriting', 'summarization', 'general', 'custom']);

const createId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();

    return `template-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
};

const normalizeTags = (tags?: string[]) => {
    if (!Array.isArray(tags)) return [];

    const seen = new Set<string>();
    const result: string[] = [];

    for (const tag of tags) {
        if (typeof tag !== 'string') continue;
        const trimmed = tag.trim();
        if (!trimmed) continue;

        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(trimmed);
    }

    return result;
};

const normalizeDraft = (input: TemplateDraft): TemplateDraft => {
    const name = input.name?.trim() ?? '';
    const content = input.content?.trim() ?? '';
    const description = input.description?.trim() ?? '';
    const language = input.language?.trim();
    const category = input.category && VALID_CATEGORIES.has(input.category) ? input.category : undefined;

    return {
        name,
        content,
        description,
        tags: normalizeTags(input.tags ?? []),
        language: language || undefined,
        category
    };
};

const templateTimestamp = (template: Template) => new Date(template.updatedAt || template.createdAt).valueOf();

const sortTemplates = (templates: Template[]) => [...templates].sort((a, b) => templateTimestamp(b) - templateTimestamp(a));

const buildDefaultTemplates = (): Template[] => {
    const timestamp = new Date().toISOString();

    return DEFAULT_TEMPLATE_DEFINITIONS.map((definition) => {
        const normalized = normalizeDraft({
            ...definition,
            tags: definition.tags
        });

        return {
            ...normalized,
            id: createId(),
            createdAt: timestamp,
            updatedAt: timestamp
        } satisfies Template;
    });
};

const sanitizeTemplate = (value: unknown): Template | null => {
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<Template & { id: unknown; createdAt: unknown; updatedAt: unknown }>;

    if (typeof record.name !== 'string' || typeof record.content !== 'string') return null;

    const draft: TemplateDraft = {
        name: record.name,
        description: typeof record.description === 'string' ? record.description : '',
        content: record.content,
        tags: Array.isArray(record.tags) ? (record.tags.filter((tag) => typeof tag === 'string') as string[]) : [],
        language: typeof record.language === 'string' ? record.language : undefined,
        category: typeof record.category === 'string' && VALID_CATEGORIES.has(record.category as TemplateCategory) ? (record.category as TemplateCategory) : undefined
    };

    const normalized = normalizeDraft(draft);
    const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();
    const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : createdAt;

    return {
        ...normalized,
        id: typeof record.id === 'string' ? record.id : createId(),
        createdAt,
        updatedAt
    } satisfies Template;
};

const getTemplatesFromStorage = () => {
    if (typeof window === 'undefined') return buildDefaultTemplates();

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultTemplates();

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return buildDefaultTemplates();

        const sanitized = parsed.map(sanitizeTemplate).filter(Boolean) as Template[];
        return sanitized.length ? sortTemplates(sanitized) : buildDefaultTemplates();
    } catch (error) {
        console.warn('[useTemplates] Failed to parse templates from storage:', error);
        return buildDefaultTemplates();
    }
};

const saveTemplatesToStorage = (templates: Template[]) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
        console.warn('[useTemplates] Failed to persist templates to storage:', error);
    }
};

const prepareImportedTemplates = (payload: unknown) => {
    if (!Array.isArray(payload)) return [] as Template[];

    const next: Template[] = [];
    const seenIds = new Set<string>();

    for (const entry of payload) {
        const sanitized = sanitizeTemplate(entry);
        if (!sanitized) continue;
        if (seenIds.has(sanitized.id)) {
            sanitized.id = createId();
        }
        seenIds.add(sanitized.id);
        next.push(sanitized);
    }

    return sortTemplates(next);
};

interface UseTemplatesHook {
    templates: Template[];
    hydrated: boolean;
    count: number;
    createTemplate: (draft: TemplateDraft) => Template;
    updateTemplate: (id: string, patch: TemplateUpdate) => Template | null;
    deleteTemplate: (id: string) => void;
    duplicateTemplate: (id: string) => Template | null;
    resetTemplates: () => void;
    replaceTemplates: (payload: unknown) => number;
}

export const useTemplates = (): UseTemplatesHook => {
    const [hydrated, setHydrated] = useState(false);
    const [templates, setTemplates] = useState<Template[]>(() => getTemplatesFromStorage());

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const initial = getTemplatesFromStorage();
        setTemplates(initial);
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        saveTemplatesToStorage(templates);
    }, [templates, hydrated]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleStorage = (event: StorageEvent) => {
            if (event.key && event.key !== STORAGE_KEY) return;
            if (event.storageArea !== window.localStorage) return;

            const next = getTemplatesFromStorage();
            setTemplates(next);
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const updateState = useCallback((updater: (templates: Template[]) => Template[]) => {
        setTemplates((prev) => sortTemplates(updater(prev)));
    }, []);

    const createTemplate = useCallback(
        (draft: TemplateDraft) => {
            const normalized = normalizeDraft(draft);
            const timestamp = new Date().toISOString();
            const template: Template = {
                ...normalized,
                id: createId(),
                createdAt: timestamp,
                updatedAt: timestamp
            };

            updateState((prev) => [template, ...prev]);
            return template;
        },
        [updateState]
    );

    const updateTemplate = useCallback(
        (id: string, patch: TemplateUpdate) => {
            let nextTemplate: Template | null = null;
            updateState((prev) =>
                prev.map((template) => {
                    if (template.id !== id) return template;

                    const merged: TemplateDraft = {
                        name: patch.name ?? template.name,
                        description: patch.description ?? template.description,
                        content: patch.content ?? template.content,
                        tags: patch.tags ?? template.tags,
                        language: patch.language ?? template.language,
                        category: patch.category ?? template.category
                    };

                    const normalized = normalizeDraft(merged);
                    const updatedTemplate: Template = {
                        ...template,
                        ...normalized,
                        updatedAt: new Date().toISOString()
                    };

                    nextTemplate = updatedTemplate;
                    return updatedTemplate;
                })
            );

            return nextTemplate;
        },
        [updateState]
    );

    const deleteTemplate = useCallback(
        (id: string) => {
            updateState((prev) => prev.filter((template) => template.id !== id));
        },
        [updateState]
    );

    const duplicateTemplate = useCallback(
        (id: string) => {
            let duplicated: Template | null = null;
            updateState((prev) => {
                const existing = prev.find((template) => template.id === id);
                if (!existing) return prev;

                const timestamp = new Date().toISOString();
                duplicated = {
                    ...existing,
                    id: createId(),
                    name: `${existing.name} (Copy)`,
                    createdAt: timestamp,
                    updatedAt: timestamp
                } satisfies Template;

                return [duplicated, ...prev];
            });

            return duplicated;
        },
        [updateState]
    );

    const resetTemplates = useCallback(() => {
        updateState(() => buildDefaultTemplates());
    }, [updateState]);

    const replaceTemplates = useCallback((payload: unknown) => {
        const imported = prepareImportedTemplates(payload);
        if (!imported.length) return 0;

        setTemplates(imported);
        return imported.length;
    }, []);

    const value = useMemo(
        () => ({
            templates,
            hydrated,
            count: templates.length,
            createTemplate,
            updateTemplate,
            deleteTemplate,
            duplicateTemplate,
            resetTemplates,
            replaceTemplates
        }),
        [templates, hydrated, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate, resetTemplates, replaceTemplates]
    );

    return value;
};
