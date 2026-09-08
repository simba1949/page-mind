import { focusComposerInput } from '../src/sidepanel/composer';

function inputWithFocus(documentFocused: boolean, inputActive: boolean) {
  const calls: string[] = [];
  const doc = { activeElement: null as unknown, hasFocus: () => documentFocused };
  const input = {
    ownerDocument: doc,
    selectionStart: 2,
    selectionEnd: 7,
    selectionDirection: 'backward',
    blur: jest.fn(() => calls.push('blur')),
    focus: jest.fn(() => calls.push('focus')),
    setSelectionRange: jest.fn(() => calls.push('selection')),
  };
  if (inputActive) doc.activeElement = input;
  return { input, calls };
}

test('restores stale textarea focus and preserves the range that paste will replace', () => {
  const { input, calls } = inputWithFocus(false, true);
  focusComposerInput(input as unknown as HTMLTextAreaElement);
  expect(calls).toEqual(['blur', 'focus', 'selection']);
  expect(input.setSelectionRange).toHaveBeenCalledWith(2, 7, 'backward');
});

test.each([[true, true], [true, false], [false, false]])(
  'normal focus does not blur or reset selection (document focused: %s, input active: %s)',
  (documentFocused, inputActive) => {
    const { input, calls } = inputWithFocus(documentFocused, inputActive);
    focusComposerInput(input as unknown as HTMLTextAreaElement);
    expect(calls).toEqual(['focus']);
    expect(input.focus).toHaveBeenCalledWith({ preventScroll: true });
  }
);
