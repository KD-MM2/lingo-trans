import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import App from './app';

export const renderApp = (element?: HTMLElement | null): Root => {
    const mountNode = element ?? document.getElementById('root');

    if (!mountNode) {
        throw new Error('Failed to find the root element');
    }

    const root = createRoot(mountNode);

    root.render(
        <StrictMode>
            <App />
        </StrictMode>
    );

    return root;
};
