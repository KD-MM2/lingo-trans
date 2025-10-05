import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { OPEN_SIDE_PANEL_MESSAGE } from '@src/lib/extension-messages';

const HOST_ID = 'lingotrans-sidepanel-fab-host';

const shouldSkipInjection = () => {
    if (window.top !== window.self) {
        return true;
    }

    if (!document.documentElement) {
        return true;
    }

    const url = window.location.href;
    if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('moz-extension://')) {
        return true;
    }

    if (document.contentType === 'application/pdf') {
        return true;
    }

    return false;
};

const openSidePanel = async () => {
    try {
        await browser.runtime.sendMessage({ type: OPEN_SIDE_PANEL_MESSAGE });
    } catch (error) {
        console.debug('[LingoTrans] Failed to request side panel open from content script', error);
    }
};

const EDGE_OFFSET = 16;
const DRAG_THRESHOLD_PX = 4;

type HorizontalSide = 'left' | 'right';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const computeTopBounds = (elementHeight: number) => {
    const min = EDGE_OFFSET;
    const max = Math.max(EDGE_OFFSET, window.innerHeight - elementHeight - EDGE_OFFSET);
    return { min, max };
};

const computeLeftBounds = (elementWidth: number) => {
    const min = 0;
    const max = Math.max(0, window.innerWidth - elementWidth);
    return { min, max };
};

