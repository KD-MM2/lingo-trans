import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: ['class'],
    content: ['./entrypoints/**/*.{ts,tsx,html}', './components/**/*.{ts,tsx}', './src/**/*.{ts,tsx,html}'],
    theme: {
        extend: {}
    },
    plugins: []
};

export default config;
