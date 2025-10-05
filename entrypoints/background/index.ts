import { defineBackground } from 'wxt/utils/define-background';
import { translate } from '@src/lib/api';
import {
    isOpenSidePanelMessage,
    SELECTION_TRANSLATION_PORT,
    START_SELECTION_TRANSLATION,
    CANCEL_SELECTION_TRANSLATION,
    SELECTION_TRANSLATION_CHUNK,
    SELECTION_TRANSLATION_COMPLETE,
    SELECTION_TRANSLATION_ERROR,
    type SelectionTranslationPortRequest
} from '@src/lib/extension-messages';
import { loadStoredSettings } from '@src/lib/settings-storage';
import { DEFAULT_SETTINGS } from '@src/lib/settings';

const SIDE_PANEL_PATH = 'sidepanel.html';

type ChromeSidePanelApi = {
    setOptions?: (options: { tabId: number; path?: string; enabled?: boolean }) => void | Promise<void>;
    setPanelBehavior?: (options: { openPanelOnActionClick: boolean }) => void | Promise<void>;
    open?: (options: { tabId: number } | { windowId: number }) => void | Promise<void>;
};

type ChromeActionApi = {
    onClicked?: {
        addListener: (callback: (tab: TabLike) => void) => void;
    };
};

type ChromeRuntimeApi = {
    onMessage?: {
        addListener: (callback: (message: unknown, sender: MessageSenderLike) => void) => void;
    };
    onInstalled?: {
        addListener: (callback: () => void) => void;
    };
    onConnect?: {
        addListener: (callback: (port: RuntimePortLike) => void) => void;
    };
    lastError?: { message?: string };
};

type ChromeApi = {
    sidePanel?: ChromeSidePanelApi;
    action?: ChromeActionApi;
    runtime?: ChromeRuntimeApi;
    windows?: ChromeWindowsApi;
};

const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeApi }).chrome;

type TabLike = { id?: number | null; windowId?: number | null };

type MessageSenderLike = { tab?: TabLike | undefined };

type RuntimePortLike = {
    name: string;
    postMessage: (message: unknown) => void;
    onMessage?: {
        addListener: (callback: (message: unknown) => void) => void;
    };
    onDisconnect?: {
        addListener: (callback: () => void) => void;
    };
    disconnect?: () => void;
};

type WindowLike = { id?: number | null };

type ChromeWindowsApi = {
    getCurrent?: (callback: (window: WindowLike) => void) => void;
};

const isPromise = (value: unknown): value is Promise<unknown> => typeof value === 'object' && value !== null && typeof (value as Promise<unknown>).then === 'function';

const normalizeTabId = (tab: TabLike | null | undefined): number | undefined => {
    if (!tab) {
        return undefined;
    }

    return typeof tab.id === 'number' ? tab.id : undefined;
};

const normalizeWindowId = (tab: TabLike | null | undefined): number | undefined => {
    if (!tab) {
        return undefined;
    }

    return typeof tab.windowId === 'number' ? tab.windowId : undefined;
};

type SidePanelTarget = { tabId?: number; windowId?: number };

type PanelSession = { opened: boolean; lastTabId?: number };

const panelStateByWindow = new Map<number, PanelSession>();

