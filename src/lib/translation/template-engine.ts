/**
 * Template Engine
 * Handles variable substitution in prompt templates
 */

export interface TemplateVariables {
    source_text?: string;
    target_language?: string;
    source_language?: string;
    tone?: string;
    domain?: string;
    preserve_html?: boolean;
    glossary?: Record<string, string>;
    [key: string]: string | boolean | Record<string, string> | undefined;
}

/**
 * Replace variables in template string
 */
export function substituteVariables(template: string, variables: TemplateVariables): string {
    let result = template;

    // Replace simple string variables: {{variable_name}}
    const stringVars = ['source_text', 'target_language', 'source_language', 'tone', 'domain'];

    for (const varName of stringVars) {
        const value = variables[varName];
        if (typeof value === 'string') {
            const pattern = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'g');
            result = result.replace(pattern, value);
        }
    }

    // Handle boolean variables
    if (variables.preserve_html !== undefined) {
        const preserveHtmlInstruction = variables.preserve_html ? 'IMPORTANT: Preserve all HTML tags and attributes exactly. Only translate text content between tags.' : '';
        result = result.replace(/\{\{\s*preserve_html\s*\}\}/g, preserveHtmlInstruction);
    }

    // Handle glossary
    if (variables.glossary && Object.keys(variables.glossary).length > 0) {
        let glossaryText = 'Glossary (use these exact translations):\n';
        Object.entries(variables.glossary).forEach(([term, translation]) => {
            glossaryText += `- ${term} → ${translation}\n`;
        });
        result = result.replace(/\{\{\s*glossary\s*\}\}/g, glossaryText);
    } else {
        // Remove glossary placeholder if no glossary provided
        result = result.replace(/\{\{\s*glossary\s*\}\}/g, '');
    }

    // Clean up any remaining unreplaced variables (optional)
    // result = result.replace(/\{\{[^}]+\}\}/g, '');

    return result.trim();
}

/**
 * Validate template syntax
 */
export function validateTemplate(template: string): {
    valid: boolean;
    errors: string[];
    variables: string[];
} {
    const errors: string[] = [];
    const variables: string[] = [];

    // Find all variable placeholders
    const varPattern = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;
    const matches = template.matchAll(varPattern);

    for (const match of matches) {
        const varName = match[1].toLowerCase();
        if (!variables.includes(varName)) {
            variables.push(varName);
        }
    }

    // Check for unmatched braces
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
        errors.push('Unmatched braces: {{ and }} must be balanced');
    }

    // Check for known variables
    const knownVars = ['source_text', 'target_language', 'source_language', 'tone', 'domain', 'preserve_html', 'glossary'];

    const unknownVars = variables.filter((v) => !knownVars.includes(v));
    if (unknownVars.length > 0) {
        errors.push(`Unknown variables: ${unknownVars.join(', ')}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        variables
    };
}

/**
 * Get preview of template with sample data
 */
export function previewTemplate(template: string, sampleData?: Partial<TemplateVariables>): string {
    const defaultSample: TemplateVariables = {
        source_text: 'Hello, world!',
        target_language: 'Spanish',
        source_language: 'English',
        tone: 'neutral',
        domain: 'general',
        preserve_html: false,
        glossary: {
            Hello: 'Hola'
        },
        ...sampleData
    };

    return substituteVariables(template, defaultSample);
}

/**
 * Extract variables from template
 */
export function extractVariables(template: string): string[] {
    const varPattern = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;
    const matches = template.matchAll(varPattern);
    const variables = new Set<string>();

    for (const match of matches) {
        variables.add(match[1].toLowerCase());
    }

    return Array.from(variables);
}

/**
 * Default templates
 */
export const DEFAULT_TEMPLATES = {
    translation: `Translate the following text to {{target_language}}.

Instructions:
- Maintain the original meaning, tone, and punctuation
- Do not add explanations or comments
- Output only the translated text

{{preserve_html}}

{{glossary}}

Text to translate:
{{source_text}}`,

    rewriting: `Rewrite the following text in {{target_language}}.

Tone: {{tone}}

Instructions:
- Preserve the original facts and meaning
- Do not add explanations or comments
- Output only the rewritten text

Text to rewrite:
{{source_text}}`,

    summarization: `Summarize the following text in {{target_language}}.

Instructions:
- Extract key points and main ideas
- Be concise and clear
- Do not add your own opinions
- Output only the summary

Text to summarize:
{{source_text}}`
};
