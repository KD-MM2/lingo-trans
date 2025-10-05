import { browser } from 'wxt/browser';
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
    CONTEXT_TRANSLATE_SELECTION,
    CONTEXT_TRANSLATE_PAGE,
    SIDE_PANEL_TRANSLATE_REQUEST,
    SIDE_PANEL_TRANSLATE_STORAGE_KEY,
    type SelectionTranslationPortRequest,
    type ContextTranslateSelectionMessage,
    type ContextTranslatePageMessage,
    type SidePanelTranslateRequest
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

type ChromeContextMenuOnClickInfo = {
    menuItemId: string | number;
    selectionText?: string;
};

type ChromeContextMenusApi = {
    removeAll?: (callback?: () => void) => void | Promise<void>;
    create?: (properties: { id?: string; title: string; contexts: string[]; parentId?: string }) => void | number | Promise<void | number>;
    onClicked?: {
        addListener: (callback: (info: ChromeContextMenuOnClickInfo, tab?: TabLike) => void) => void;
    };
};

type ChromeTabsApi = {
    sendMessage?: (tabId: number, message: unknown) => void | Promise<void>;
};

type ChromeStorageLocalApi = {
    set?: (items: Record<string, unknown>) => void | Promise<void>;
    remove?: (keys: string | string[]) => void | Promise<void>;
};

type ChromeStorageApi = {
    local?: ChromeStorageLocalApi;
};

type ChromeApi = {
    sidePanel?: ChromeSidePanelApi;
    action?: ChromeActionApi;
    runtime?: ChromeRuntimeApi;
    contextMenus?: ChromeContextMenusApi;
    tabs?: ChromeTabsApi;
    storage?: ChromeStorageApi;
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

const CONTEXT_MENU_SELECTION_POPUP = 'lingotrans:context:selection:popup';
const CONTEXT_MENU_SELECTION_SIDEPANEL = 'lingotrans:context:selection:sidepanel';
const CONTEXT_MENU_PAGE_INLINE = 'lingotrans:context:page:inline';
const CONTEXT_MENU_PAGE_SIDEPANEL = 'lingotrans:context:page:sidepanel';

const sendMessageToTab = async (tabId: number, message: ContextTranslateSelectionMessage | ContextTranslatePageMessage) => {
    try {
        const maybeResult = chromeApi?.tabs?.sendMessage?.(tabId, message);
        if (isPromise(maybeResult)) {
            await maybeResult;
        }
    } catch (error) {
        console.debug('[LingoTrans] Failed to send message to tab', error);
    }
};

const persistSidePanelPayload = async (payload: Omit<SidePanelTranslateRequest, 'type'> & { timestamp?: number }) => {
    if (!chromeApi?.storage?.local?.set) {
        return;
    }

    try {
        const value = {
            ...payload,
            timestamp: payload.timestamp ?? Date.now()
        } satisfies Record<string, unknown>;
        await chromeApi.storage.local.set({
            [SIDE_PANEL_TRANSLATE_STORAGE_KEY]: value
        });
    } catch (error) {
        console.debug('[LingoTrans] Failed to persist side panel payload to storage', error);
    }
};

const emitSidePanelPayload = async (payload: Omit<SidePanelTranslateRequest, 'type'>) => {
    try {
        await browser.runtime.sendMessage({
            type: SIDE_PANEL_TRANSLATE_REQUEST,
            ...payload
        } satisfies SidePanelTranslateRequest);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? 'Unknown runtime error');
        if (!message.includes('Could not establish connection')) {
            console.debug('[LingoTrans] Failed to emit side panel payload message', error);
        }
    }
};

const startSidePanelTranslation = async (target: SidePanelTarget | undefined, payload: Omit<SidePanelTranslateRequest, 'type'>) => {
    const openPromise = openSidePanelForTarget(target, { forceOpen: true });

    const enrichedPayload = {
        ...payload,
        timestamp: Date.now()
    } satisfies Omit<SidePanelTranslateRequest, 'type'>;

    try {
        await persistSidePanelPayload(enrichedPayload);
        await emitSidePanelPayload(enrichedPayload);
    } catch (error) {
        console.debug('[LingoTrans] Failed to prepare side panel translation payload', error);
    } finally {
        await openPromise;
    }
};

let contextMenuClickRegistered = false;

