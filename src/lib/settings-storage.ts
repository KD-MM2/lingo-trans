import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, sanitizeSettings } from '@src/lib/settings';
import type { Settings } from '@src/types/settings';

type StorageChangeHandler = (settings: Settings) => void;

const isBrowserStorageAvailable = () => {
    try {
        return typeof browser !== 'undefined' && Boolean(browser.storage?.local);
    } catch {
        return false;
    }
};

const readFromBrowserStorage = async (): Promise<Settings | null> => {
    if (!isBrowserStorageAvailable()) {
        return null;
    }

    try {
        const result = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
        const raw = result?.[SETTINGS_STORAGE_KEY];
        if (!raw) {
            return null;
        }
        return sanitizeSettings(raw);
    } catch (error) {
        console.debug('[settings-storage] Failed to read settings from browser.storage.local', error);
        return null;
    }
};

const writeToBrowserStorage = async (settings: Settings): Promise<void> => {
    if (!isBrowserStorageAvailable()) {
        return;
    }

    try {
        await browser.storage.local.set({
            [SETTINGS_STORAGE_KEY]: settings
        });
    } catch (error) {
        console.warn('[settings-storage] Failed to persist settings to browser.storage.local', error);
    }
};

const removeFromBrowserStorage = async (): Promise<void> => {
    if (!isBrowserStorageAvailable()) {
        return;
    }

    try {
        await browser.storage.local.remove(SETTINGS_STORAGE_KEY);
    } catch (error) {
        console.warn('[settings-storage] Failed to remove settings from browser.storage.local', error);
    }
};

const readFromWindowLocalStorage = (): Settings | null => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        return sanitizeSettings(JSON.parse(raw) as unknown);
    } catch (error) {
        console.debug('[settings-storage] Failed to read settings from window.localStorage', error);
        return null;
    }
};

const writeToWindowLocalStorage = (settings: Settings) => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }

    try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        console.warn('[settings-storage] Failed to persist settings to window.localStorage', error);
    }
};

const removeFromWindowLocalStorage = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }

    try {
        window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch (error) {
        console.warn('[settings-storage] Failed to remove settings from window.localStorage', error);
    }
};

const cloneSettings = (settings: Settings): Settings => ({ ...settings, customHeaders: { ...settings.customHeaders } });

const loadStoredSettings = async (): Promise<Settings> => {
    const browserSettings = await readFromBrowserStorage();
    if (browserSettings) {
        return browserSettings;
    }

    const windowSettings = readFromWindowLocalStorage();
    if (windowSettings) {
        return windowSettings;
    }

    return { ...DEFAULT_SETTINGS };
};

const persistStoredSettings = async (input: Settings): Promise<void> => {
    const sanitized = sanitizeSettings(input);
    await writeToBrowserStorage(cloneSettings(sanitized));
    writeToWindowLocalStorage(sanitized);
};

const clearStoredSettings = async (): Promise<void> => {
    await removeFromBrowserStorage();
    removeFromWindowLocalStorage();
};

const subscribeToStoredSettings = (handler: StorageChangeHandler): (() => void) => {
    let unsubscribeBrowser: (() => void) | null = null;

    if (isBrowserStorageAvailable()) {
        const browserHandler = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => {
            if (areaName !== 'local') {
                return;
            }

            const change = changes[SETTINGS_STORAGE_KEY];
            if (!change) {
                return;
            }

            const next = sanitizeSettings(change.newValue ?? DEFAULT_SETTINGS);
            handler(next);
        };

        try {
            browser.storage.onChanged.addListener(browserHandler);
            unsubscribeBrowser = () => {
                try {
                    browser.storage.onChanged.removeListener(browserHandler);
                } catch (error) {
                    console.debug('[settings-storage] Failed to remove browser.storage listener', error);
                }
            };
        } catch (error) {
            console.debug('[settings-storage] Unable to subscribe to browser.storage.onChanged', error);
        }
    }

    const windowHandler = (event: StorageEvent) => {
        if (event.key && event.key !== SETTINGS_STORAGE_KEY) {
            return;
        }
        const next = readFromWindowLocalStorage();
        handler(next ?? { ...DEFAULT_SETTINGS });
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('storage', windowHandler);
    }

    return () => {
        if (unsubscribeBrowser) {
            unsubscribeBrowser();
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', windowHandler);
        }
    };
};

export { clearStoredSettings, loadStoredSettings, persistStoredSettings, subscribeToStoredSettings };
