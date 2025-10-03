import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangleIcon, CheckIcon, CopyIcon, DownloadIcon, Edit3Icon, MoreVerticalIcon, PlusIcon, RefreshCcwIcon, SearchIcon, Trash2Icon, UploadIcon } from 'lucide-react';

import { useTemplates } from '@/hooks/use-templates';
import type { Template, TemplateCategory, TemplateDraft } from '@/types/template';

const categoryOptions: Array<{ label: string; value: TemplateCategory }> = [
    { label: 'Translation', value: 'translation' },
    { label: 'Rewriting', value: 'rewriting' },
    { label: 'Summarization', value: 'summarization' },
    { label: 'General', value: 'general' },
    { label: 'Custom', value: 'custom' }
];

type BannerState = {
    type: 'success' | 'error';
    message: string;
};

const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Unknown time';

    const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const thresholds: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
        { unit: 'year', seconds: 60 * 60 * 24 * 365 },
        { unit: 'month', seconds: 60 * 60 * 24 * 30 },
        { unit: 'week', seconds: 60 * 60 * 24 * 7 },
        { unit: 'day', seconds: 60 * 60 * 24 },
        { unit: 'hour', seconds: 60 * 60 },
        { unit: 'minute', seconds: 60 },
        { unit: 'second', seconds: 1 }
    ];

    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    for (const { unit, seconds } of thresholds) {
        const amount = diffInSeconds / seconds;
        if (Math.abs(amount) >= 1 || unit === 'second') {
            return formatter.format(Math.round(amount), unit);
        }
    }

    return formatter.format(0, 'second');
};

