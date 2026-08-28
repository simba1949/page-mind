import { renderMarkdown } from '../src/sidepanel/sidepanel';

// Security suite: renderMarkdown is the ONLY place model output reaches the
// DOM via innerHTML, so these tests pin down the escape-first contract for
// every block type and the http(s)-only link allowlist.

describe('renderMarkdown security', () => {
  describe('HTML injection is inert in every block type', () => {
    // Raw tag openings must never survive; table rendering legitimately emits
    // its own <svg copy icon, so tables only ban payload tags. Event-handler
    // text (onerror=…) staying visible as plain text is safe — without a raw
    // tag opening it can never become an attribute.
    const cases: Array<[name: string, source: string, banned?: string[]]> = [
      ['paragraph', '<script>alert(1)</script>'],
      ['heading', '# <script>alert(1)</script>'],
      ['list item', '- <script>alert(1)</script>'],
      ['blockquote', '> <script>alert(1)</script>'],
      ['table cell', '| <script>alert(1)</script> | B |\n| --- | --- |\n| 1 | 2 |', ['<script', '<img', '<iframe']],
      ['paragraph with event handler', '<img src=x onerror=alert(1)>'],
      ['heading with event handler', '## <svg onload=alert(1)>'],
      ['table cell with iframe', '| A | B |\n| --- | --- |\n| 1 | <iframe src=javascript:alert(1)></iframe> |', ['<script', '<img', '<iframe']]
    ];

    test.each(cases)('%s renders as escaped text', (_name, source, banned = ['<script', '<img', '<svg', '<iframe']) => {
      const html = renderMarkdown(source);
      for (const raw of banned) {
        // Escaped forms like &lt;script never contain the raw markup.
        expect(html).not.toContain(raw);
      }
    });
  });

  describe('link schemes are restricted to http(s)', () => {
    test.each([
      ['javascript', '[x](javascript:alert(1))'],
      ['mixed case javascript', '[x](JavaScript:alert(1))'],
      ['data', '[x](data:text/html;base64,PHNjcmlwdD4=)'],
      ['vbscript', '[x](vbscript:msgbox(1))']
    ])('%s links are not rendered as anchors', (_name, source) => {
      const html = renderMarkdown(source);
      expect(html).not.toMatch(/href="(javascript|data|vbscript)/i);
    });

    test('bare dangerous schemes stay plain text', () => {
      const html = renderMarkdown('see javascript:alert(1) and data:text/html,x here');
      expect(html).not.toContain('href=');
    });

    test('markdown image syntax cannot smuggle an <img> tag', () => {
      const html = renderMarkdown('![payload](https://evil.example.com/a.png)');
      expect(html).not.toContain('<img');
    });
  });

  describe('attributes cannot be broken out of', () => {
    test('quotes inside a link URL stay escaped inside the href', () => {
      const html = renderMarkdown('[x](https://a.com/?q="onmouseover="alert(1))');
      expect(html).not.toContain('"onmouseover="');
      expect(html).toContain('&quot;onmouseover=&quot;');
    });

    test('markup in a link label stays escaped', () => {
      const html = renderMarkdown('[<script>alert(1)</script>](https://a.com)');
      expect(html).not.toContain('<script');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('generated anchors are safe to open', () => {
    test('every anchor carries target=_blank and rel=noopener noreferrer', () => {
      const html = renderMarkdown('[site](https://x.com) and https://y.com');
      const anchors = html.match(/<a [^>]*>/g) ?? [];
      expect(anchors.length).toBeGreaterThanOrEqual(2);
      for (const tag of anchors) {
        expect(tag).toContain('target="_blank"');
        expect(tag).toContain('rel="noopener noreferrer"');
      }
    });
  });

  describe('internal placeholders never leak into output', () => {
    test('masked code spans and fences are fully restored', () => {
      const html = renderMarkdown('`a<b>` then ```js\nx<y>\n``` then https://e.com');
      expect(html).not.toMatch(/[\u0000\u0001]/);
    });
  });
});
