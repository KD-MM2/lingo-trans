export const OPEN_SIDE_PANEL_MESSAGE = 'openSidePanel' as const;

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

export function isOpenSidePanelMessage(message: unknown): message is Extract<ExtensionMessage, { type: typeof OPEN_SIDE_PANEL_MESSAGE }> {
    return typeof message === 'object' && message !== null && 'type' in message && (message as { type?: unknown }).type === OPEN_SIDE_PANEL_MESSAGE;
}