const registerSelectionTranslationPort = () => {
    if (!chromeApi?.runtime?.onConnect) {
        return;
    }

    chromeApi.runtime.onConnect.addListener((port) => {
        if (!port || port.name !== SELECTION_TRANSLATION_PORT) {
            return;
        }

        let portClosed = false;
        const activeControllers = new Map<string, AbortController>();

        const postSafeMessage = (message: unknown) => {
            if (portClosed) {
                return;
            }
            try {
                port.postMessage(message);
            } catch (error) {
                console.debug('[LingoTrans] Failed to post selection translation message', error);
            }
        };

        const handleStart = async (payload: Extract<SelectionTranslationPortRequest, { type: typeof START_SELECTION_TRANSLATION }>) => {
            const { requestId, text, targetLanguage } = payload;
            const controller = new AbortController();
            activeControllers.set(requestId, controller);

            let fullContent = '';

            try {
                const storedSettings = await loadStoredSettings();
                const safeSettings = storedSettings ?? { ...DEFAULT_SETTINGS };
                const effectiveTargetLanguage = targetLanguage || safeSettings.defaultTargetLanguage || DEFAULT_SETTINGS.defaultTargetLanguage;

                const response = await translate(
                    safeSettings,
                    { text, targetLanguage: effectiveTargetLanguage },
                    {
                        signal: controller.signal,
                        onStream: (chunk) => {
                            if (controller.signal.aborted || portClosed) {
                                return;
                            }

                            if (chunk.content) {
                                fullContent += chunk.content;
                            }

                            postSafeMessage({
                                type: SELECTION_TRANSLATION_CHUNK,
                                requestId,
                                content: chunk.content,
                                done: chunk.done,
                                error: chunk.error
                            });

                            if (chunk.error) {
                                controller.abort();
                            }
                        }
                    }
                );

                if (controller.signal.aborted || portClosed) {
                    return;
                }

                const finalContent = response.content || fullContent;

                postSafeMessage({
                    type: SELECTION_TRANSLATION_COMPLETE,
                    requestId,
                    content: finalContent
                });
            } catch (error) {
                if (controller.signal.aborted || portClosed) {
                    return;
                }

                const message = error instanceof Error ? error.message : String(error ?? 'Translation failed');

                postSafeMessage({
                    type: SELECTION_TRANSLATION_ERROR,
                    requestId,
                    message
                });
            } finally {
                activeControllers.delete(requestId);
            }
        };

        const handleCancel = (payload: Extract<SelectionTranslationPortRequest, { type: typeof CANCEL_SELECTION_TRANSLATION }>) => {
            const entry = activeControllers.get(payload.requestId);
            if (entry) {
                entry.abort();
                activeControllers.delete(payload.requestId);
            }
        };

        const handlePortMessage = (raw: SelectionTranslationPortRequest) => {
            if (!raw || typeof raw !== 'object') {
                return;
            }

            switch (raw.type) {
                case START_SELECTION_TRANSLATION:
                    void handleStart(raw);
                    break;
                case CANCEL_SELECTION_TRANSLATION:
                    handleCancel(raw);
                    break;
                default:
                    break;
            }
        };

        try {
            port.onMessage?.addListener?.(handlePortMessage as (message: unknown) => void);
        } catch (error) {
            console.debug('[LingoTrans] Unable to listen for selection translation port messages', error);
        }

        port.onDisconnect?.addListener?.(() => {
            portClosed = true;
            activeControllers.forEach((controller) => controller.abort());
            activeControllers.clear();
        });
    });
};

const callSidePanelOpen = (args: { tabId: number } | { windowId: number }) => {
    try {
        const maybeOpen = chromeApi?.sidePanel?.open?.(args);
        if (isPromise(maybeOpen)) {
            maybeOpen.catch((error: unknown) => {
                console.warn('[LingoTrans] Failed to open the side panel', error);
            });
        }
    } catch (error) {
        console.warn('[LingoTrans] Failed to open the side panel', error);
    }
};

const ensureSidePanelOptionsForTab = (tabId: number, enabled: boolean) => {
    try {
        const options = enabled ? { tabId, path: SIDE_PANEL_PATH, enabled: true } : { tabId, enabled: false };

        const maybeSetOptions = chromeApi?.sidePanel?.setOptions?.(options);

        if (isPromise(maybeSetOptions)) {
            maybeSetOptions.catch((error: unknown) => {
                console.debug('[LingoTrans] Failed to configure side panel options for tab', error);
            });
        }
    } catch (error) {
        console.debug('[LingoTrans] Failed to configure side panel options for tab', error);
    }
};

