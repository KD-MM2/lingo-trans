import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { SelectionDetector, type SelectionSnapshot } from '@src/lib/selection/detector';
import { SelectionPopup } from '@src/lib/selection/popup';
import { DEFAULT_SETTINGS } from '@src/lib/settings';
import { loadStoredSettings, subscribeToStoredSettings } from '@src/lib/settings-storage';
import {
    CANCEL_SELECTION_TRANSLATION,
    OPEN_SIDE_PANEL_MESSAGE,
    SELECTION_TRANSLATION_CHUNK,
    SELECTION_TRANSLATION_COMPLETE,
    SELECTION_TRANSLATION_ERROR,
    SELECTION_TRANSLATION_PORT,
    START_SELECTION_TRANSLATION,
    type SelectionTranslationPortResponse
} from '@src/lib/extension-messages';
import { resolveLanguageLabel } from '@src/lib/languages';
import type { Settings } from '@src/types/settings';

type SelectionBehavior = Settings['selectionBehavior'];

const HOST_ID = 'lingotrans-selection-overlay-host';
const BUTTON_ID = 'lingotrans-selection-button';
const PREFERRED_OFFSET_PX = 12;
const VIEWPORT_PADDING_PX = 8;

const shouldSkipInjection = () => {
    if (window.top !== window.self) return true;
    const url = window.location.href;
    if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('moz-extension://')) return true;
    if (document.contentType === 'application/pdf') return true;
    return false;
};

type SelectionState = {
    text: string;
    behavior: SelectionBehavior;
    rect: DOMRect;
};

type RuntimePort = ReturnType<typeof browser.runtime.connect>;

type SelectionButtonCallbacks = {
    onTranslate: () => void;
    onPin?: () => void;
};

