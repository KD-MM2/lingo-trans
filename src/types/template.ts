export type TemplateCategory = 'translation' | 'rewriting' | 'summarization' | 'general' | 'custom';

export interface Template {
    id: string;
    name: string;
    description: string;
    content: string;
    tags: string[];
    language?: string;
    category?: TemplateCategory;
    createdAt: string;
    updatedAt: string;
}

export type TemplateDraft = Omit<Template, 'id' | 'createdAt' | 'updatedAt'>;

export type TemplateUpdate = Partial<TemplateDraft>;
