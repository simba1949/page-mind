import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Static regression tests for things a node test environment cannot render:
// theme rules (this round's light-theme color harmonization), the MV3
// permission surface, and composer markup hygiene. These read the source
// files directly so a reverted selector or a widened permission fails CI.

const root = join(__dirname, '..');
const css = readFileSync(join(root, 'src', 'sidepanel', 'styles.css'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
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
  test('uses the 0.1.2 storage/module contract', () => {
    expect(manifest.version).toBe('0.1.2');
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
    expect(body).toContain("type: 'GET_SELECTION'");
    expect(body).toMatch(/try \{\s*\n\s*const selectionResponse[\s\S]*?\} catch \{/);
  });

  test('skips context and authorization on non-web tabs', () => {
    const fetchStart = ts.indexOf('private async autoFetchCurrentPage');
    const selectionProbe = ts.indexOf("type: 'GET_SELECTION'", fetchStart);
    const webPageGuard = ts.indexOf('if (!isWebPageUrl(activeTabUrl))', fetchStart);
    expect(webPageGuard).toBeGreaterThan(fetchStart);
    expect(webPageGuard).toBeLessThan(selectionProbe);

    const sendFetchStart = ts.indexOf('private async fetchCurrentPageContext');
    const permissionRequest = ts.indexOf('ensurePageAccessPermission(true)', sendFetchStart);
    const sendWebPageGuard = ts.indexOf('if (!isWebPageUrl(activeTabUrl))', sendFetchStart);
    expect(sendWebPageGuard).toBeGreaterThan(sendFetchStart);
    expect(sendWebPageGuard).toBeLessThan(permissionRequest);
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
    const pendingGuard = ts.indexOf('isWebPageUrl(activeTabUrl)', pendingStart);
    const pendingAssignment = ts.indexOf('this.currentContext = pendingContext', pendingStart);
    expect(pendingGuard).toBeGreaterThan(pendingStart);
    expect(pendingGuard).toBeLessThan(pendingAssignment);

    const menuStart = ts.indexOf('private async handleContextFromMenu');
    const menuGuard = ts.indexOf('isWebPageUrl(activeTabUrl)', menuStart);
    const menuAssignment = ts.indexOf('this.currentContext = context', menuStart);
    expect(menuGuard).toBeGreaterThan(menuStart);
    expect(menuGuard).toBeLessThan(menuAssignment);
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
