type ModelProvider = 'openai' | 'claude' | 'self-hosted';

type TextSelectionBehavior = 'float-icon' | 'auto-translate' | 'off';

type Settings = {
    openaiApiKey: string;
    claudeApiKey: string;
    selfHostedHost: string;
    selfHostedApiKey: string;
    modelProvider: ModelProvider;
    model: string;
    customHeaders: Record<string, string>;
    selectionBehavior: TextSelectionBehavior;
    defaultTargetLanguage: string;
    popupTimeoutSeconds: number;
};

type SettingsPatch = Partial<Omit<Settings, 'customHeaders'>> & {
    customHeaders?: Record<string, string>;
};

export type { ModelProvider, Settings, SettingsPatch, TextSelectionBehavior };
