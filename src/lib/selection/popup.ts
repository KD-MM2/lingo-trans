type PopupState = 'idle' | 'loading' | 'success' | 'error';

type PopupCallbacks = {
    onCopy?: () => void;
    onClose?: () => void;
    onPin?: () => void;
    onRetry?: () => void;
};

type PopupGeometry = {
    rect: DOMRect;
};

const VIEWPORT_PADDING = 12;
const OFFSET_BELOW_SELECTION = 10;

export class SelectionPopup {
    private readonly callbacks: PopupCallbacks;
    private readonly host: HTMLDivElement;
    private readonly shadowRoot: ShadowRoot;
    private readonly contentEl: HTMLDivElement;
    private readonly statusEl: HTMLSpanElement;
    private readonly actionsContainer: HTMLDivElement;
    private readonly copyButton: HTMLButtonElement;
    private readonly pinButton: HTMLButtonElement;
    private readonly retryButton: HTMLButtonElement;
    private readonly closeButton: HTMLButtonElement;
    private state: PopupState = 'idle';
    private mounted = false;

    constructor(callbacks: PopupCallbacks = {}) {
        this.callbacks = callbacks;

        this.host = document.createElement('div');
        this.host.style.position = 'absolute';
        this.host.style.top = '0';
        this.host.style.left = '0';
        this.host.style.width = '0';
        this.host.style.height = '0';
        this.host.style.zIndex = '2147483646';
        this.host.style.pointerEvents = 'none';
        this.host.style.opacity = '0';
        this.host.style.transition = 'opacity 160ms ease';

        this.shadowRoot = this.host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            :host,
            * {
                box-sizing: border-box;
            }

            .popup {
                pointer-events: auto;
                min-width: 240px;
                max-width: min(360px, calc(100vw - 32px));
                border-radius: 18px;
                background: rgba(15, 23, 42, 0.96);
                color: #f1f5f9;
                font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
                box-shadow:
                    0 32px 64px rgba(15, 23, 42, 0.28),
                    0 2px 10px rgba(15, 23, 42, 0.18);
                overflow: hidden;
            }

            header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.55rem 0.95rem;
                gap: 0.75rem;
                border-bottom: 1px solid rgba(148, 163, 184, 0.18);
            }

            header h2 {
                margin: 0;
                font-size: 0.82rem;
                font-weight: 600;
                letter-spacing: 0.01em;
                color: #bae6fd;
            }

            header button {
                all: unset;
                cursor: pointer;
                padding: 0;
                color: rgba(226, 232, 240, 0.78);
                font-size: 0.85rem;
                line-height: 1;
                transition: color 160ms ease, transform 160ms ease;
            }

            header button:hover,
            header button:focus-visible {
                color: #f8fafc;
                transform: scale(1.05);
            }

            header button:focus-visible {
                outline: 2px solid rgba(125, 211, 252, 0.9);
                outline-offset: 3px;
            }

            .body {
                padding: 0.85rem 0.95rem 0.75rem;
                display: grid;
                gap: 0.65rem;
            }

            .status {
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
                font-size: 0.75rem;
                color: rgba(226, 232, 240, 0.78);
            }

            .status[data-state='error'] {
                color: #fca5a5;
            }

            .status[data-state='loading']::before {
                content: '';
                width: 0.65rem;
                height: 0.65rem;
                border-radius: 9999px;
                border: 2px solid rgba(125, 211, 252, 0.4);
                border-top-color: rgba(125, 211, 252, 0.96);
                animation: spin 640ms linear infinite;
            }

            .content {
                max-height: 260px;
                overflow-y: auto;
                font-size: 0.82rem;
                line-height: 1.45;
                letter-spacing: 0.01em;
                white-space: pre-wrap;
            }

            .actions {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 0.4rem;
            }

            .actions button {
                all: unset;
                cursor: pointer;
                padding: 0.35rem 0.65rem;
                border-radius: 9999px;
                font-size: 0.72rem;
                font-weight: 600;
                letter-spacing: 0.01em;
                background: rgba(148, 163, 184, 0.16);
                color: rgba(226, 232, 240, 0.85);
                transition: background 160ms ease, color 160ms ease, transform 160ms ease;
            }

            .actions button:hover,
            .actions button:focus-visible {
                background: rgba(148, 163, 184, 0.28);
                color: #f8fafc;
                transform: translateY(-1px);
            }

            .actions button:focus-visible {
                outline: 2px solid rgba(125, 211, 252, 0.9);
                outline-offset: 3px;
            }

