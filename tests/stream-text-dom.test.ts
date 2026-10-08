/** @jest-environment jsdom */
import { appendStreamText } from '../src/sidepanel/sidepanel';

test('streaming appends to the same text node without losing a reading selection', () => {
  const content = document.createElement('div');
  document.body.replaceChildren(content);
  appendStreamText(content, '一段可以选中的回复');
  const text = content.firstChild!;
  const range = document.createRange();
  range.setStart(text, 2);
  range.setEnd(text, 6);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);

  appendStreamText(content, '一段可以选中的回复\n继续输出');
  expect(content.firstChild).toBe(text);
  expect(selection.toString()).toBe('可以选中');
  expect(content.textContent).toBe('一段可以选中的回复\n继续输出');
});

test('reasoning-only frames leave unchanged text alone', () => {
  const content = document.createElement('div');
  appendStreamText(content, '正文');
  const append = jest.spyOn(content.firstChild as Text, 'appendData');
  appendStreamText(content, '正文');
  expect(append).not.toHaveBeenCalled();
});

test('markup stays inert text and the first content replaces the typing indicator', () => {
  const content = document.createElement('div');
  content.innerHTML = '<span class="typing-indicator"></span>';
  appendStreamText(content, '');
  expect(content.querySelector('.typing-indicator')).not.toBeNull();
  const source = '<img src=x onerror=alert(1)>\n<script>alert(1)</script>';
  appendStreamText(content, source);
  expect(content.textContent).toBe(source);
  expect(content.querySelector('span, img, script')).toBeNull();
});