const createFloatingButton = () => {
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.position = 'fixed';
    host.style.top = '50%';
    host.style.left = 'auto';
    host.style.right = '0';
    host.style.transform = 'translateY(-50%)';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'none';
    host.style.maxWidth = '100vw';
    const transitionValue = 'top 320ms cubic-bezier(0.33, 1, 0.68, 1), left 320ms cubic-bezier(0.33, 1, 0.68, 1), right 320ms cubic-bezier(0.33, 1, 0.68, 1), transform 320ms cubic-bezier(0.33, 1, 0.68, 1)';
    host.style.transition = transitionValue;

    const shadowRoot = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host,
        * {
            box-sizing: border-box;
        }

        button {
            all: unset;
            pointer-events: auto;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 2.0rem;
            height: 2.0rem;
            border-radius: 9999px;
            background: radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.15), rgba(15, 23, 42, 0.94));
            color: #f8fafc;
            font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
            font-size: 0.95rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            box-shadow:
                0 18px 36px rgba(15, 23, 42, 0.32),
                inset 0 1px 1px rgba(255, 255, 255, 0.18);
            transition:
                transform 320ms cubic-bezier(0.33, 1, 0.68, 1),
                box-shadow 320ms ease,
                background 320ms ease,
                filter 320ms ease;
        }

        button:hover,
        button:focus-visible {
            background: linear-gradient(135deg, #3b82f6, #22d3ee);
            box-shadow:
                0 22px 46px rgba(37, 99, 235, 0.33),
                inset 0 1px 2px rgba(255, 255, 255, 0.22);
        }

        button[data-side='right']:hover,
        button[data-side='right']:focus-visible {
            transform: translate(-6px, -2px) scale(1.05);
        }

        button[data-side='left']:hover,
        button[data-side='left']:focus-visible {
            transform: translate(6px, -2px) scale(1.05);
        }

        button:focus-visible {
            outline: 2px solid rgba(125, 211, 252, 0.9);
            outline-offset: 4px;
        }

        .icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 90%;
            height: 90%;
            border-radius: 9999px;
            background: linear-gradient(145deg, #60a5fa, #22d3ee);
            box-shadow:
                inset 0 1px 2px rgba(255, 255, 255, 0.28),
                0 8px 18px rgba(34, 211, 238, 0.28);
            color: inherit;
            transition: transform 320ms cubic-bezier(0.33, 1, 0.68, 1);
        }

        button:hover .icon,
        button:focus-visible .icon {
            transform: scale(1.06);
        }

        .icon span {
            font-size: 1rem;
            font-weight: 700;
            letter-spacing: 0.04em;
        }

        @media (prefers-reduced-motion: reduce) {
            button,
            .icon {
                transition: none;
            }
        }
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Toggle LingoTrans side panel';
    button.setAttribute('aria-label', 'Toggle LingoTrans side panel');

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.setAttribute('aria-hidden', 'true');

    const iconGlyph = document.createElement('span');
    iconGlyph.textContent = 'LT';
    icon.append(iconGlyph);

    button.append(icon);

    let currentSide: HorizontalSide = 'right';
    let isDragging = false;
    let dragStart: { x: number; y: number } | null = null;
    let startRect: DOMRect | null = null;
    let exceededThreshold = false;
    let suppressNextClick = false;
    let lastPointerClientX = window.innerWidth;

    const updateButtonSide = (side: HorizontalSide) => {
        button.dataset.side = side;
    };

    const stickToSide = (side: HorizontalSide) => {
        const rect = host.getBoundingClientRect();
        const { min: minTop, max: maxTop } = computeTopBounds(rect.height);
        const nextTop = clamp(rect.top, minTop, maxTop);
        host.style.transform = 'translateY(0)';
        host.style.top = `${nextTop}px`;
        if (side === 'left') {
            host.style.left = '0';
            host.style.right = 'auto';
        } else {
            host.style.left = 'auto';
            host.style.right = '0';
        }

        currentSide = side;
        updateButtonSide(side);
    };

    const handleActivation = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        void openSidePanel();
    };

    const handlePointerDown = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }

        event.preventDefault();
        isDragging = true;
        exceededThreshold = false;
        dragStart = { x: event.clientX, y: event.clientY };
        startRect = host.getBoundingClientRect();
        lastPointerClientX = event.clientX;
        host.style.transition = 'none';
        host.style.pointerEvents = 'auto';
        host.style.transform = 'translateY(0)';
        host.style.top = `${startRect.top}px`;
        host.style.left = `${startRect.left}px`;
        host.style.right = 'auto';
        button.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
        if (!isDragging || !dragStart || !startRect) {
            return;
        }

        const deltaX = event.clientX - dragStart.x;
        const deltaY = event.clientY - dragStart.y;

        lastPointerClientX = event.clientX;

        if (!exceededThreshold && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD_PX) {
            exceededThreshold = true;
        }

        const { min: minTop, max: maxTop } = computeTopBounds(startRect.height);
        const { min: minLeft, max: maxLeft } = computeLeftBounds(startRect.width);

        const nextTop = clamp(startRect.top + deltaY, minTop, maxTop);
        const nextLeft = clamp(startRect.left + deltaX, minLeft, maxLeft);

        host.style.top = `${nextTop}px`;
        host.style.left = `${nextLeft}px`;
    };

    const finishDrag = (event: PointerEvent) => {
        if (!isDragging) {
            return;
        }

        isDragging = false;
        if (button.hasPointerCapture(event.pointerId)) {
            button.releasePointerCapture(event.pointerId);
        }
        host.style.transition = transitionValue;
        host.style.pointerEvents = 'none';

        const pointerX = event.type === 'lostpointercapture' ? lastPointerClientX : event.clientX;
        const preferredSide: HorizontalSide = pointerX < window.innerWidth / 2 ? 'left' : 'right';
        stickToSide(preferredSide);

        if (exceededThreshold) {
            suppressNextClick = true;
        }

        exceededThreshold = false;
        dragStart = null;
        startRect = null;
        lastPointerClientX = pointerX;
    };

    button.addEventListener('pointerdown', handlePointerDown);
    button.addEventListener('pointermove', handlePointerMove);
    button.addEventListener('pointerup', finishDrag);
    button.addEventListener('pointercancel', finishDrag);
    button.addEventListener('lostpointercapture', finishDrag);

    button.addEventListener(
        'click',
        (event) => {
            if (suppressNextClick) {
                suppressNextClick = false;
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            handleActivation(event);
        },
        { passive: false }
    );

    button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            handleActivation(event);
        }
    });

    shadowRoot.append(style, button);
    updateButtonSide(currentSide);
    return host;
};

export default defineContentScript({
    matches: ['<all_urls>'],
    allFrames: false,
    runAt: 'document_idle',
    main(ctx) {
        if (shouldSkipInjection()) {
            return;
        }

        const mount = () => {
            if (document.getElementById(HOST_ID)) {
                return;
            }

            const host = createFloatingButton();
            document.documentElement?.append(host);

            ctx.onInvalidated(() => {
                host.remove();
            });

            const observer = new MutationObserver(() => {
                if (document.getElementById(HOST_ID)) {
                    return;
                }

                document.documentElement?.append(host);
            });

            observer.observe(document.documentElement ?? document, {
                childList: true,
                subtree: true
            });

            ctx.onInvalidated(() => {
                observer.disconnect();
            });
        };

        if (document.readyState === 'loading') {
            ctx.addEventListener(document, 'DOMContentLoaded', mount, { once: true });
        } else {
            mount();
        }
    }
});
