import {
  defaultRewriteTemplate,
  defaultTranslateTemplate,
} from "@/lib/templates";
import type { ProviderConfig } from "@/lib/provider";

export interface Settings {
  provider: ProviderConfig;
  language: {
    from: "auto" | string;
    to: string;
  };
  behavior: {
    autoTranslateOnSelect: boolean;
    showFloatingIcon: boolean;
    streaming: boolean;
  };
  templates: {
    translate: string;
    rewrite: string;
  };
}

const SETTINGS_KEY = "settings";
const PROVIDER_API_KEY_KEY = "providerApiKey";

export async function loadSettings(): Promise<
  Settings & { providerApiKey?: string }
> {
  const data = await chrome.storage.local.get([
    SETTINGS_KEY,
    PROVIDER_API_KEY_KEY,
  ]);
  const uiLang = chrome.i18n?.getUILanguage?.() || navigator.language || "en";
  const target = (uiLang.split("-")[0] || "en").toLowerCase();

  const defaults: Settings = {
    provider: {
      baseUrl: "https://api.openai.com",
      model: "gpt-4o",
      protocol: "responses",
    },
    language: {
      from: "auto",
      to: target,
    },
    behavior: {
      autoTranslateOnSelect: false,
      showFloatingIcon: true,
      streaming: true,
    },
    templates: {
      translate: defaultTranslateTemplate,
      rewrite: defaultRewriteTemplate,
    },
  };

  const merged = {
    ...defaults,
    ...(data[SETTINGS_KEY] as Partial<Settings> | undefined),
  } as Settings;

  if (!merged.provider.protocol) merged.provider.protocol = "responses";
  if (!merged.provider.model) merged.provider.model = defaults.provider.model;

  return {
    ...merged,
    providerApiKey: data[PROVIDER_API_KEY_KEY] as string | undefined,
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, any> ? DeepPartial<T[K]> : T[K];
};

export async function saveSettings(update: DeepPartial<Settings>) {
  const current = await loadSettings();
  const merged: Settings = {
    ...current,
    provider: { ...current.provider, ...(update.provider ?? {}) },
    language: { ...current.language, ...(update.language ?? {}) },
    behavior: { ...current.behavior, ...(update.behavior ?? {}) },
    templates: { ...current.templates, ...(update.templates ?? {}) },
  };
  const { providerApiKey, ...storable } = merged as Settings & {
    providerApiKey?: string;
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: storable });
  if (providerApiKey !== undefined) {
    await chrome.storage.local.set({ [PROVIDER_API_KEY_KEY]: providerApiKey });
  }
}
