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
  test('requests exactly the expected permissions', () => {
    expect([...manifest.permissions].sort()).toEqual([
      'activeTab', 'contextMenus', 'scripting', 'sidePanel',
      'storage', 'unlimitedStorage', 'webNavigation'
    ].sort());
  });

  test('requires host access only for the two API endpoints', () => {
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

describe('index.html: composer and settings markup hygiene', () => {
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
});
