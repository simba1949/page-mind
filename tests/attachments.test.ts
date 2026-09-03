import {
  attachmentPromptBlock,
  classifyFile,
  filesFromDataTransfer,
  sanitizeAttachments,
  withAttachmentText
} from '../src/sidepanel/sidepanel';

describe('classifyFile', () => {
  test('recognizes images by mime type and by extension', () => {
    expect(classifyFile('photo', 'image/png')).toBe('image');
    expect(classifyFile('photo.png', '')).toBe('image');
    expect(classifyFile('photo.JPG', '')).toBe('image');
  });

  test('rejects SVG and unsupported image MIME types', () => {
    expect(classifyFile('icon.svg', 'image/svg+xml')).toBeNull();
    expect(classifyFile('icon', 'image/svg+xml')).toBeNull();
  });

  test('recognizes text files by mime type and by extension', () => {
    expect(classifyFile('notes', 'text/plain')).toBe('text');
    expect(classifyFile('data.json', 'application/json')).toBe('text');
    expect(classifyFile('script.ts', '')).toBe('text');
    expect(classifyFile('README.md', '')).toBe('text');
  });

  test('rejects unknown binaries', () => {
    expect(classifyFile('program.exe', 'application/x-msdownload')).toBeNull();
    expect(classifyFile('archive.zip', 'application/zip')).toBeNull();
  });
});

describe('attachmentPromptBlock', () => {
  test('wraps file content in named delimiters', () => {
    expect(attachmentPromptBlock('notes.txt', 'hello'))
      .toBe('=== 附件：notes.txt ===\nhello\n=== 附件结束 ===');
  });
});

describe('withAttachmentText', () => {
  test('appends text attachments after the question', () => {
    const out = withAttachmentText({
      content: '总结一下',
      attachments: [
        { id: '1', kind: 'text', name: 'a.txt', mime: 'text/plain', text: '内容A' },
        { id: '2', kind: 'image', name: 'b.png', mime: 'image/png', dataUrl: 'data:image/png;base64,xx' }
      ]
    });
    expect(out).toContain('总结一下');
    expect(out).toContain('=== 附件：a.txt ===\n内容A');
    // Images are not inlined into the prompt text
    expect(out).not.toContain('b.png');
  });

  test('returns the plain content when there are no attachments', () => {
    expect(withAttachmentText({ content: '你好' })).toBe('你好');
  });
});

describe('sanitizeAttachments', () => {
  const image = { id: '1', kind: 'image', name: 'a.png', mime: 'image/png', dataUrl: 'data:image/png;base64,AAAA' };
  const text = { id: '2', kind: 'text', name: 'a.txt', mime: 'text/plain', text: '内容' };

  test('returns undefined for non-arrays and empty arrays', () => {
    expect(sanitizeAttachments(null)).toBeUndefined();
    expect(sanitizeAttachments('nope')).toBeUndefined();
    expect(sanitizeAttachments([])).toBeUndefined();
  });

  test('keeps a valid image and a valid text entry intact', () => {
    const out = sanitizeAttachments([image, text]);
    expect(out).toEqual([image, text]);
  });

  test('drops image entries whose dataUrl is not an inline image', () => {
    // A tampered history entry must not turn the message into a remote
    // image request (or worse) — only data:image/ URLs survive.
    const remote = { ...image, dataUrl: 'https://evil.example.com/pixel.png' };
    const htmlData = { ...image, dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' };
    const scripty = { ...image, dataUrl: 'javascript:alert(1)' };
    expect(sanitizeAttachments([remote, htmlData, scripty])).toBeUndefined();
  });

  test('drops SVG data URLs and malformed base64 payloads', () => {
    const svg = { ...image, dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' };
    const malformed = { ...image, dataUrl: 'data:image/png;base64,not valid base64!' };
    expect(sanitizeAttachments([svg, malformed])).toBeUndefined();
  });

  test('drops entries missing their payload and non-object elements', () => {
    const noDataUrl = { id: '1', kind: 'image', name: 'a.png', mime: 'image/png' };
    const noText = { id: '2', kind: 'text', name: 'a.txt', mime: 'text/plain' };
    expect(sanitizeAttachments([noDataUrl, noText, null, 42, 'x'])).toBeUndefined();
  });

  test('caps the list at four attachments', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ ...text, id: String(i) }));
    expect(sanitizeAttachments(five)).toHaveLength(4);
  });

  test('truncates oversized fields to their caps', () => {
    const bigText = { ...text, name: 'n'.repeat(300), mime: 'm'.repeat(200), text: 't'.repeat(70_000) };
    const out = sanitizeAttachments([bigText]);
    expect(out?.[0].name).toHaveLength(200);
    expect(out?.[0].mime).toHaveLength(100);
    expect(out?.[0].text).toHaveLength(64_000);

    const bigImage = { ...image, dataUrl: 'data:image/png;base64,' + 'A'.repeat(3_000_100) };
    expect(sanitizeAttachments([bigImage])?.[0].dataUrl).toHaveLength(3_000_000);
  });

  test('normalizes missing metadata and drops unknown kinds', () => {
    const bare = sanitizeAttachments([{ kind: 'text', text: 'hi' }]);
    expect(bare?.[0]).toMatchObject({ id: '', name: 'file', mime: '', text: 'hi' });

    const unknown = sanitizeAttachments([{ kind: 'binary', text: 'x' }]);
    expect(unknown).toBeUndefined();
  });
});

describe('filesFromDataTransfer', () => {
  const fakeFile = (name: string) => ({ name }) as File;

  const transferOf = (items: unknown[]) =>
    ({ items }) as unknown as DataTransfer;

  test('returns an empty list for a null transfer or missing items', () => {
    expect(filesFromDataTransfer(null)).toEqual([]);
    expect(filesFromDataTransfer({} as DataTransfer)).toEqual([]);
  });

  test('collects file items and skips string items', () => {
    const files = filesFromDataTransfer(transferOf([
      { kind: 'string', getAsFile: () => null },
      { kind: 'file', getAsFile: () => fakeFile('a.png') },
      { kind: 'file', getAsFile: () => fakeFile('b.txt') }
    ]));
    expect(files.map(f => f.name)).toEqual(['a.png', 'b.txt']);
  });

  test('skips file items that expose no concrete file', () => {
    const files = filesFromDataTransfer(transferOf([
      { kind: 'file', getAsFile: () => null }
    ]));
    expect(files).toEqual([]);
  });
});