const resolveTargetWindowId = (target: SidePanelTarget | undefined, callback: (windowId: number | undefined) => void) => {
    if (target?.windowId !== undefined) {
        callback(target.windowId);
        return;
    }

    if (!chromeApi?.windows?.getCurrent) {
        callback(undefined);
        return;
    }

    try {
        chromeApi.windows.getCurrent?.((window) => {
            const currentWindowId = typeof window?.id === 'number' ? window.id : undefined;
            callback(currentWindowId);
        });
    } catch (error) {
        console.debug('[LingoTrans] Failed to resolve current window for side panel open', error);
        callback(undefined);
    }
};

const openSidePanelForTarget = (inputTarget?: SidePanelTarget) => {
    if (!chromeApi?.sidePanel) {
        return;
    }

    resolveTargetWindowId(inputTarget, (resolvedWindowId) => {
        const existingSession = resolvedWindowId !== undefined ? panelStateByWindow.get(resolvedWindowId) : undefined;
        const candidateTabId = inputTarget?.tabId ?? existingSession?.lastTabId;

        const shouldClose = existingSession?.opened === true;

        if (shouldClose) {
            if (candidateTabId !== undefined) {
                ensureSidePanelOptionsForTab(candidateTabId, false);
            }

            if (resolvedWindowId !== undefined) {
                panelStateByWindow.set(resolvedWindowId, {
                    opened: false,
                    lastTabId: candidateTabId
                });
            }

            return;
        }

        if (candidateTabId !== undefined) {
            ensureSidePanelOptionsForTab(candidateTabId, true);
        }

        const openArgs = resolvedWindowId !== undefined ? { windowId: resolvedWindowId } : candidateTabId !== undefined ? { tabId: candidateTabId } : undefined;
        if (!openArgs) {
            console.debug('[LingoTrans] Missing target information to open side panel');
            return;
        }

        callSidePanelOpen(openArgs);

        if (resolvedWindowId !== undefined) {
            panelStateByWindow.set(resolvedWindowId, {
                opened: true,
                lastTabId: candidateTabId
            });
        }
    });
};

const registerActionBehavior = () => {
    if (!chromeApi?.sidePanel) {
        return;
    }

    try {
        const maybeBehavior = chromeApi.sidePanel.setPanelBehavior?.({ openPanelOnActionClick: true });
        if (isPromise(maybeBehavior)) {
            maybeBehavior.catch((error: unknown) => {
                console.debug('[LingoTrans] Unable to set panel behavior to auto-open on action click', error);
            });
        }
    } catch (error) {
        console.debug('[LingoTrans] setPanelBehavior is unavailable', error);
    }
};

const registerActionClickHandler = () => {
    if (!chromeApi?.action?.onClicked) {
        return;
    }

    chromeApi.action.onClicked.addListener((tab: TabLike) => {
        const tabId = normalizeTabId(tab);
        const windowId = normalizeWindowId(tab);
        const target = tabId === undefined && windowId === undefined ? undefined : { tabId, windowId };

        void openSidePanelForTarget(target);
    });
};

const registerMessageHandler = () => {
    if (!chromeApi?.runtime?.onMessage) {
        return;
    }

    chromeApi.runtime.onMessage.addListener((message: unknown, sender: MessageSenderLike) => {
        if (!isOpenSidePanelMessage(message)) {
            return;
        }

        const tabId = typeof message.tabId === 'number' ? message.tabId : normalizeTabId(sender?.tab);
        const windowId = normalizeWindowId(sender?.tab);
        const target = tabId === undefined && windowId === undefined ? undefined : { tabId, windowId };

        void openSidePanelForTarget(target);
    });
};

export default defineBackground(() => {
    if (!chromeApi) {
        console.warn('[LingoTrans] chrome APIs are unavailable in the background service worker.');
        return;
    }

    registerActionBehavior();
    registerActionClickHandler();
    registerMessageHandler();
    registerSelectionTranslationPort();

    if (chromeApi.runtime?.onInstalled) {
        chromeApi.runtime.onInstalled.addListener(() => {
            registerActionBehavior();
        });
    }
});