            .actions button.primary {
                background: linear-gradient(135deg, #3b82f6, #22d3ee);
                color: #0f172a;
                box-shadow:
                    0 18px 36px rgba(37, 99, 235, 0.25),
                    inset 0 1px 1px rgba(255, 255, 255, 0.18);
            }

            .actions button.primary:hover,
            .actions button.primary:focus-visible {
                background: linear-gradient(135deg, #2563eb, #0ea5e9);
            }

            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `;

        const container = document.createElement('div');
        container.className = 'popup';

        const header = document.createElement('header');
        const title = document.createElement('h2');
        title.textContent = 'Translating…';

        this.closeButton = document.createElement('button');
        this.closeButton.type = 'button';
        this.closeButton.setAttribute('aria-label', 'Close translation popup');
        this.closeButton.textContent = '×';
        this.closeButton.addEventListener('click', () => {
            this.hide();
            this.callbacks.onClose?.();
        });

        header.append(title, this.closeButton);

        const body = document.createElement('div');
        body.className = 'body';

        this.statusEl = document.createElement('span');
        this.statusEl.className = 'status';
        this.statusEl.dataset.state = 'idle';
        this.statusEl.textContent = 'Select text to translate';

        this.contentEl = document.createElement('div');
        this.contentEl.className = 'content';
        this.contentEl.textContent = '';

        this.actionsContainer = document.createElement('div');
        this.actionsContainer.className = 'actions';

        this.copyButton = document.createElement('button');
        this.copyButton.type = 'button';
        this.copyButton.textContent = 'Copy';
        this.copyButton.addEventListener('click', () => {
            this.callbacks.onCopy?.();
        });

        this.pinButton = document.createElement('button');
        this.pinButton.type = 'button';
        this.pinButton.textContent = 'Open panel';
        this.pinButton.classList.add('primary');
        this.pinButton.addEventListener('click', () => {
            this.callbacks.onPin?.();
        });

        this.retryButton = document.createElement('button');
        this.retryButton.type = 'button';
        this.retryButton.textContent = 'Retry';
        this.retryButton.addEventListener('click', () => {
            this.callbacks.onRetry?.();
        });
        this.retryButton.style.display = 'none';

        this.actionsContainer.append(this.retryButton, this.copyButton, this.pinButton);
        body.append(this.statusEl, this.contentEl, this.actionsContainer);
        container.append(header, body);

        this.shadowRoot.append(style, container);

        const handleScroll = () => {
            if (this.mounted) {
                this.hide();
            }
        };

        document.addEventListener('scroll', handleScroll, { capture: true });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.mounted) {
                this.hide();
                this.callbacks.onClose?.();
            }
        });
    }

    mount(): void {
        if (this.mounted) return;
        document.documentElement.append(this.host);
        this.mounted = true;
    }

    unmount(): void {
        if (!this.mounted) return;
        this.host.remove();
        this.mounted = false;
    }

    setTitle(text: string): void {
        const title = this.shadowRoot.querySelector('h2');
        if (title) {
            title.textContent = text;
        }
    }

    setStatus(state: PopupState, message: string): void {
        this.state = state;
        this.statusEl.dataset.state = state;
        this.statusEl.textContent = message;
        this.retryButton.style.display = state === 'error' ? 'inline-flex' : 'none';
    }

    setContent(text: string): void {
        this.contentEl.textContent = text;
    }

    appendContent(chunk: string): void {
        this.contentEl.textContent = `${this.contentEl.textContent ?? ''}${chunk}`;
    }

    clear(): void {
        this.contentEl.textContent = '';
    }

    setPosition({ rect }: PopupGeometry): void {
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        const container = this.shadowRoot.querySelector('.popup') as HTMLElement | null;
        if (!container) return;

        const { width, height } = container.getBoundingClientRect();
        const targetWidth = width || 280;
        const targetHeight = height || 180;

        const idealTop = rect.bottom + scrollY + OFFSET_BELOW_SELECTION;
        const idealLeft = rect.left + scrollX + rect.width / 2 - targetWidth / 2;

        const top = Math.max(scrollY + VIEWPORT_PADDING, Math.min(idealTop, scrollY + window.innerHeight - targetHeight - VIEWPORT_PADDING));
        const left = Math.max(scrollX + VIEWPORT_PADDING, Math.min(idealLeft, scrollX + window.innerWidth - targetWidth - VIEWPORT_PADDING));

        this.host.style.transform = `translate(${left}px, ${top}px)`;
    }

    show(): void {
        if (!this.mounted) {
            this.mount();
        }
        this.host.style.opacity = '1';
    }

    hide(): void {
        this.host.style.opacity = '0';
    }

    isVisible(): boolean {
        return this.host.style.opacity === '1';
    }

    getState(): PopupState {
        return this.state;
    }
}
