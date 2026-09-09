import { escapeHtml, renderMarkdown, tableToMarkdown } from '../src/sidepanel/sidepanel';

describe('escapeHtml', () => {
  test('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });
});

describe('renderMarkdown', () => {
  describe('safety', () => {
    test('renders embedded HTML as inert text', () => {
      const html = renderMarkdown('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    test('keeps event handler markup from becoming attributes', () => {
      const html = renderMarkdown('<img src=x onerror=alert(1)>');
      expect(html).not.toContain('<img');
    });
  });

  describe('fenced code blocks', () => {
    test('renders with language label and copy button', () => {
      const html = renderMarkdown('```js\nconst x = 1;\n```');
      expect(html).toContain('<span class="md-lang">js</span>');
      expect(html).toContain('class="md-code-copy"');
      expect(html).toContain('<code>const x = 1;</code>');
    });

    test('escapes code content', () => {
      const html = renderMarkdown('```\n<div>text</div>\n```');
      expect(html).toContain('&lt;div&gt;text&lt;/div&gt;');
    });

    test('trims blank lines and common indentation around commands', () => {
      const html = renderMarkdown('```powershell\n\n  Get-Command codegraph  \n\n```');
      expect(html).toContain('<code>Get-Command codegraph</code>');
      expect(html).not.toContain('<code>\n');
      expect(html).not.toContain('codegraph  </code>');
    });

    test('normalizes Windows line endings and empty fenced blocks', () => {
      const html = renderMarkdown('```js\r\n\r\n  const x = 1;\r\n\r\n```');
      expect(html).toContain('<code>const x = 1;</code>');
      expect(renderMarkdown('```js\n\n```')).toContain('<code></code>');
    });

    test('keeps original fenced whitespace available for copying', () => {
      const html = renderMarkdown('```sh\r\n\r\n  echo "hello"  \r\n\r\n```');
      const encodedCopyCode = html.match(/data-copy-code="([^"]*)"/)?.[1];
      expect(encodedCopyCode).toBeDefined();
      expect(decodeURIComponent(encodedCopyCode!)).toBe('\r\n  echo "hello"  \r\n\r\n');
      expect(html).toContain('<code>echo &quot;hello&quot;</code>');
    });

    test('preserves relative indentation inside multi-line code', () => {
      const html = renderMarkdown('```js\n\n  function run() {\n    return true;\n  }\n\n```');
      expect(html).toContain('<code>function run() {\n  return true;\n}</code>');
    });

    test('renders multiple blocks in document order', () => {
      const html = renderMarkdown('```a\n1\n```\n\nmiddle\n\n```b\n2\n```');
      const a = html.indexOf('md-lang">a');
      const b = html.indexOf('md-lang">b');
      expect(a).toBeGreaterThan(-1);
      expect(b).toBeGreaterThan(a);
      expect(html).toContain('<p class="md-p">middle</p>');
    });
  });

  describe('headings', () => {
    test('maps the marker count to the heading level', () => {
      const html = renderMarkdown('## Title **bold**');
      expect(html).toContain('<h2 class="md-h">Title <strong>bold</strong></h2>');
    });
  });

  describe('inline formatting', () => {
    test('applies bold, italic, strikethrough, code and links', () => {
      const html = renderMarkdown('**b** *i* ~~s~~ `c` [t](https://x.com)');
      expect(html).toContain('<strong>b</strong>');
      expect(html).toContain('<em>i</em>');
      expect(html).toContain('<del>s</del>');
      expect(html).toContain('<code class="md-code">c</code>');
      expect(html).toContain('<a href="https://x.com" target="_blank" rel="noopener noreferrer">t</a>');
    });

    test('keeps emphasis characters inside code spans literal', () => {
      const html = renderMarkdown('`a*b*c`');
      expect(html).toContain('<code class="md-code">a*b*c</code>');
    });

    test('only linkifies http(s) URLs', () => {
      const html = renderMarkdown('[x](javascript:alert(1))');
      expect(html).not.toContain('href="javascript');
    });

    test('turns bare URLs into clickable links', () => {
      const html = renderMarkdown('详见 https://example.com/docs 页面');
      expect(html).toContain('<a href="https://example.com/docs" target="_blank" rel="noopener noreferrer">https://example.com/docs</a>');
    });

    test('keeps trailing punctuation outside bare links', () => {
      const html = renderMarkdown('看这个 https://example.com/a。 以及 (https://example.com/b).');
      expect(html).toContain('href="https://example.com/a"');
      expect(html).not.toContain('href="https://example.com/a。');
      expect(html).toContain('href="https://example.com/b"');
      expect(html).not.toContain('href="https://example.com/b).');
    });

    test('stops bare URLs at full-width brackets without swallowing prose', () => {
      const html = renderMarkdown('快捷安装（https://example.com/quick）也可以。');
      expect(html).toContain('<a href="https://example.com/quick"');
      expect(html).not.toContain('quick）');
    });

    test('leaves URLs inside code spans as text', () => {
      const html = renderMarkdown('`https://example.com/inline`');
      expect(html).not.toContain('href=');
    });

    test('does not corrupt underscores inside link URLs', () => {
      const html = renderMarkdown('[docs](https://example.com/__init__/guide)');
      expect(html).toContain('<a href="https://example.com/__init__/guide"');
      expect(html).not.toContain('<strong>');
    });
  });

  describe('lists', () => {
    test('renders unordered items with indented continuations', () => {
      const html = renderMarkdown('- one\n- two\n  two detail\n- three');
      expect(html).toContain('<ul class="md-list">');
      expect(html).toContain('<li>two<br>two detail</li>');
    });

    test('renders ordered lists', () => {
      const html = renderMarkdown('1. first\n2. second');
      expect(html).toContain('<ol class="md-list">');
      expect(html).toContain('<li>first</li>');
    });

    test('ends the list at non-item text', () => {
      const html = renderMarkdown('- item\nplain text');
      expect(html).toContain('<ul class="md-list">');
      expect(html).toContain('<p class="md-p">plain text</p>');
    });
  });

  describe('blockquotes', () => {
    test('strips markers and joins consecutive lines', () => {
      const html = renderMarkdown('> quoted **text**\n> second');
      expect(html).toContain('<blockquote class="md-quote">quoted <strong>text</strong><br>second</blockquote>');
    });
  });

  describe('tables', () => {
    test('renders header, separator and body rows with a copy button', () => {
      const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | `x` |');
      expect(html).toContain('<th>A</th>');
      expect(html).toContain('<td>1</td>');
      expect(html).toContain('<td><code class="md-code">x</code></td>');
      expect(html).toContain('class="md-table-copy"');
    });

    test('treats pipe-only lines without a separator row as text (freeze guard)', () => {
      // These inputs once sent the block loop into an infinite spin
      // (typical mid-stream, before the separator line arrives).
      expect(renderMarkdown('| a | b |')).toContain('<p class="md-p">');
      expect(renderMarkdown('| a | b |\n| c | d |')).not.toContain('md-table');
      expect(renderMarkdown('before\n| stray |\nafter')).not.toContain('md-table');
    });
  });

  describe('horizontal rules', () => {
    test('renders a divider line', () => {
      expect(renderMarkdown('---')).toContain('<hr class="md-hr">');
    });
  });

  describe('paragraphs', () => {
    test('joins consecutive plain lines with <br>', () => {
      expect(renderMarkdown('line one\nline two')).toContain('line one<br>line two');
    });
  });
});

describe('tableToMarkdown', () => {
  // Jest runs in a node environment — build structural DOM fakes instead of
  // real elements. Node type literals: 3 = text, 1 = element.
  const text = (value: string): Node =>
    ({ nodeType: 3, textContent: value }) as unknown as Node;

  const element = (tagName: string, children: Node[], href?: string): Node =>
    ({
      nodeType: 1,
      tagName,
      childNodes: children,
      textContent: children.map(c => c.textContent ?? '').join(''),
      getAttribute: (name: string) => (name === 'href' && href !== undefined ? href : null)
    }) as unknown as Node;

  // Cells are element nodes (TD/TH, nodeType 1) whose children we walk.
  const cellOf = (node: Node) => ({ nodeType: 1, childNodes: [node] });

  const tableOf = (headerCells: Node[], bodyRows: Node[][]): HTMLTableElement =>
    ({
      tHead: { rows: [{ cells: headerCells.map(cellOf) }] },
      tBodies: [{ rows: bodyRows.map(row => ({ cells: row.map(cellOf) })) }]
    }) as unknown as HTMLTableElement;

  test('rebuilds header, separator and body rows', () => {
    const md = tableToMarkdown(tableOf(
      [text('A'), text('B')],
      [[text('1'), text('2')]]
    ));
    expect(md).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
  });

  test('restores inline formatting to markdown syntax', () => {
    const md = tableToMarkdown(tableOf(
      [element('TH', [text('功能')])],
      [[
        element('TD', [element('STRONG', [text('加粗')])]),
        element('TD', [element('CODE', [text('a|b')])]),
        element('TD', [element('A', [text('链接')], 'https://x.com')])
      ]]
    ));
    expect(md).toContain('| 功能 |');
    expect(md).toContain('**加粗**');
    expect(md).toContain('`a\\|b`');
    expect(md).toContain('[链接](https://x.com)');
  });
});
