/** @jest-environment jsdom */
import { focusComposerInput, isNativePasteTarget, pastePlainText, shouldFocusComposer } from '../src/sidepanel/composer';

let input: HTMLTextAreaElement;

beforeEach(() => {
  document.body.innerHTML = '<textarea></textarea><input type="password"><button>Settings</button>';
  input = document.querySelector('textarea')!;
});

afterEach(() => jest.restoreAllMocks());

function paste(target: Element, text: string, html = '', cancelled = false) {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  const getData = jest.fn((format: string) => format === 'text/plain' ? text : html);
  Object.defineProperty(event, 'clipboardData', { value: { getData } });
  if (cancelled) event.preventDefault();
  const handler = (e: Event) => pastePlainText(e as ClipboardEvent, input);
  document.addEventListener('paste', handler);
  target.dispatchEvent(event);
  document.removeEventListener('paste', handler);
  return { event, getData };
}

test('a document paste replaces the selection once and bubbles an input event', () => {
  input.value = 'hello world';
  input.setSelectionRange(6, 11, 'backward');
  const changed = jest.fn();
  document.body.addEventListener('input', changed);
  const { event } = paste(document.body, '世界\n第二行');
  expect(input.value).toBe('hello 世界\n第二行');
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(input.value.length);
  expect(input.selectionEnd).toBe(input.value.length);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented).toBe(true);
  document.body.removeEventListener('input', changed);
});

test.each(['textarea', 'input', 'button'])('leaves native paste in %s untouched', selector => {
  const target = document.querySelector(selector)! as HTMLElement;
  target.focus();
  const { event, getData } = paste(target, 'private value');
  expect(input.value).toBe('');
  expect(document.activeElement).toBe(target);
  expect(event.defaultPrevented).toBe(false);
  expect(getData).not.toHaveBeenCalled();
});

test.each(['true', '', 'plaintext-only'])('preserves paste in nested contenteditable=%s', value => {
  const editor = document.createElement('div');
  editor.setAttribute('contenteditable', value);
  const child = editor.appendChild(document.createElement('span'));
  document.body.appendChild(editor);
  const { event, getData } = paste(child, 'editor text');
  expect(isNativePasteTarget(child)).toBe(true);
  expect(input.value).toBe('');
  expect(event.defaultPrevented).toBe(false);
  expect(getData).not.toHaveBeenCalled();
});

test('does not read or redirect a paste cancelled by another handler', () => {
  const { getData } = paste(document.body, 'sensitive', '', true);
  expect(getData).not.toHaveBeenCalled();
  expect(input.value).toBe('');
});

test('ignores HTML-only and unavailable clipboard data', () => {
  expect(paste(document.body, '', '<b>HTML only</b>').event.defaultPrevented).toBe(false);
  expect(() => pastePlainText(new Event('paste') as ClipboardEvent, input)).not.toThrow();
  expect(input.value).toBe('');
});

test('malicious clipboard markup stays literal text and HTML is never read', () => {
  const payload = '<img src=x onerror=alert(1)><script>alert(1)</script>';
  const { getData } = paste(document.body, payload, payload);
  expect(input.value).toBe(payload);
  expect(document.querySelector('img, script')).toBeNull();
  expect(getData.mock.calls).toEqual([['text/plain']]);
});

test('automatic focus respects existing controls and hidden documents', () => {
  expect(shouldFocusComposer(input)).toBe(true);
  document.querySelector('button')!.focus();
  expect(shouldFocusComposer(input)).toBe(false);
  input.focus();
  expect(shouldFocusComposer(input)).toBe(false);
  jest.spyOn(document, 'hasFocus').mockReturnValue(false);
  expect(shouldFocusComposer(input)).toBe(true);
  jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  expect(shouldFocusComposer(input)).toBe(false);
});

test('restoring stale focus preserves backward selections without changing text', () => {
  input.value = 'abcdef';
  input.focus();
  input.setSelectionRange(1, 4, 'backward');
  jest.spyOn(document, 'hasFocus').mockReturnValue(false);
  focusComposerInput(input);
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe('abcdef');
  expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([1, 4, 'backward']);
});
