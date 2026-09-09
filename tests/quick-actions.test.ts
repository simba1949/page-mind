import {
  getEffectiveQuickActions,
  sanitizeQuickActions
} from '../src/sidepanel/sidepanel';

const builtin = (id: 'summarize' | 'explain' | 'translate') => ({ kind: 'builtin' as const, id });
const custom = (id: string, label = id, prompt = `prompt:${id}`) => ({
  kind: 'custom' as const,
  id,
  label,
  prompt
});

describe('quick action configuration sanitization', () => {
  test('keeps safe custom content as plain data and filters invalid entries', () => {
    const [first, second] = sanitizeQuickActions([
      builtin('summarize'),
      builtin('summarize'),
      { kind: 'builtin', id: 'javascript:alert(1)' },
      custom('safe', '  <b>Review</b>  ', '  <script>alert(1)</script>  '),
      { kind: 'custom', id: 'bad', label: '', prompt: 'ignored' },
      { kind: 'custom', id: 'bad', label: 'Duplicate', prompt: 'ignored' }
    ])!;

    expect(first).toEqual(builtin('summarize'));
    expect(second).toEqual(custom('safe', '<b>Review</b>', '<script>alert(1)</script>'));
  });

  test('caps custom count and user-controlled field lengths', () => {
    const actions = sanitizeQuickActions([
      ...Array.from({ length: 12 }, (_, index) => custom(`custom-${index}`, 'x'.repeat(120), 'y'.repeat(5000)))
    ])!;

    expect(actions.filter(item => item.kind === 'custom')).toHaveLength(10);
    const first = actions[0];
    expect(first.kind).toBe('custom');
    if (first.kind === 'custom') {
      expect(first.label).toHaveLength(80);
      expect(first.prompt).toHaveLength(4000);
    }
  });

  test('bounds the persisted item array before processing it', () => {
    const actions = sanitizeQuickActions([
      ...Array.from({ length: 13 }, (_, index) => custom(`kept-${index}`)),
      custom('ignored-after-boundary')
    ])!;

    expect(actions.filter(item => item.kind === 'custom')).toHaveLength(10);
    expect(actions.some(item => item.kind === 'custom' && item.id === 'ignored-after-boundary')).toBe(false);
  });

  test('returns no configured list when there are no custom entries', () => {
    expect(sanitizeQuickActions([])).toBeUndefined();
    expect(sanitizeQuickActions([builtin('explain')])).toBeUndefined();
  });
});

describe('quick action display rules', () => {
  test('falls back to all built-ins with no configuration or after deletion', () => {
    expect(getEffectiveQuickActions(undefined)).toEqual([
      builtin('summarize'), builtin('explain'), builtin('translate')
    ]);
    expect(getEffectiveQuickActions([])).toEqual([
      builtin('summarize'), builtin('explain'), builtin('translate')
    ]);
  });

  test('preserves the selected mixed order when custom actions are fewer than three', () => {
    expect(getEffectiveQuickActions([
      custom('review', 'Review', 'Review this page'),
      builtin('translate'),
      builtin('summarize')
    ])).toEqual([
      custom('review', 'Review', 'Review this page'),
      builtin('translate'),
      builtin('summarize')
    ]);
  });

  test('allows a user to keep fewer built-ins than the available slots', () => {
    expect(getEffectiveQuickActions([
      custom('review'),
      builtin('explain')
    ])).toEqual([custom('review'), builtin('explain')]);
  });

  test('uses only custom actions once there are three or more', () => {
    expect(getEffectiveQuickActions([
      builtin('summarize'),
      custom('one'),
      builtin('translate'),
      custom('two'),
      custom('three'),
      custom('four')
    ])).toEqual([custom('one'), custom('two'), custom('three'), custom('four')]);
  });

  test('keeps custom labels and prompts unchanged for later language rendering', () => {
    const action = custom('raw', '<script>标签</script>', '请保留中文 Prompt，不翻译');
    expect(getEffectiveQuickActions([action])).toEqual([action]);
  });
});
