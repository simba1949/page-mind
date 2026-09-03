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

describe('manifest.json: least-privilege permission surface', () => {
  test('uses the 0.1.2 storage/module contract', () => {
    expect(manifest.version).toBe('0.1.2');
  });

  test('requests exactly the expected permissions', () => {
    expect([...manifest.permissions].sort()).toEqual([
      'activeTab', 'contextMenus', 'scripting', 'sidePanel',
      'storage', 'unlimitedStorage', 'webNavigation'
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
});

describe('context-menu handoff: storage is the reliable channel', () => {
  const bg = readFileSync(join(root, 'src', 'background', 'service-worker.ts'), 'utf8');
  const panel = readFileSync(join(root, 'src', 'sidepanel', 'sidepanel.ts'), 'utf8');

  test('an unreachable panel downgrades to a warning, not an error', () => {
    // "Receiving end does not exist" is EXPECTED while the panel is still
    // opening; the stored context covers it. It must not surface as an error.
    const at = bg.indexOf("type: 'CONTEXT_FROM_MENU'");
    expect(at).toBeGreaterThan(-1);
    const after = bg.slice(at, at + 400);
    expect(after).toContain('console.warn');
    expect(after).not.toContain('console.error');
  });

  test('the background saves the selection before trying to notify', () => {
    // Ordering matters: the panel reads contextSelection during startup, so
    // the write must precede the (possibly failing) sendMessage.
    const save = bg.indexOf("save('contextSelection'");
    const send = bg.indexOf("type: 'CONTEXT_FROM_MENU'");
    expect(save).toBeGreaterThan(-1);
    expect(send).toBeGreaterThan(-1);
    expect(save).toBeLessThan(send);
  });

  test('a live menu message clears the stored copy', () => {
    // Otherwise the next panel startup resurrects a stale selection via
    // checkPendingContext after the live path already applied it.
    const at = panel.indexOf('private handleContextFromMenu');
    expect(at).toBeGreaterThan(-1);
    const body = panel.slice(at, panel.indexOf('\n  /**', at));
    expect(body).toContain("chrome.storage.local.remove('contextSelection')");
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
    expect(sidepanelTs).toContain("this.messageInput.setRangeText(text, start, end, 'end')");
    expect(sidepanelTs).toContain("this.messageInput.addEventListener('pointerdown'");
    expect(sidepanelTs).toContain('window.focus()');
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
