export type SelectionKind = 'none' | 'text';

export type SelectionSnapshot = {
    kind: SelectionKind;
    text: string;
    range?: Range;
    rect?: DOMRect;
};

export type SelectionListener = (snapshot: SelectionSnapshot) => void;

export type SelectionDetectorOptions = {
    minLength?: number;
    maxLength?: number;
    debounceMs?: number;
};

const DEFAULT_OPTIONS: Required<SelectionDetectorOptions> = {
    minLength: 1,
    maxLength: 5000,
    debounceMs: 120
};

const isFocusableElement = (element: Element | null) => {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || element.hasAttribute('contenteditable');
};

const isValidRect = (rect: DOMRect | undefined): rect is DOMRect => {
    if (!rect) return false;
    return Number.isFinite(rect.top) && Number.isFinite(rect.left) && rect.width >= 0 && rect.height >= 0;
};

export class SelectionDetector {
    private readonly options: Required<SelectionDetectorOptions>;
    private readonly listeners = new Set<SelectionListener>();
    private readonly handlePointerUp: () => void;
    private readonly handleKeyUp: (event: KeyboardEvent) => void;
    private readonly handleSelectionChange: () => void;
    private rafId: number | null = null;
    private disposed = false;

    constructor(options?: SelectionDetectorOptions) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.handlePointerUp = () => this.scheduleEvaluate();
        this.handleKeyUp = (event) => {
            if (event.key === 'Escape') {
                this.notifyListeners({ kind: 'none', text: '' });
                return;
            }
            this.scheduleEvaluate();
        };
        this.handleSelectionChange = () => this.scheduleEvaluate();
    }

    start(): void {
        if (this.disposed) return;
        window.addEventListener('pointerup', this.handlePointerUp, true);
        window.addEventListener('keyup', this.handleKeyUp, true);
        document.addEventListener('selectionchange', this.handleSelectionChange, true);
        this.scheduleEvaluate();
    }

    stop(): void {
        window.removeEventListener('pointerup', this.handlePointerUp, true);
        window.removeEventListener('keyup', this.handleKeyUp, true);
        document.removeEventListener('selectionchange', this.handleSelectionChange, true);
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.stop();
        this.listeners.clear();
    }

    addListener(listener: SelectionListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private scheduleEvaluate(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
        }
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.evaluateSelection();
        });
    }

    private evaluateSelection(): void {
        if (this.disposed) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            this.notifyListeners({ kind: 'none', text: '' });
            return;
        }

        const range = selection.getRangeAt(0);
        if (!range || selection.isCollapsed) {
            this.notifyListeners({ kind: 'none', text: '' });
            return;
        }

        const startContainer = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
        if (isFocusableElement(startContainer)) {
            this.notifyListeners({ kind: 'none', text: '' });
            return;
        }

        const text = selection.toString().trim();
        const textLength = text.length;

        if (textLength < this.options.minLength || textLength > this.options.maxLength) {
            this.notifyListeners({ kind: 'none', text: '' });
            return;
        }

        const rect = range.getBoundingClientRect();
        if (!isValidRect(rect) || (rect.width === 0 && rect.height === 0)) {
            this.notifyListeners({ kind: 'none', text: '' });
            return;
        }

        this.notifyListeners({
            kind: 'text',
            text,
            range,
            rect
        });
    }

    private notifyListeners(snapshot: SelectionSnapshot): void {
        this.listeners.forEach((listener) => {
            try {
                listener(snapshot);
            } catch (error) {
                console.warn('[LingoTrans] Selection listener failed', error);
            }
        });
    }
}
