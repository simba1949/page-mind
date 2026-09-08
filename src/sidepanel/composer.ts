/** Restore real input focus when browser chrome owns the keyboard. */
export function focusComposerInput(input: HTMLTextAreaElement): void {
  const doc = input.ownerDocument;
  // activeElement survives document blur. Focusing that same element may
  // otherwise do nothing, even though the omnibox owns keyboard input.
  if (doc.activeElement === input && !doc.hasFocus()) {
    const { selectionStart, selectionEnd, selectionDirection } = input;
    input.blur();
    input.focus({ preventScroll: true });
    input.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
    return;
  }
  input.focus({ preventScroll: true });
}

/** Automatic focus must leave other controls and hidden panels alone. */
export function shouldFocusComposer(input: HTMLTextAreaElement): boolean {
  const doc = input.ownerDocument;
  if (doc.visibilityState === 'hidden') return false;
  const active = doc.activeElement;
  return !active || active === doc.body || active === doc.documentElement ||
    (active === input && !doc.hasFocus());
}

/** Preserve native paste in controls and nested rich-text editing regions. */
export function isNativePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, button, [contenteditable]:not([contenteditable="false"])'));
}

/** Recover a document paste using only plain text and the existing selection. */
export function pastePlainText(event: ClipboardEvent, input: HTMLTextAreaElement): void {
  if (event.defaultPrevented || isNativePasteTarget(event.target)) return;
  const text = event.clipboardData?.getData('text/plain');
  if (!text) return;
  event.preventDefault();
  focusComposerInput(input);
  input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