const handleContextMenuClick = (info: ChromeContextMenuOnClickInfo, tab: TabLike | undefined) => {
    const menuId = typeof info.menuItemId === 'string' ? info.menuItemId : String(info.menuItemId);
    const tabId = normalizeTabId(tab);
    const windowId = normalizeWindowId(tab);
    const target = tabId === undefined && windowId === undefined ? undefined : { tabId, windowId };
    const selectionText = typeof info.selectionText === 'string' ? info.selectionText : '';

    switch (menuId) {
        case CONTEXT_MENU_SELECTION_POPUP: {
            if (tabId === undefined) {
                break;
            }

            const payload: ContextTranslateSelectionMessage = {
                type: CONTEXT_TRANSLATE_SELECTION,
                mode: 'popup',
                text: selectionText
            };

            void sendMessageToTab(tabId, payload);
            break;
        }
        case CONTEXT_MENU_SELECTION_SIDEPANEL: {
            if (!selectionText.trim()) {
                break;
            }

            void startSidePanelTranslation(target, {
                text: selectionText,
                source: 'selection'
            });
            break;
        }
        case CONTEXT_MENU_PAGE_INLINE: {
            if (tabId === undefined) {
                break;
            }

            const payload: ContextTranslatePageMessage = {
                type: CONTEXT_TRANSLATE_PAGE,
                mode: 'inline'
            };

            void sendMessageToTab(tabId, payload);
            break;
        }
        case CONTEXT_MENU_PAGE_SIDEPANEL: {
            const text = selectionText.trim();
            void startSidePanelTranslation(target, {
                text,
                source: 'page'
            });
            break;
        }
        default:
            break;
    }
};

const registerContextMenus = () => {
    const api = chromeApi?.contextMenus;
    if (!api?.create) {
        return;
    }

    const createMenus = () => {
        try {
            api.create?.({ id: CONTEXT_MENU_SELECTION_POPUP, title: 'Translate selection', contexts: ['selection'] });
            api.create?.({ id: CONTEXT_MENU_SELECTION_SIDEPANEL, title: 'Translate selection in side panel', contexts: ['selection'] });
            api.create?.({ id: CONTEXT_MENU_PAGE_INLINE, title: 'Translate page', contexts: ['page'] });
            api.create?.({ id: CONTEXT_MENU_PAGE_SIDEPANEL, title: 'Translate page in side panel', contexts: ['page'] });
        } catch (error) {
            console.debug('[LingoTrans] Failed to create context menu items', error);
        }

        if (!contextMenuClickRegistered && api.onClicked?.addListener) {
            contextMenuClickRegistered = true;
            api.onClicked.addListener(handleContextMenuClick);
        }
    };

    try {
        const maybePromise = api.removeAll?.(createMenus);
        if (isPromise(maybePromise)) {
            void maybePromise.then(createMenus).catch((error) => {
                console.debug('[LingoTrans] Failed to clear existing context menus', error);
                createMenus();
            });
        } else if (!api.removeAll) {
            createMenus();
        }
    } catch (error) {
        console.debug('[LingoTrans] Unable to reset context menus', error);
        createMenus();
    }
};

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

const callSidePanelOpen = async (args: { tabId: number } | { windowId: number }): Promise<boolean> => {
    if (!chromeApi?.sidePanel?.open) {
        return Promise.resolve(false);
    }

    try {
        const maybeOpen = chromeApi.sidePanel.open(args);
        if (isPromise(maybeOpen)) {
            return maybeOpen
                .then(() => true)
                .catch((error: unknown) => {
                    console.warn('[LingoTrans] Failed to open the side panel', error);
                    return false;
                });
        }

        return Promise.resolve(true);
    } catch (error) {
        console.warn('[LingoTrans] Failed to open the side panel', error);
        return Promise.resolve(false);
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

const openSidePanelForTarget = (inputTarget?: SidePanelTarget, options?: { forceOpen?: boolean }): Promise<boolean> => {
    if (!chromeApi?.sidePanel) {
        return Promise.resolve(false);
    }

    const resolvedWindowId = inputTarget?.windowId;
    const existingSession = resolvedWindowId !== undefined ? panelStateByWindow.get(resolvedWindowId) : undefined;
    const candidateTabId = inputTarget?.tabId ?? existingSession?.lastTabId;
    const forceOpen = options?.forceOpen === true;

    const shouldClose = !forceOpen && existingSession?.opened === true;

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

        return Promise.resolve(false);
    }

    if (candidateTabId !== undefined) {
        ensureSidePanelOptionsForTab(candidateTabId, true);
    }

    const openArgs = resolvedWindowId !== undefined ? { windowId: resolvedWindowId } : candidateTabId !== undefined ? { tabId: candidateTabId } : undefined;
    if (!openArgs) {
        console.debug('[LingoTrans] Missing target information to open side panel');
        return Promise.resolve(false);
    }

    if (resolvedWindowId !== undefined) {
        panelStateByWindow.set(resolvedWindowId, {
            opened: true,
            lastTabId: candidateTabId
        });
    }

    return callSidePanelOpen(openArgs).then((opened) => {
        if (resolvedWindowId !== undefined) {
            panelStateByWindow.set(resolvedWindowId, {
                opened,
                lastTabId: candidateTabId
            });
        }

        return opened;
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
    registerContextMenus();

    if (chromeApi.runtime?.onInstalled) {
        chromeApi.runtime.onInstalled.addListener(() => {
            registerActionBehavior();
            registerContextMenus();
        });
    }
});