const formatAbsoluteTime = (isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const getPreview = (content: string, limit = 260) => {
    const trimmed = content.trim();
    if (!trimmed) return 'No content added yet.';
    if (trimmed.length <= limit) return trimmed;
    return `${trimmed.slice(0, limit).trimEnd()}…`;
};

const parseTags = (value: string) =>
    value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

interface TemplateFormProps {
    mode: 'create' | 'edit';
    initialTemplate?: Template | null;
    onSubmit: (draft: TemplateDraft) => void;
    onCancel: () => void;
}

function TemplateForm({ mode, initialTemplate, onSubmit, onCancel }: TemplateFormProps) {
    const [name, setName] = useState(initialTemplate?.name ?? '');
    const [description, setDescription] = useState(initialTemplate?.description ?? '');
    const [content, setContent] = useState(initialTemplate?.content ?? '');
    const [language, setLanguage] = useState(initialTemplate?.language ?? '');
    const [tagsInput, setTagsInput] = useState(initialTemplate?.tags.join(', ') ?? '');
    const [category, setCategory] = useState<TemplateCategory>(initialTemplate?.category ?? 'custom');
    const [showValidation, setShowValidation] = useState(false);

    useEffect(() => {
        setName(initialTemplate?.name ?? '');
        setDescription(initialTemplate?.description ?? '');
        setContent(initialTemplate?.content ?? '');
        setLanguage(initialTemplate?.language ?? '');
        setTagsInput(initialTemplate?.tags.join(', ') ?? '');
        setCategory(initialTemplate?.category ?? 'custom');
        setShowValidation(false);
    }, [initialTemplate?.id, initialTemplate?.category, initialTemplate?.content, initialTemplate?.description, initialTemplate?.language, initialTemplate?.name, initialTemplate?.tags]);

    const isValid = name.trim().length > 0 && content.trim().length > 0;

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!isValid) {
            setShowValidation(true);
            return;
        }

        const draft: TemplateDraft = {
            name: name.trim(),
            description: description.trim(),
            content: content.trim(),
            language: language.trim() ? language.trim() : undefined,
            tags: parseTags(tagsInput),
            category
        };

        onSubmit(draft);
    };

    return (
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="template-name">Template name</Label>
                    <Input id="template-name" value={name} autoFocus placeholder="e.g. Localize product update" aria-invalid={showValidation && !name.trim()} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="template-description">Description</Label>
                    <Textarea id="template-description" value={description} placeholder="What does this template help with?" onChange={(event) => setDescription(event.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="template-language">Primary language (optional)</Label>
                    <Input id="template-language" value={language} placeholder="e.g. English, Spanish" onChange={(event) => setLanguage(event.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="template-category">Category</Label>
                    <Select value={category} onValueChange={(value) => setCategory(value as TemplateCategory)}>
                        <SelectTrigger className="w-full" id="template-category">
                            <SelectValue placeholder="Choose a category" />
                        </SelectTrigger>
                        <SelectContent>
                            {categoryOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="template-tags">Tags (comma separated)</Label>
                    <Input id="template-tags" value={tagsInput} placeholder="e.g. translation, marketing" onChange={(event) => setTagsInput(event.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="template-content">Content</Label>
                    <Textarea
                        id="template-content"
                        className="min-h-48"
                        value={content}
                        placeholder="Write the reusable instructions, include {{placeholders}} where needed."
                        aria-invalid={showValidation && !content.trim()}
                        onChange={(event) => setContent(event.target.value)}
                    />
                </div>
            </div>
            {showValidation && !isValid ? <p className="text-destructive text-sm">A template needs at least a name and some content.</p> : null}
            <DialogFooter className="sm:justify-between">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" className="min-w-32">
                    {mode === 'edit' ? 'Save changes' : 'Create template'}
                </Button>
            </DialogFooter>
        </form>
    );
}

interface TemplateCardProps {
    template: Template;
    onEdit: (template: Template) => void;
    onDuplicate: (template: Template) => void;
    onDelete: (template: Template) => void;
    onCopy: (template: Template) => void;
    isCopied: boolean;
}

function TemplateCard({ template, onEdit, onDuplicate, onDelete, onCopy, isCopied }: TemplateCardProps) {
    return (
        <Card className="h-full">
            <CardHeader className="gap-3">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        {template.category ? (
                            <Badge variant="outline" className="uppercase tracking-wide text-[0.65rem]">
                                {template.category}
                            </Badge>
                        ) : null}
                    </div>
                    {template.description ? <CardDescription>{template.description}</CardDescription> : null}
                </div>
                <CardAction>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Manage actions for ${template.name}`}>
                                <MoreVerticalIcon className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => onEdit(template)}>
                                <Edit3Icon className="size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onDuplicate(template)}>
                                <CopyIcon className="size-4" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(template)}>
                                <Trash2Icon className="size-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
                <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground whitespace-pre-wrap">{getPreview(template.content)}</div>
                {template.tags.length ? (
                    <div className="flex flex-wrap gap-2">
                        {template.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                                #{tag}
                            </Badge>
                        ))}
                    </div>
                ) : null}
            </CardContent>
            <CardFooter className="justify-between text-xs text-muted-foreground">
                <span title={formatAbsoluteTime(template.updatedAt)}>Updated {formatRelativeTime(template.updatedAt)}</span>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => onCopy(template)}>
                    {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />} {isCopied ? 'Copied' : 'Copy'}
                </Button>
            </CardFooter>
        </Card>
    );
}

interface EmptyStateProps {
    hasSearch: boolean;
    onCreate: () => void;
    onClearSearch: () => void;
}

function EmptyState({ hasSearch, onCreate, onClearSearch }: EmptyStateProps) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/20 p-12 text-center">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold">{hasSearch ? 'No templates match your search' : 'No templates yet'}</h2>
                <p className="text-muted-foreground max-w-md">{hasSearch ? 'Try a different keyword or reset the filters to see all available templates.' : 'Templates help you reuse prompts faster. Create one to get started.'}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
                {hasSearch ? (
                    <>
                        <Button variant="outline" onClick={onClearSearch}>
                            Clear search
                        </Button>
                        <Button onClick={onCreate}>
                            <PlusIcon className="size-4" /> New template
                        </Button>
                    </>
                ) : (
                    <Button onClick={onCreate}>
                        <PlusIcon className="size-4" /> Create your first template
                    </Button>
                )}
            </div>
        </div>
    );
}

export default function Templates() {
    const { templates, hydrated, count, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate, resetTemplates, replaceTemplates } = useTemplates();
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [templatePendingDelete, setTemplatePendingDelete] = useState<Template | null>(null);
    const [banner, setBanner] = useState<BannerState | null>(null);
    const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const copyTimerRef = useRef<number | null>(null);

    const filteredTemplates = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return templates;

        return templates.filter((template) => {
            const haystack = [template.name, template.description, template.language ?? '', template.category ?? '', ...template.tags].join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }, [templates, search]);

    const editingTemplate = useMemo(() => (selectedTemplateId ? (templates.find((template) => template.id === selectedTemplateId) ?? null) : null), [templates, selectedTemplateId]);

    useEffect(
        () => () => {
            if (copyTimerRef.current) {
                window.clearTimeout(copyTimerRef.current);
            }
        },
        []
    );

    useEffect(() => {
        if (!banner) return;

        const timeout = window.setTimeout(() => setBanner(null), 4000);
        return () => window.clearTimeout(timeout);
    }, [banner]);

    const closeDialog = (open: boolean) => {
        setDialogOpen(open);
        if (!open) {
            setDialogMode('create');
            setSelectedTemplateId(null);
        }
    };

    const openCreateDialog = () => {
        setDialogMode('create');
        setSelectedTemplateId(null);
        setDialogOpen(true);
    };

    const openEditDialog = (template: Template) => {
        setSelectedTemplateId(template.id);
        setDialogMode('edit');
        setDialogOpen(true);
    };

    const handleFormSubmit = (draft: TemplateDraft) => {
        if (dialogMode === 'edit' && editingTemplate) {
            updateTemplate(editingTemplate.id, draft);
            setBanner({ type: 'success', message: 'Template updated.' });
        } else {
            createTemplate(draft);
            setBanner({ type: 'success', message: 'Template created.' });
        }
        closeDialog(false);
    };

    const handleDuplicate = (template: Template) => {
        duplicateTemplate(template.id);
        setBanner({ type: 'success', message: 'Template duplicated.' });
    };

    const handleDelete = () => {
        if (!templatePendingDelete) return;
        deleteTemplate(templatePendingDelete.id);
        setBanner({ type: 'success', message: 'Template deleted.' });
        setTemplatePendingDelete(null);
    };

    const handleCopy = async (template: Template) => {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            setBanner({ type: 'error', message: 'Clipboard access is not available in this browser.' });
            return;
        }

        try {
            await navigator.clipboard.writeText(template.content);
            setCopiedTemplateId(template.id);
            if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
            copyTimerRef.current = window.setTimeout(() => setCopiedTemplateId(null), 2000);
        } catch (error) {
            console.warn('Failed to copy template contents', error);
            setBanner({ type: 'error', message: 'Could not copy template. Copy manually instead.' });
        }
    };

    const handleExport = () => {
        const payload = JSON.stringify(templates, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `templates-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const handleImportButton = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const payload = JSON.parse(text) as unknown;
            const importedCount = replaceTemplates(payload);
            if (!importedCount) {
                setBanner({ type: 'error', message: 'No templates were imported. Check the file format.' });
            } else {
                setBanner({ type: 'success', message: `Imported ${importedCount} template${importedCount > 1 ? 's' : ''}.` });
            }
        } catch (error) {
            console.warn('Failed to import templates', error);
            setBanner({ type: 'error', message: 'Import failed. Provide a valid JSON export file.' });
        } finally {
            event.target.value = '';
        }
    };

    const handleReset = () => {
        resetTemplates();
        setSearch('');
        setBanner({ type: 'success', message: 'Restored default templates.' });
    };

    const showSkeletons = !hydrated && !count;

    return (
        <div className="flex flex-1 flex-col gap-6 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Templates</h1>
                    <p className="text-muted-foreground">Create, edit, and reuse prompt templates stored locally in your browser.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="relative w-full sm:w-64">
                        <SearchIcon className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                        <Input placeholder="Search templates" value={search} className="pl-9" onChange={(event) => setSearch(event.target.value)} aria-label="Search templates" />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button variant="outline" onClick={handleImportButton}>
                            <UploadIcon className="size-4" /> Import
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" aria-label="More template actions">
                                    <MoreVerticalIcon className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={handleExport}>
                                    <DownloadIcon className="size-4" /> Export JSON
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={handleReset}>
                                    <RefreshCcwIcon className="size-4" /> Restore defaults
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button onClick={openCreateDialog}>
                            <PlusIcon className="size-4" /> New template
                        </Button>
                    </div>
                </div>
            </div>

            {banner ? (
                <Alert variant={banner.type === 'error' ? 'destructive' : 'default'}>
                    {banner.type === 'error' ? <AlertTriangleIcon className="text-destructive" /> : <CheckIcon className="text-emerald-500" />}
                    <AlertDescription>{banner.message}</AlertDescription>
                </Alert>
            ) : null}

            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />

            {showSkeletons ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-64 rounded-xl" />
                    ))}
                </div>
            ) : filteredTemplates.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredTemplates.map((template) => (
                        <TemplateCard key={template.id} template={template} onEdit={openEditDialog} onDuplicate={handleDuplicate} onDelete={setTemplatePendingDelete} onCopy={handleCopy} isCopied={copiedTemplateId === template.id} />
                    ))}
                </div>
            ) : (
                <EmptyState hasSearch={Boolean(search.trim())} onCreate={openCreateDialog} onClearSearch={() => setSearch('')} />
            )}

            <Dialog open={dialogOpen} onOpenChange={closeDialog}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{dialogMode === 'edit' ? 'Edit template' : 'Create template'}</DialogTitle>
                        <DialogDescription>{dialogMode === 'edit' ? 'Update the template and save your changes. Updates are stored in your browser.' : 'Define reusable instructions and placeholders you can use across the app.'}</DialogDescription>
                    </DialogHeader>
                    <TemplateForm mode={dialogMode} initialTemplate={editingTemplate} onSubmit={handleFormSubmit} onCancel={() => closeDialog(false)} />
                </DialogContent>
            </Dialog>

            <AlertDialog open={Boolean(templatePendingDelete)} onOpenChange={(open) => (!open ? setTemplatePendingDelete(null) : null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete template</AlertDialogTitle>
                        <AlertDialogDescription>{templatePendingDelete ? `Delete “${templatePendingDelete.name}”? This action cannot be undone.` : 'This action cannot be undone.'}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
