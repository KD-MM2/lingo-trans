import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, sanitizeSettings } from '@src/lib/settings';
import type { Settings } from '@src/types/settings';

const readSettingsFromStorage = (): Settings => {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };

    try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };

        const parsed = JSON.parse(raw) as unknown;
        return sanitizeSettings(parsed);
    } catch (error) {
        console.warn('[useSettings] Failed to read settings from storage:', error);
        return { ...DEFAULT_SETTINGS };
    }
};

const persistSettingsToStorage = (settings: Settings) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        console.warn('[useSettings] Failed to persist settings to storage:', error);
    }
};

const useSettings = () => {
    const [hydrated, setHydrated] = useState(false);
    const [settings, setSettings] = useState<Settings>(() => readSettingsFromStorage());

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const next = readSettingsFromStorage();
        setSettings(next);
        setHydrated(true);

        const handleStorage = (event: StorageEvent) => {
            if (event.key && event.key !== SETTINGS_STORAGE_KEY) return;
            if (event.storageArea !== window.localStorage) return;
            setSettings(readSettingsFromStorage());
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const saveSettings = useCallback((input: Settings | ((current: Settings) => Settings)) => {
        setSettings((prev) => {
            const next = typeof input === 'function' ? input(prev) : input;
            const sanitized = sanitizeSettings(next);
            persistSettingsToStorage(sanitized);
            return sanitized;
        });
        setHydrated(true);
    }, []);

    const resetSettings = useCallback(() => {
        setSettings({ ...DEFAULT_SETTINGS });
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
            } catch (error) {
                console.warn('[useSettings] Failed to remove settings from storage:', error);
            }
        }
        setHydrated(true);
    }, []);

    const reloadSettings = useCallback(() => {
        const next = readSettingsFromStorage();
        setSettings(next);
        setHydrated(true);
        return next;
    }, []);

    return useMemo(
        () => ({
            settings,
            hydrated,
            saveSettings,
            resetSettings,
            reloadSettings
        }),
        [settings, hydrated, saveSettings, resetSettings, reloadSettings]
    );
};

export { useSettings };
