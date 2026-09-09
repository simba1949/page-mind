import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Static regression tests for things a node test environment cannot render:
// theme rules (this round's light-theme color harmonization), the MV3
// permission surface, and composer markup hygiene. These read the source
// files directly so a reverted selector or a widened permission fails CI.

const root = join(__dirname, '..');
const css = readFileSync(join(root, 'src', 'sidepanel', 'styles.css'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const constantsTs = readFileSync(join(root, 'src', 'utils', 'constants.ts'), 'utf8');
const html = readFileSync(join(root, 'src', 'sidepanel', 'index.html'), 'utf8');
const sidepanelTs = readFileSync(join(root, 'src', 'sidepanel', 'sidepanel.ts'), 'utf8');

/** The first CSS rule block containing `selector`, braces included. */
const ruleBlock = (source: string, selector: string): string => {
  const at = source.indexOf(selector);
  if (at === -1) return '';
  const end = source.indexOf('}', at);
  return source.slice(at, end + 1);
};

describe('styles.css: light theme keeps a single accent family', () => {
  test('supports reduced-motion preferences and theme-aware errors', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('--error-text');
    expect(css).toContain('color: var(--error-text)');
  });
  test('the light send button only lights up when enabled', () => {
    // The specificity fix from this round: the light-theme override used to
    // outrank .send-btn:disabled, leaving a bright blue idle button.
    expect(css).toContain(':root[data-theme="light"] .send-btn:not(:disabled)');
    expect(css).not.toContain(':root[data-theme="light"] .send-btn {');
    expect(css).not.toContain(':root[data-theme="light"] .send-btn{');
  });

  test('attach and send buttons share the same footprint', () => {
    const attach = ruleBlock(css, '.attach-btn {');
    const send = ruleBlock(css, '.send-btn {');
    expect(attach).toContain('width: 48px');
    expect(send).toContain('width: 48px');
    expect(attach).toContain('border-radius: var(--radius-md)');
    expect(send).toContain('border-radius: var(--radius-md)');
  });

  test('quick action icons use the blue family, not the warm accent', () => {
    const icon = ruleBlock(css, '.quick-action-icon {');
    expect(icon).toContain('var(--accent-blue-light)');
    expect(icon).toContain('var(--accent-blue)');
    expect(icon).not.toContain('accent-warm');

    const hover = ruleBlock(css, '.quick-action:hover .quick-action-icon {');
    expect(hover).toContain('var(--accent-blue)');
    expect(hover).not.toContain('accent-warm');
  });

  test('the welcome icon is a blue tint, not amber', () => {
    const icon = ruleBlock(css, '.welcome-icon {');
    expect(icon).toContain('var(--accent-blue-light)');
    expect(icon).not.toContain('accent-warm');
  });
});

describe('sidepanel.ts: explicit light/dark theme contract', () => {
  test('does not react to the operating system color scheme', () => {
    expect(sidepanelTs).toContain("theme: stored.theme === 'dark' ? 'dark' : 'light'");
    expect(sidepanelTs).not.toContain('matchMedia');
  });
});

describe('manifest.json: least-privilege permission surface', () => {
  test('uses the 0.1.3 storage/module contract', () => {
    expect(manifest.version).toBe('0.1.3');
    expect(packageJson.version).toBe('0.1.3');
  });

  test('requests exactly the expected permissions', () => {
    expect([...manifest.permissions].sort()).toEqual([
      'activeTab', 'contextMenus', 'scripting', 'sidePanel',
      'storage', 'webNavigation'
    ].sort());
  });

  test('requires host access only for configured inference endpoints', () => {
    expect(manifest.host_permissions).toEqual([
      'https://api.openai.com/*',
      'https://api.anthropic.com/*'
    ]);
    expect(manifest.host_permissions).not.toContain('<all_urls>');
  });

  test('broad site access stays opt-in via optional permissions', () => {
    expect(manifest.optional_host_permissions).toContain('https://*/*');
  });
});

describe('sidepanel.ts: startup context capture', () => {
  const ts = readFileSync(join(root, 'src', 'sidepanel', 'sidepanel.ts'), 'utf8');

  test('first open prefers the user selection, later restores do not', () => {
    // Bug this pins: opening the panel after selecting text used to show the
    // full page instead of the selection. Startup must pass preferSelection;
    // the dismiss/quote-cancel restore paths must NOT (a stale selection
    // would resurrect a reference the user removed).
    expect(ts).toContain('await this.autoFetchCurrentPage(true);');
    const bareCalls = ts.match(/this\.autoFetchCurrentPage\(\)/g) ?? [];
    expect(bareCalls.length).toBeGreaterThanOrEqual(4);
  });

  test('the startup selection probe has its own failure guard', () => {
    // A rejected GET_SELECTION must not skip the full-page fallback below it.
    const at = ts.indexOf('private async autoFetchCurrentPage');
    expect(at).toBeGreaterThan(-1);
    const body = ts.slice(at, ts.indexOf('\n  /**', at));
    expect(body).toContain('context = await this.getCurrentSelectionContext(activeTabUrl);');

    const selectionAt = ts.indexOf('private async getCurrentSelectionContext');
    const selectionBody = ts.slice(selectionAt, ts.indexOf('\n  /**', selectionAt));
    expect(selectionBody).toContain("type: 'GET_SELECTION'");
    expect(selectionBody).toMatch(/try \{[\s\S]*?const response[\s\S]*?\} catch \{/);
  });

  test('skips context and authorization on non-web tabs', () => {
    const fetchStart = ts.indexOf('private async autoFetchCurrentPage');
    const autoBody = ts.slice(fetchStart, ts.indexOf('\n  /**', fetchStart));
    const selectionProbe = autoBody.indexOf('this.getCurrentSelectionContext(activeTabUrl)');
    const webPageGuard = autoBody.indexOf('if (activeTabUrl && !isWebPageUrl(activeTabUrl))');
    expect(webPageGuard).toBeGreaterThan(-1);
    expect(webPageGuard).toBeLessThan(selectionProbe);

    const sendFetchStart = ts.indexOf('private async fetchCurrentPageContext');
    const permissionRequest = ts.indexOf('ensurePageAccessPermission(true)', sendFetchStart);
    const sendWebPageGuard = ts.indexOf('if (activeTabUrl && !isWebPageUrl(activeTabUrl))', sendFetchStart);
    expect(sendWebPageGuard).toBeGreaterThan(sendFetchStart);
    expect(sendWebPageGuard).toBeLessThan(permissionRequest);
  });

  test('does not reject a page solely because Chrome hides its tab URL', () => {
    const fetchStart = ts.indexOf('private async autoFetchCurrentPage');
    const urlRead = ts.indexOf('activeTabUrl = await currentActiveTabUrl();', fetchStart);
    const capture = ts.indexOf("type: 'GET_PAGE_CONTENT'", fetchStart);
    expect(urlRead).toBeGreaterThan(fetchStart);
    expect(capture).toBeGreaterThan(urlRead);
    expect(ts.slice(urlRead, capture)).toContain('activeTabUrl && !isWebPageUrl(activeTabUrl)');

    const sendFetchStart = ts.indexOf('private async fetchCurrentPageContext');
    const sendPermission = ts.indexOf('ensurePageAccessPermission(true)', sendFetchStart);
    const sendWebPageGuard = ts.indexOf('if (activeTabUrl && !isWebPageUrl(activeTabUrl))', sendFetchStart);
    expect(sendWebPageGuard).toBeGreaterThan(sendFetchStart);
    expect(sendWebPageGuard).toBeLessThan(sendPermission);
    expect(ts.slice(sendFetchStart)).toContain(
      'const selectionContext = await this.getCurrentSelectionContext(activeTabUrl);'
    );
  });

  test('does not render a tab preview when the tab URL is not a web page', () => {
    const tabChanged = ts.indexOf("message.type === 'TAB_CHANGED'");
    const preview = ts.indexOf('this.showPagePreviewBar', tabChanged);
    const webPageGuard = ts.indexOf('isWebPageUrl(message.url)', tabChanged);
    expect(webPageGuard).toBeGreaterThan(tabChanged);
    expect(webPageGuard).toBeLessThan(preview);
  });

  test('does not restore a stored selection on a non-matching tab', () => {
    const pendingStart = ts.indexOf('private async checkPendingContext');
    const pendingBody = ts.slice(pendingStart, ts.indexOf('\n  /**', pendingStart));
    const pendingGuard = pendingBody.indexOf('isWebPageUrl(activeTabUrl)');
    const pendingAssignment = pendingBody.indexOf('this.currentContext = pendingContext');
    expect(pendingGuard).toBeGreaterThan(-1);
    expect(pendingGuard).toBeLessThan(pendingAssignment);

    const menuStart = ts.indexOf('private async handleContextFromMenu');
    const menuBody = ts.slice(menuStart, ts.indexOf('\n  /**', menuStart));
    const menuGuard = menuBody.indexOf('isWebPageUrl(activeTabUrl)');
    const menuAssignment = menuBody.indexOf('this.currentContext = context');
    expect(menuGuard).toBeGreaterThan(-1);
    expect(menuGuard).toBeLessThan(menuAssignment);
  });
});

describe('background extraction: nested document and selection handling', () => {
  const backgroundSource = readFileSync(join(root, 'src', 'background', 'service-worker.ts'), 'utf8');

  test('injects into every accessible frame and prefers editor/document roots', () => {
    const pageStart = backgroundSource.indexOf('private async getPageContent');
    const selectionStart = backgroundSource.indexOf('private async getSelectionContent');
    const pageBody = backgroundSource.slice(pageStart, selectionStart);

    expect(pageBody).toContain('allFrames: true');
    expect(pageBody).toContain('[contenteditable="true"]');
    expect(pageBody).toContain('.ProseMirror');
    expect(pageBody).toContain('.ql-editor');
    expect(pageBody).toContain('.tiptap');
    expect(pageBody).toContain('#layout_body');
    expect(pageBody).toContain('textContent');
    expect(pageBody).toContain('isTopFrame');
    expect(pageBody).toContain('url: tab.url || url');
    expect(backgroundSource).toContain('function selectBestPageFrame');
    expect(backgroundSource).toContain('sameOriginFrames');
    expect(backgroundSource).toContain('originOf(frame.url) === activeOrigin');
    expect(pageBody).toContain('.outline');
    expect(pageBody).toContain('[class*="toc"]');
    expect(backgroundSource).toContain('.sort((left, right)');
  });

  test('reads selected text from every accessible frame and ignores empty results', () => {
    const selectionStart = backgroundSource.indexOf('private async getSelectionContent');
    const body = backgroundSource.slice(selectionStart);

    expect(body).toContain('allFrames: true');
    expect(body).toContain('window.getSelection()');
    expect(body).toContain('url: tab.url || url');
    expect(body).toContain("type: 'selection'");
    const validationStart = backgroundSource.indexOf('function isPageFrameResult');
    expect(backgroundSource.slice(validationStart, selectionStart)).toContain('content.trim().length > 0');
  });
});

describe('sidepanel capture failure state and accessibility contract', () => {
  const panel = readFileSync(join(root, 'src', 'sidepanel', 'sidepanel.ts'), 'utf8');
  const htmlSource = readFileSync(join(root, 'src', 'sidepanel', 'index.html'), 'utf8');
  const cssSource = readFileSync(join(root, 'src', 'sidepanel', 'styles.css'), 'utf8');

  test('clears stale context and offers a retry after capture failure', () => {
    expect(panel).toContain('private showCaptureUnavailableBar(): void');
    expect(panel).toContain("this.previewLabel.textContent = I18nService.t('context.unavailable');");
    expect(panel).toContain("retryBtn.setAttribute('aria-label', I18nService.t('btn.retryCapture'))");
    expect(panel).toContain('this.clearPageContext();');
    expect(panel).toContain("this.previewBar.className = 'preview-bar unavailable';");
  });

  test('keeps the unavailable state readable in a narrow side panel', () => {
    expect(htmlSource).toContain('id="preview-bar" class="preview-bar page hidden" role="status" aria-live="polite"');
    expect(cssSource).toContain('.preview-bar.unavailable');
    expect(cssSource).toContain('text-overflow: ellipsis');
  });
});

describe('context-menu handoff: storage is the reliable channel', () => {
  const backgroundSource = readFileSync(join(root, 'src', 'background', 'service-worker.ts'), 'utf8');
  const panel = readFileSync(join(root, 'src', 'sidepanel', 'sidepanel.ts'), 'utf8');

  test('an unreachable panel downgrades to a warning, not an error', () => {
    // "Receiving end does not exist" is EXPECTED while the panel is still
    // opening; the stored context covers it. It must not surface as an error.
    expect(backgroundSource).toContain('CONTEXT_FROM_MENU');
    expect(backgroundSource).toContain('console.warn');
    expect(backgroundSource).toContain('using stored context');
  });

  test('the background saves the selection before trying to notify', () => {
    // Ordering matters: the panel reads contextSelection during startup, so
    // the write must precede the (possibly failing) sendMessage.
    const save = backgroundSource.indexOf("saveSession('contextSelection'");
    const send = backgroundSource.indexOf('CONTEXT_FROM_MENU');
    expect(save).toBeGreaterThan(-1);
    expect(send).toBeGreaterThan(-1);
    expect(save).toBeLessThan(send);
  });

  test('a live menu message clears the stored copy', () => {
    // Otherwise the next panel startup resurrects a stale selection via
    // checkPendingContext after the live path already applied it.
    const at = panel.indexOf('private async handleContextFromMenu');
    expect(at).toBeGreaterThan(-1);
    const body = panel.slice(at, panel.indexOf('\n  /**', at));
    expect(body).toContain('chrome.storage.session.remove(STORAGE_KEYS.CONTEXT_SELECTION)');
  });
});

describe('index.html: composer and settings markup hygiene', () => {
  test('uses explicit extensions for MV3 runtime imports', () => {
    expect(sidepanelTs).toContain("from '../utils/crypto.js'");
    expect(sidepanelTs).not.toContain("from '../utils/crypto';");
  });

  test('loads exactly one script, as an external module', () => {
    expect(html.split('<script').length - 1).toBe(1);
    expect(html).toContain('<script type="module" src="sidepanel.js"></script>');
  });

  test('has no inline event handlers', () => {
    for (const attr of ['onclick=', 'onerror=', 'onload=', 'onmouseover=']) {
      expect(html).not.toContain(attr);
    }
  });

  test('caps the composer input at the message limit', () => {
    expect(html).toContain('maxlength="4000"');
  });

  test('stores the API key in a password field flagged new-password', () => {
    expect(html).toContain('type="password"');
    expect(html).toContain('autocomplete="new-password"');
  });

  test('offers API provider and endpoint settings', () => {
    expect(html).toContain('id="api-format"');
    expect(html).toContain('id="base-url"');
  });

  test('renders quick actions dynamically and exposes their settings manager', () => {
    expect(html).toContain('id="quick-actions"');
    expect(html).toContain('id="quick-actions" class="quick-actions" role="toolbar"');
    expect(html).not.toContain('data-action="summarize"');
    expect(html).not.toContain('data-action="explain"');
    expect(html).not.toContain('data-action="translate"');
    expect(html).toContain('id="builtin-quick-action-list"');
    expect(html).toContain('id="quick-action-list"');
    expect(html).toContain('id="builtin-quick-action-list" class="quick-action-builtin-list" role="list"');
    expect(html).toContain('id="quick-action-editor"');
    expect(html).toContain('id="quick-action-prompt"');
  });

  test('keeps custom shortcut rendering text-only', () => {
    expect(sidepanelTs).toContain('label.textContent = item.kind === \'builtin\'');
    expect(sidepanelTs).toContain('caption.textContent = item.kind === \'builtin\'');
    expect(sidepanelTs).toContain('const prompt = action.kind === \'builtin\'');
    const rendererStart = sidepanelTs.indexOf('private renderQuickActions');
    const rendererEnd = sidepanelTs.indexOf('private renderQuickActionSettings', rendererStart);
    expect(sidepanelTs.slice(rendererStart, rendererEnd)).not.toContain('innerHTML');
  });

  test('separates the settings protocol from the project schema and keeps permissions unchanged', () => {
    expect(constantsTs).toContain("export const STORAGE_SCHEMA_VERSION = '1.0';");
    expect(constantsTs).toContain("export const PROJECT_VERSION = '0.1.3';");
    expect(constantsTs).toContain("export const SETTINGS_PROTOCOL_VERSION = '1.0';");
    expect(constantsTs).toContain("SETTINGS_PROTOCOL_VERSION: 'settings_protocol_version'");
    expect([...manifest.permissions].sort()).toEqual([
      'activeTab', 'contextMenus', 'scripting', 'sidePanel',
      'storage', 'webNavigation'
    ].sort());
  });

  test('provides visible keyboard focus and compact settings controls', () => {
    expect(css).toContain('.quick-action-operation:focus-visible');
    expect(css).toContain('.quick-action-editor-modal');
    expect(css).toContain('.quick-action-setting-item');
    expect(css).toContain('.quick-action-setting-label');
  });

  test('treats the quick action editor as the active modal and restores focus', () => {
    expect(sidepanelTs).toContain('!this.quickActionEditor.classList.contains(\'hidden\')');
    expect(sidepanelTs).toContain('activeModal === this.quickActionEditor');
    expect(sidepanelTs).toContain('this.quickActionEditorReturnFocus?.isConnected');
    expect(sidepanelTs).toContain('target === this.quickActionNameInput');
  });

  test('autofocuses the composer when the side panel opens', () => {
    expect(html).toMatch(/id="message-input"[\s\S]*autofocus/);
  });

  test('keeps a paste shortcut in the composer when panel focus is lost', () => {
    expect(sidepanelTs).toContain("event.key.toLowerCase() !== 'v'");
    expect(sidepanelTs).toContain('pastePlainText(event, this.messageInput)');
    expect(sidepanelTs).toContain("this.messageInput.addEventListener('click'");
    expect(sidepanelTs).not.toContain("this.messageInput.addEventListener('pointerdown'");
    expect(sidepanelTs).not.toContain('window.focus()');
    expect(sidepanelTs).toContain('focusComposerInput(this.messageInput)');
  });

  test('surfaces chat request failures in the dialog, without raw console output', () => {
    expect(sidepanelTs).not.toContain('Chat request failed (HTTP');
    expect(sidepanelTs).toContain("this.showError(error instanceof Error ? error.message : I18nService.t('msg.apiError'))");
  });

  test('keeps one APIService implementation in the side panel module', () => {
    expect((sidepanelTs.match(/export class APIService/g) ?? []).length).toBe(1);
    expect(sidepanelTs).toContain('export class APIService');
    expect(require('node:fs').existsSync(join(root, 'src', 'utils', 'api.ts'))).toBe(false);
  });

  test('the file picker accepts no native executables', () => {
    const at = html.indexOf('accept="');
    expect(at).toBeGreaterThan(-1);
    const accept = html.slice(at + 'accept="'.length, html.indexOf('"', at + 9));
    const tokens = accept.split(',').map(t => t.trim().toLowerCase());
    const banned = ['.exe', '.dll', '.msi', '.scr', '.cmd'];
    for (const token of tokens) {
      for (const ext of banned) {
        expect(token).not.toBe(ext);
      }
    }
  });

  test('the file picker excludes active SVG content', () => {
    expect(html).not.toContain('image/*');
    expect(html).not.toContain('.svg');
    expect(html).toContain('image/png');
  });
});
