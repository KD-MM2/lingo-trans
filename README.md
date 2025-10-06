# LingoTrans

> Translate web content instantly with a streaming side panel, prompt templates, and OpenAI-compatible providers.

## Overview

LingoTrans is a Chrome/Edge extension built with [WXT](https://wxt.dev/), React 19, and Tailwind CSS. It lets you translate or rewrite any selected text, manage reusable prompt templates, and even replace the text on an entire page—all without leaving the site you are viewing. Translation runs through OpenAI-compatible APIs, and the extension stores configuration locally so your API keys never leave the browser.

## Feature highlights

### Translate as you read
- Highlight text to reveal a draggable "Translate" bubble; start a translation with one click.
- Optional auto-translate mode that begins streaming results as soon as text is selected.
- Compact popup shows tokens in real time with copy, retry, and pin-to-side-panel actions.

### Full rewrite & template workflows
- Side panel tabs for **Translate**, **Rewrite**, and **Templates** with a responsive React UI.
- Rewrite mode supports tone control (neutral, formal, casual, concise) and 5 000-character inputs.
- Template manager stores reusable prompt snippets, with search, tagging, import/export, and duplication.

### Page-wide translation
- Context menu entry to translate the whole page inline while preserving inline HTML markup.
- Overlay banner tracks progress, surfaces errors, and allows undo by refreshing.

### Provider flexibility
- Works with OpenAI, Anthropic Claude (via OpenAI-compatible proxy), or any self-hosted OpenAI-style endpoint.
- Fetch model lists, run credential health checks, and add custom headers directly from the Settings tab.

### Quality-of-life touches
- Streaming pipeline keeps results flowing to the UI; background service worker handles chunking and retries.
- Floating side-panel button pins to either edge of the viewport and reappears across navigation.
- Context menu shortcuts for translating selections or the entire page in the side panel.
- All settings, templates, and API keys persist in `browser.storage.local`; nothing leaves the device.

## Architecture at a glance

```
entrypoints/
  background/          Service worker: ports, context menus, side-panel orchestration
  sidepanel/           React entrypoint rendered via Vite/WXT
  sidepanel-fab.*      Content script for the floating "LT" button
  text-selection.*     Selection detector, popup UI, page translation overlay
src/
  pages/               React routes (Translation, Rewriting, Templates, Settings, About)
  lib/api/             Provider routing, streaming client, health check + model listing
  lib/translation/     DOM block collection, placeholder tokenizer, undo helpers
  lib/selection/       Selection detector + popup implementation
  hooks/               Settings/templates state synced to storage
  components/          Shadcn-inspired UI kit wrapped for Tailwind 4
```

The extension is packaged with WXT, which generates the MV3 manifest, bundles background/service worker code, and emits browser-specific builds under `dist/`.

## Getting started

### Prerequisites
- Node.js 18 or newer (aligns with WXT requirements)
- [pnpm](https://pnpm.io/) 8+
- Chrome, Edge, or any Chromium-based browser with side panel support

### Install dependencies
```pwsh
pnpm install
```

### Start the development build
```pwsh
pnpm dev
```
1. The command compiles the project and watches for changes.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the generated `.output/chrome-mv3` folder. Chrome reloads automatically on subsequent builds.

### Build for release
```pwsh
pnpm build
```
- Outputs production bundles to `dist/<browser>` (for Chrome this is `dist/chrome-mv3`).
- To generate a distributable archive for the Chrome Web Store:

```pwsh
pnpm zip
```

### Additional scripts

| Command        | Purpose                                  |
|----------------|------------------------------------------|
| `pnpm lint`    | Run ESLint across the project            |
| `pnpm preview` | Serve the built extension for inspection |
| `pnpm format`  | Format JS/TS/TSX/HTML/CSS via Prettier   |

## Using the extension

### Side panel workspace
- Click the toolbar icon or the floating **LT** button to open the side panel.
- **Translate tab**: paste or type text, pick the target language, and stream results directly into the output card.
- **Rewrite tab**: rewrite content in a new language and tone; copy results with a single click.
- **Templates tab**: craft reusable prompt blocks. Import/export JSON files to share presets with teammates.
- **Settings tab**: configure providers, default target language, selection behaviour, popup timeout, and custom headers.

### Quick translate popup
- Choose how highlight-to-translate behaves under **Settings → On text selection**:
  - *Show floating icon*: display a pill-shaped action near the selection (default).
  - *Auto translate*: immediately stream the result without extra clicks.
  - *Do nothing*: disables the popup for keyboard-first workflows.
- Results remain visible for a configurable timeout (up to five minutes) and can be pinned into the side panel.

### Full-page translation
1. Right-click any page and select **Translate page**.
2. Blocks of text are tokenised so inline tags (links, emphasis, code, etc.) survive the translation.
3. If anything fails, the overlay reports the error and the extension restores the original HTML.

### Provider configuration tips
- **OpenAI**: supply a standard API key; the manifest assumes the default `https://api.openai.com/v1` base URL.
- **Claude**: connect through an OpenAI-compatible proxy (e.g. Fireworks, OpenRouter) until a native Claude client lands.
- **Self-hosted**: point to any OpenAI-compatible endpoint (Ollama with `openai` plugin, vLLM, OpenRouter, etc.) and add custom headers if necessary.
- The **Fetch models** button populates the dropdown; health checks verify credentials and endpoint connectivity.

## Development notes

- Settings are validated and sanitised before persistence (see `src/lib/settings.ts`). Invalid custom headers are surfaced inline.
- Background translations run through a single streaming channel (`SELECTION_TRANSLATION_PORT`), which feeds both popup and side panel UIs.
- DOM translation helpers in `src/lib/translation` generate placeholder tokens so providers can return translated strings without breaking HTML structure.
- Component styling relies on Tailwind CSS v4 with utility classes consolidated via `class-variance-authority` and `tailwind-merge`.

## Roadmap
- ✅ Highlight-to-translate, side panel workflows, template management, streaming pipeline, context menus.
- 🔜 Native Claude responses API support, translation memory/cache, keyboard shortcuts, side-by-side full-page mode.
- 🧭 Longer term: glossary enforcement UI, encrypted key vault, SPA mutation observers, advanced batching controls.

## Troubleshooting
- **Nothing happens on translate** – Double-check that a model is selected in **Settings** and the matching API key is stored; the health check will reveal credential issues.
- **Context menu items missing** – Reload the extension from `chrome://extensions` or re-run `pnpm dev` to refresh the background service worker.
- **Streaming stops mid-way** – The background retries on the next request, but you can pin the translation to the side panel and retry from there.

---

Maintained with ❤️ for multilingual browsing. Contributions, bug reports, and ideas are very welcome.