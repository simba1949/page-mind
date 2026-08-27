import { parseCustomModels } from '../src/sidepanel/sidepanel';

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
