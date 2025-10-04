import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    manifest: {
        name: 'LingoTrans',
        version: '0.1.0',
        description: 'Translate, rewrite, and manage templates directly from a side panel.',
        permissions: ['storage', 'activeTab', 'scripting', 'contextMenus', 'clipboardWrite'],
        host_permissions: ['<all_urls>'],
        side_panel: {
            default_path: 'sidepanel.html'
        }
    },
    vite: () => ({
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                '@src': path.resolve(rootDir, 'src')
            }
        }
    })
});
