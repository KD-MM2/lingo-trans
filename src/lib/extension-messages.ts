export const OPEN_SIDE_PANEL_MESSAGE = 'openSidePanel' as const;

export const SELECTION_TRANSLATION_PORT = 'lingotrans:selection-translation' as const;
export const START_SELECTION_TRANSLATION = 'selection:translate:start' as const;
export const CANCEL_SELECTION_TRANSLATION = 'selection:translate:cancel' as const;
export const SELECTION_TRANSLATION_CHUNK = 'selection:translate:chunk' as const;
export const SELECTION_TRANSLATION_COMPLETE = 'selection:translate:complete' as const;
export const SELECTION_TRANSLATION_ERROR = 'selection:translate:error' as const;

export type ExtensionMessage = {
    type: typeof OPEN_SIDE_PANEL_MESSAGE;
    /**
     * Optional tab override when triggering the side panel from privileged contexts.
     */
    tabId?: number;
    /**
     * Optional payload that can be forwarded to the side panel once it is opened.
     */
    payload?: string;
};

export type SelectionTranslationStart = {
    type: typeof START_SELECTION_TRANSLATION;
    requestId: string;
    text: string;
    targetLanguage: string;
};

export type SelectionTranslationCancel = {
    type: typeof CANCEL_SELECTION_TRANSLATION;
    requestId: string;
};

export type SelectionTranslationPortRequest = SelectionTranslationStart | SelectionTranslationCancel;

export type SelectionTranslationChunk = {
    type: typeof SELECTION_TRANSLATION_CHUNK;
    requestId: string;
    content?: string;
    done?: boolean;
    error?: string;
};

export type SelectionTranslationComplete = {
    type: typeof SELECTION_TRANSLATION_COMPLETE;
    requestId: string;
    content?: string;
};

export type SelectionTranslationError = {
    type: typeof SELECTION_TRANSLATION_ERROR;
    requestId: string;
    message: string;
};

export type SelectionTranslationPortResponse = SelectionTranslationChunk | SelectionTranslationComplete | SelectionTranslationError;

export function isOpenSidePanelMessage(message: unknown): message is Extract<ExtensionMessage, { type: typeof OPEN_SIDE_PANEL_MESSAGE }> {
    return typeof message === 'object' && message !== null && 'type' in message && (message as { type?: unknown }).type === OPEN_SIDE_PANEL_MESSAGE;
}
