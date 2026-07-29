# PageMind (页知)

> A browser reading companion. Understand any page, ask any question, get instant AI answers.

---

## Overview

PageMind is a Chromium extension that reads the page you're browsing (or the text you've selected) and lets you ask AI about it — summarize, explain, translate, or just ask a question. No need to copy-paste. No need to switch windows.

Built with Manifest V3, pure TypeScript + CSS. Supports any OpenAI-compatible or Anthropic-compatible API.

**Product name:** PageMind  
**Chinese name:** 页知 (Page Understanding)

---

## Features

### Core

- **Page-aware Q&A** — Automatically reads the current page and sends it to the AI as context. Ask anything about what you're viewing.
- **Selection Q&A** — Select text on any page, right-click, and choose "Ask PageMind" to get answers about that specific text.
- **Quick actions** — One-click shortcuts: Summarize, Explain, Translate the current page.

### API & Providers

- **OpenAI-compatible format** — Works with OpenAI, Azure OpenAI, DashScope (Tongyi Qianwen), Ollama, LocalAI, and any service that exposes an OpenAI-compatible `/v1/chat/completions` endpoint.
- **Anthropic-compatible format** — Works with Anthropic Claude, AWS Bedrock, and others that use the Anthropic Messages API format.
- **Custom Base URL** — Point to any custom endpoint.
- **Model discovery** — Fetches available models from the API endpoint; you choose one from a dropdown.

### Security & Privacy

- **API key encryption** — API keys are encrypted with AES-GCM before being stored.
- **Session-only storage** — By default, the API key lives only in `chrome.storage.session` and is cleared when the browser closes. Optionally, you can check "Remember key on this device" to persist it in `chrome.storage.local`.
- **Page content never leaves your control** — Content is sent only to the API you configure, and only when you ask a question.
- **DOM never modified** — Page content is cloned before text extraction; the original page is never touched.

### Language

- **Bilingual UI** — Supports Chinese (default) and English. Switch any time.
- **Extensible i18n** — Code structure supports easy addition of more languages.

### Side Panel

- Persistent side panel — stays open as you browse.
- **Tab-scoped** — Automatically switches context when you change tabs or navigate within a single-page application.
- **SPA navigation detected** — Uses `webNavigation.onHistoryStateUpdated` to catch client-side route changes.

---

## Installation

### Manual install (sideloading, recommended for development)

1. Clone the repository and install dependencies:
   ```bash
   git clone <repo>
   cd page-mind
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

3. Open Chrome and go to `chrome://extensions/`.
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** and select the `dist/` folder.

### Chrome Web Store

*Coming soon.*

---

## Usage

### First-time setup

1. Click the PageMind icon in the toolbar to open the side panel.
2. Click the **Settings** (gear) icon.
3. Select **API Format** (OpenAI-compatible or Anthropic-compatible).
4. Enter the **Base URL** (e.g., `https://api.openai.com/v1`).
5. Enter your **API Key**.
6. Click **Test Connection** to verify.
7. After saving, the model list will be fetched automatically.
8. Select a model from the header dropdown.

### Ask about a page

- Open the side panel. The current page is automatically detected and shown in the preview bar.
- Type your question and press Enter. The AI answers with the page content as context.

### Ask about selected text

1. Select any text on a page.
2. Right-click and choose **Ask PageMind**.
3. The side panel opens; the selected text appears in the preview bar.
4. Type your question and press Enter.

### Quick actions

Click any of the quick-action buttons above the input box:

| Button | Action |
|--------|--------|
| ▤ Summarize | "Summarize the main points of this page." |
| ◎ Explain | "Explain the key concepts in simple terms." |
| 文 Translate | "Translate this page into Chinese." |

### Language toggle

Click the language indicator (中 / EN) in the header to switch between Chinese and English.

---

## Project Structure

```
page-mind/
├── manifest.json              # Chrome Extension Manifest V3
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── copy-assets.js             # Build script: copy non-TS assets
├── jest.config.js
├── src/
│   ├── sidepanel/
│   │   ├── index.html         # Side panel HTML
│   │   ├── styles.css         # Styles
│   │   └── sidepanel.ts       # Controller (self-contained)
│   ├── background/
│   │   └── service-worker.ts  # Background service worker
│   ├── i18n/
│   │   └── index.ts           # i18n definitions
│   ├── utils/
│   │   ├── api.ts             # API communication
│   │   ├── constants.ts       # Constants & defaults
│   │   └── storage.ts         # Storage operations
│   └── types/
│       └── index.ts           # Type definitions
├── assets/
│   └── icons/                 # Extension icons
├── design/                    # Design assets
├── tests/                     # Unit tests
└── scripts/
    └── generate-icons.js      # Icon generation script
```

---

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Adding a new language

1. Add translations to the `translations` object in `src/sidepanel/sidepanel.ts`.
2. Ensure all UI elements reference the translation keys in `updateUILanguage()`.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Extension API | Manifest V3 |
| UI | TypeScript + HTML + CSS (no framework) |
| Encryption | Web Crypto API (AES-GCM) |
| Storage | Chrome Storage API (session + local) |
| Build | TypeScript compiler (`tsc`) |
| Testing | Jest |

---

## License

MIT
