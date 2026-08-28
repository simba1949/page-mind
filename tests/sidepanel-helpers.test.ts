import { createThinkSeparator, parseCustomModels, stripThinkTags } from '../src/sidepanel/sidepanel';

describe('parseCustomModels', () => {
  test('splits on commas and newlines, trims and drops empties', () => {
    expect(parseCustomModels(' a , b ,, c\n\nd ')).toEqual(['a', 'b', 'c', 'd']);
  });

  test('drops duplicate entries', () => {
    expect(parseCustomModels('x, x ,y')).toEqual(['x', 'y']);
  });

  test('caps the list at 100 entries', () => {
    const input = Array.from({ length: 120 }, (_, i) => `m${i}`).join(',');
    expect(parseCustomModels(input)).toHaveLength(100);
  });

  test('empty or blank input yields an empty list', () => {
    expect(parseCustomModels('')).toEqual([]);
    expect(parseCustomModels(' , ,\n ')).toEqual([]);
  });
});

describe('stripThinkTags', () => {
  test('separates a closed think block from the answer', () => {
    const { content, reasoning } = stripThinkTags('<think>planning…</think>Here is the answer.');
    expect(reasoning).toBe('planning…');
    expect(content).toBe('Here is the answer.');
  });

  test('keeps plain text untouched', () => {
    expect(stripThinkTags('just an answer').content).toBe('just an answer');
  });

  test('treats text after an unclosed tag as thinking', () => {
    const { content, reasoning } = stripThinkTags('<think>unfinished');
    expect(content).toBe('');
    expect(reasoning).toBe('unfinished');
  });

  test('handles the longer <thinking> spelling', () => {
    const { content, reasoning } = stripThinkTags('<thinking>chain</thinking>answer');
    expect(reasoning).toBe('chain');
    expect(content).toBe('answer');
  });
});

describe('createThinkSeparator', () => {
  const collect = () => {
    const reasoning: string[] = [];
    const content: string[] = [];
    const sep = createThinkSeparator((kind, text) => {
      (kind === 'reasoning' ? reasoning : content).push(text);
    });
    return { sep, reasoning, content };
  };

  test('routes tagged text to reasoning and the rest to content', () => {
    const { sep, reasoning, content } = collect();
    sep.push('<think>step one ');
    sep.push('step two</think>final answer');
    sep.flush();
    expect(reasoning.join('')).toBe('step one step two');
    expect(content.join('')).toBe('final answer');
  });

  test('resolves a tag split mid-tag across deltas', () => {
    const { sep, reasoning, content } = collect();
    sep.push('thinking about <th');
    sep.push('ink>secret');
    sep.flush();
    expect(reasoning.join('')).toBe('secret');
    expect(content.join('')).toBe('thinking about ');
  });

  test('holds back a bare "<" that never becomes a tag', () => {
    const { sep, content } = collect();
    sep.push('a <');
    sep.push(' b');
    sep.flush();
    expect(content.join('')).toBe('a < b');
  });
});
