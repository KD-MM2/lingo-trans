# LingoTrans Browser Extension

LingoTrans ships as a Chrome side-panel extension built with React, WXT, and Tailwind CSS. Launch the side panel to translate, rewrite, and manage templates without leaving the current page.

## Getting Started

```bash
pnpm install
pnpm dev
```

1. Run `pnpm dev` to start WXT in development mode.
2. Visit `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the `.output/chrome-mv3` directory that WXT creates.
4. Open the Chrome side panel and pick **LingoTrans**.

## Building for Release

```bash
pnpm build
pnpm zip # optional: produces an upload-ready archive in ./dist
```

The production build is written to `.output/<browser>-mv3`. Use `pnpm zip` to generate a distributable archive for upload to extension stores.

## Scripts

- `pnpm dev` – Start the extension in watch mode with hot reloading.
- `pnpm build` – Type-check and produce a production build.
- `pnpm preview` – Preview the packaged extension in a local browser window.
- `pnpm zip` – Bundle the latest build into a ZIP archive.
- `pnpm lint` – Run ESLint across the project.
- `pnpm format` – Format source files with Prettier.

## Project Structure

- `entrypoints/sidepanel/` – WXT entrypoint that mounts the React application.
- `src/` – Shared React components, pages, contexts, and styles.
- `wxt.config.ts` – Extension manifest definition and Vite configuration.

## Troubleshooting

- If Chrome fails to load the extension, verify that `pnpm dev` or `pnpm build` completed without errors and that you selected the correct `.output/...` folder.
- When updating Tailwind classes, restart `pnpm dev` if new glob patterns are required.
