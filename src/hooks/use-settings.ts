import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_SETTINGS, sanitizeSettings } from '@src/lib/settings';
import { clearStoredSettings, loadStoredSettings, persistStoredSettings, subscribeToStoredSettings } from '@src/lib/settings-storage';
import type { Settings } from '@src/types/settings';

const useSettings = () => {
    const [hydrated, setHydrated] = useState(false);
    const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });

    useEffect(() => {
        let unsub: (() => void) | null = null;
        let isMounted = true;

        void loadStoredSettings()
            .then((stored) => {
                if (!isMounted) return;
                setSettings(stored);
                setHydrated(true);
            })
            .catch((error) => {
                console.warn('[useSettings] Failed to load stored settings:', error);
                if (isMounted) {
                    setSettings({ ...DEFAULT_SETTINGS });
                    setHydrated(true);
                }
            });

        unsub = subscribeToStoredSettings((next) => {
            setSettings(next);
            setHydrated(true);
        });

        return () => {
            isMounted = false;
            if (unsub) {
                unsub();
            }
        };
    }, []);

    const saveSettings = useCallback((input: Settings | ((current: Settings) => Settings)) => {
        setSettings((prev) => {
            const base = prev ?? { ...DEFAULT_SETTINGS };
            const next = typeof input === 'function' ? input(base) : input;
            const sanitized = sanitizeSettings(next);
            void persistStoredSettings(sanitized);
            return sanitized;
        });
        setHydrated(true);
    }, []);

    const resetSettings = useCallback(() => {
        const defaults = { ...DEFAULT_SETTINGS } as Settings;
        setSettings(defaults);
        void clearStoredSettings();
        setHydrated(true);
    }, []);

    const reloadSettings = useCallback(async () => {
        const next = await loadStoredSettings();
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