const createSelectionButton = ({ onTranslate }: SelectionButtonCallbacks) => {
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.position = 'absolute';
    host.style.zIndex = '2147483646';
    host.style.pointerEvents = 'none';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '0';
    host.style.height = '0';
    host.style.opacity = '0';
    host.style.transition = 'opacity 180ms ease';

    const shadowRoot = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host,
        * {
            box-sizing: border-box;
        }

        #${BUTTON_ID} {
            all: unset;
            pointer-events: auto;
            cursor: pointer;
            padding: 0.45rem 0.75rem;
            border-radius: 9999px;
            background: linear-gradient(135deg, #3b82f6, #22d3ee);
            color: #0f172a;
            font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.02em;
            box-shadow:
                0 16px 30px rgba(15, 23, 42, 0.24),
                inset 0 1px 1px rgba(255, 255, 255, 0.16);
            transition:
                transform 180ms ease,
                box-shadow 180ms ease,
                background 180ms ease;
        }

        #${BUTTON_ID}:hover,
        #${BUTTON_ID}:focus-visible {
            transform: translateY(-1px) scale(1.02);
            box-shadow:
                0 18px 36px rgba(37, 99, 235, 0.28),
                inset 0 1px 2px rgba(255, 255, 255, 0.22);
        }

        #${BUTTON_ID}:focus-visible {
            outline: 2px solid rgba(125, 211, 252, 0.9);
            outline-offset: 3px;
        }
    `;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Translate';

    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onTranslate();
    });

    shadowRoot.append(style, button);

    document.addEventListener(
        'scroll',
        () => {
            if (host.style.opacity === '1') {
                host.style.opacity = '0';
            }
        },
        { capture: true }
    );

    return {
        host,
        button,
        setPosition(rect: DOMRect) {
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;
            const idealTop = rect.top + scrollY - button.offsetHeight - PREFERRED_OFFSET_PX;
            const idealLeft = rect.left + scrollX + rect.width / 2;
            const buttonRect = button.getBoundingClientRect();
            const width = buttonRect.width || 60;
            const height = buttonRect.height || 28;

            const top = Math.max(scrollY + VIEWPORT_PADDING_PX, Math.min(idealTop, scrollY + window.innerHeight - height - VIEWPORT_PADDING_PX));
            const left = Math.max(scrollX + VIEWPORT_PADDING_PX, Math.min(idealLeft - width / 2, scrollX + window.innerWidth - width - VIEWPORT_PADDING_PX));

            host.style.transform = `translate(${left}px, ${top}px)`;
        },
        show() {
            host.style.opacity = '1';
        },
        hide() {
            host.style.opacity = '0';
        }
    };
};

const cloneRect = (rect: DOMRect): DOMRect => new DOMRect(rect.x, rect.y, rect.width, rect.height);

const openSidePanel = async () => {
    try {
        await browser.runtime.sendMessage({ type: OPEN_SIDE_PANEL_MESSAGE });
    } catch (error) {
        console.debug('[LingoTrans] Failed to request side panel open from selection popup', error);
    }
};

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_idle',
    main(ctx) {
        if (shouldSkipInjection()) return;

        const detector = new SelectionDetector();
        let settings: Settings = { ...DEFAULT_SETTINGS };
        let selectionState: SelectionState | null = null;
        let buttonApi: ReturnType<typeof createSelectionButton> | null = null;
        let popup: SelectionPopup | null = null;
        let popupResultText = '';
        let hideTimerId: number | null = null;
        let activePort: RuntimePort | null = null;
        let activeRequestId: string | null = null;
        let activePortCleanup: (() => void) | null = null;
        let translationSequence = 0;
        let lastRequest: SelectionState | null = null;

        const clearHideTimer = () => {
            if (hideTimerId !== null) {
                window.clearTimeout(hideTimerId);
                hideTimerId = null;
            }
        };

        const resetPopup = () => {
            popup?.setTitle('Translate selection');
            popup?.setStatus('idle', 'Select text to translate');
            popup?.clear();
        };

        const cancelActiveTranslation = () => {
            if (!activePort) {
                return;
            }

            const port = activePort;
            const requestId = activeRequestId;

            if (requestId) {
                try {
                    port.postMessage({ type: CANCEL_SELECTION_TRANSLATION, requestId });
                } catch (error) {
                    console.debug('[LingoTrans] Failed to send cancel message for selection translation', error);
                }
            }

            if (activePortCleanup) {
                try {
                    activePortCleanup();
                } catch (error) {
                    console.debug('[LingoTrans] Failed to remove selection translation listeners', error);
                }
                activePortCleanup = null;
            }

            activePort = null;
            activeRequestId = null;

            try {
                port.disconnect();
            } catch (error) {
                console.debug('[LingoTrans] Failed to disconnect selection translation port', error);
            }
        };

        const getPopupTimeoutMs = () => Math.max(0, (settings.popupTimeoutSeconds ?? DEFAULT_SETTINGS.popupTimeoutSeconds) * 1000);

        const scheduleAutoHide = () => {
            clearHideTimer();
            const timeoutMs = getPopupTimeoutMs();
            if (timeoutMs === 0) {
                return;
            }
            hideTimerId = window.setTimeout(() => {
                popup?.hide();
                resetPopup();
            }, timeoutMs);
        };

        const ensurePopup = () => {
            if (popup) {
                return popup;
            }

            popup = new SelectionPopup({
                onCopy: async () => {
                    if (!popupResultText.trim()) {
                        popup?.setStatus('error', 'No translation available yet.');
                        return;
                    }

                    try {
                        await navigator.clipboard.writeText(popupResultText);
                        popup?.setStatus('success', 'Copied translated text');
                        scheduleAutoHide();
                    } catch (error) {
                        console.debug('[LingoTrans] Failed to copy translation to clipboard', error);
                        popup?.setStatus('error', 'Unable to copy to clipboard.');
                    }
                },
                onClose: () => {
                    clearHideTimer();
                    cancelActiveTranslation();
                    popup?.hide();
                    resetPopup();
                },
                onPin: () => {
                    clearHideTimer();
                    void openSidePanel();
                },
                onRetry: () => {
                    if (lastRequest) {
                        startTranslation(lastRequest, 'retry');
                    }
                }
            });

            resetPopup();

            ctx.onInvalidated(() => {
                popup?.hide();
                popup?.unmount();
                popup = null;
            });

            return popup;
        };

        function ensureButton() {
            if (buttonApi) return buttonApi;
            const api = createSelectionButton({
                onTranslate: () => {
                    if (!selectionState) return;
                    startTranslation(selectionState, 'manual');
                }
            });
            buttonApi = api;
            document.documentElement.append(api.host);
            ctx.onInvalidated(() => {
                api.host.remove();
                buttonApi = null;
            });
            return api;
        }

        function hideButton() {
            if (!buttonApi) return;
            buttonApi.hide();
        }

        type TranslateTrigger = 'manual' | 'auto' | 'retry';

        function startTranslation(candidate: SelectionState, trigger: TranslateTrigger) {
            const popupInstance = ensurePopup();
            const text = candidate.text.trim();
            if (!text) {
                return;
            }

            const rect = candidate.rect;

            const targetLanguage = settings.defaultTargetLanguage || DEFAULT_SETTINGS.defaultTargetLanguage;
            const targetLabel = resolveLanguageLabel(targetLanguage) || targetLanguage;

            lastRequest = {
                text,
                behavior: candidate.behavior,
                rect: cloneRect(rect)
            };

            cancelActiveTranslation();
            clearHideTimer();
            popupResultText = '';

            popupInstance.setTitle(trigger === 'retry' ? 'Retrying…' : 'Translating…');
            popupInstance.setStatus('loading', `Translating to ${targetLabel}`);
            popupInstance.clear();
            popupInstance.setPosition({ rect });
            popupInstance.show();
            hideButton();

            const requestId = `selection-${Date.now()}-${translationSequence++}`;
            const startedAt = performance.now();
            let translationSettled = false;

            let port: RuntimePort;
            try {
                port = browser.runtime.connect({ name: SELECTION_TRANSLATION_PORT });
            } catch (error) {
                console.debug('[LingoTrans] Failed to connect to selection translation port', error);
                popupInstance.setTitle('Translation failed');
                popupInstance.setStatus('error', 'Unable to reach the translator. Please try again.');
                return;
            }

            const finalizePort = () => {
                if (activePortCleanup) {
                    try {
                        activePortCleanup();
                    } catch (listenerError) {
                        console.debug('[LingoTrans] Failed to remove selection translation listeners during cleanup', listenerError);
                    }
                    activePortCleanup = null;
                }

                if (activePort === port) {
                    activePort = null;
                    activeRequestId = null;
                }

                try {
                    port.disconnect();
                } catch (error) {
                    console.debug('[LingoTrans] Failed to disconnect selection translation port after completion', error);
                }
            };

            const handleSuccess = () => {
                if (translationSettled) {
                    return;
                }

                translationSettled = true;
                finalizePort();
                const elapsedMs = performance.now() - startedAt;
                popupInstance.setTitle('Translation ready');
                popupInstance.setStatus('success', `Translated to ${targetLabel}${elapsedMs >= 200 ? ` in ${(elapsedMs / 1000).toFixed(1)}s` : ''}`);
                scheduleAutoHide();
            };

            const handleError = (message: string) => {
                if (translationSettled) {
                    return;
                }

                translationSettled = true;
                finalizePort();
                popupInstance.setTitle('Translation failed');
                popupInstance.setStatus('error', message || 'Translation failed. Please check your settings.');
            };

            const handlePortMessage = (message: SelectionTranslationPortResponse) => {
                if (translationSettled || message.requestId !== requestId) {
                    return;
                }

                switch (message.type) {
                    case SELECTION_TRANSLATION_CHUNK:
                        if (message.error) {
                            handleError(message.error);
                            return;
                        }

                        if (message.content) {
                            popupResultText += message.content;
                            popupInstance.appendContent(message.content);
                        }

                        if (message.done) {
                            handleSuccess();
                        }
                        break;
                    case SELECTION_TRANSLATION_COMPLETE:
                        if (message.content) {
                            popupResultText = message.content;
                            popupInstance.setContent(message.content);
                        }
                        handleSuccess();
                        break;
                    case SELECTION_TRANSLATION_ERROR:
                        handleError(message.message);
                        break;
                    default:
                        break;
                }
            };

            const handlePortDisconnect = () => {
                if (activePortCleanup) {
                    try {
                        activePortCleanup();
                    } catch (listenerError) {
                        console.debug('[LingoTrans] Failed to remove selection translation listeners after disconnect', listenerError);
                    }
                    activePortCleanup = null;
                }

                if (activePort === port) {
                    activePort = null;
                    activeRequestId = null;
                }

                if (translationSettled) {
                    return;
                }

                translationSettled = true;
                popupInstance.setTitle('Translation interrupted');
                popupInstance.setStatus('error', 'Translation was interrupted. Please try again.');
            };

            port.onMessage.addListener(handlePortMessage);
            port.onDisconnect.addListener(handlePortDisconnect);
            activePortCleanup = () => {
                port.onMessage.removeListener(handlePortMessage);
                port.onDisconnect.removeListener(handlePortDisconnect);
            };

            activePort = port;
            activeRequestId = requestId;

            try {
                port.postMessage({
                    type: START_SELECTION_TRANSLATION,
                    requestId,
                    text,
                    targetLanguage
                });
            } catch (error) {
                console.debug('[LingoTrans] Failed to start selection translation via port', error);
                handleError('Unable to start translation. Please check your settings.');
            }
        }

        const handleSettingsUpdate = (next: Settings) => {
            settings = next;
            if (settings.selectionBehavior === 'off') {
                hideButton();
            }
        };

        void loadStoredSettings()
            .then(handleSettingsUpdate)
            .catch((error) => {
                console.debug('[LingoTrans] Failed to load settings in selection script', error);
            });

        const unsubscribeFromStorage = subscribeToStoredSettings(handleSettingsUpdate);

        const unsubscribe = detector.addListener((snapshot: SelectionSnapshot) => {
            if (snapshot.kind !== 'text') {
                selectionState = null;
                hideButton();
                clearHideTimer();
                return;
            }

            if (!snapshot.rect) {
                selectionState = null;
                hideButton();
                return;
            }

            const rect = cloneRect(snapshot.rect);

            const behavior = settings.selectionBehavior;
            if (behavior === 'off') {
                selectionState = null;
                hideButton();
                return;
            }

            selectionState = {
                text: snapshot.text,
                behavior,
                rect
            };

            if (behavior === 'auto-translate') {
                startTranslation(selectionState, 'auto');
                return;
            }

            const button = ensureButton();
            button.setPosition(rect);
            button.show();
        });

        detector.start();

        ctx.onInvalidated(() => {
            unsubscribe();
            detector.dispose();
            hideButton();
            clearHideTimer();
            cancelActiveTranslation();
            unsubscribeFromStorage();
        });
    }
});
