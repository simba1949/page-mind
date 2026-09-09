import {
  createThinkSeparator,
  endpointOriginPattern,
  modelOmitsTemperature,
  openAICompatibleErrorMessage,
  pageOriginPattern,
  parseCustomModels,
  sanitizeAppSettings,
  stripThinkTags
} from '../src/sidepanel/sidepanel';

describe('sanitizeAppSettings', () => {
  test('normalizes malformed persisted values to safe defaults', () => {
    const settings = sanitizeAppSettings({
      profiles: [{ id: 'p1', format: 'invalid', baseUrl: 'javascript:alert(1)', model: '  safe-model  ', customModels: [' m1 ', 42, 'm1', 'm2'], apiKey: '', rememberApiKey: false, remark: '' }], activeProfileId: 'p1',
      language: 'fr',
      theme: 'neon',
    });

    expect(settings.profiles[0].format).toBe('openai-chat');
    expect(settings.profiles[0].baseUrl).toBe('https://api.openai.com/v1');
    expect(settings.profiles[0].model).toBe('safe-model');
    expect(settings.profiles[0].customModels).toEqual(['m1', 'm2']);
    expect(settings.language).toBe('en');
    expect(settings.theme).toBe('auto');
  });

  test('caps API profiles at ten and keeps a valid active profile', () => {
    const profiles = Array.from({ length: 12 }, (_, index) => ({
      id: `p${index}`,
      format: 'openai-chat',
      baseUrl: 'https://api.example.com/v1',
      apiKey: '',
      model: '',
      customModels: [],
      rememberApiKey: false,
      remark: `配置 ${index}`
    }));
    const settings = sanitizeAppSettings({ profiles, activeProfileId: 'p11', language: 'zh', theme: 'auto' });

    expect(settings.profiles).toHaveLength(10);
    expect(settings.activeProfileId).toBe('p0');
  });
});

describe('endpointOriginPattern', () => {
  test('keeps a custom port and excludes URL credentials or paths', () => {
    expect(endpointOriginPattern('https://gateway.example:8443/v1')).toBe('https://gateway.example:8443/*');
  });

  test('supports localhost endpoints without widening to every port', () => {
    expect(endpointOriginPattern('http://localhost:3000/v1')).toBe('http://localhost:3000/*');
  });
});

describe('pageOriginPattern', () => {
  test('limits page access to the current HTTPS origin', () => {
    expect(pageOriginPattern('https://news.example.com/article?id=1')).toBe('https://news.example.com/*');
  });

  test('allows local development pages but rejects arbitrary HTTP pages', () => {
    expect(pageOriginPattern('http://localhost:3000/app')).toBe('http://localhost:3000/*');
    expect(pageOriginPattern('http://example.com/app')).toBeNull();
  });
});

describe('openAICompatibleErrorMessage', () => {
  test('explains that a 401 requires checking the API key', () => {
    const message = openAICompatibleErrorMessage(401, '请求被上游提供商阻止。');

    expect(message).toContain('API Key 鉴权失败');
    expect(message).toContain('请求被上游提供商阻止。');
  });

  test('keeps the existing gateway guidance for server errors', () => {
    expect(openAICompatibleErrorMessage(503)).toContain('网关或该模型渠道暂时不可用');
  });

  test('bounds and removes control characters from upstream details', () => {
    const detail = `${'x'.repeat(600)}\u0000\n`;
    const message = openAICompatibleErrorMessage(401, detail);

    expect(message).not.toContain('\u0000');
    expect(message).not.toContain('\n');
    expect(message.length).toBeLessThan(700);
  });
});

describe('modelOmitsTemperature', () => {
  test('GPT-5 family and o-series reasoning models reject temperature', () => {
    expect(modelOmitsTemperature('gpt-5.6-luna')).toBe(true);
    expect(modelOmitsTemperature('gpt-5')).toBe(true);
    expect(modelOmitsTemperature('gpt-5-turbo')).toBe(true);
    expect(modelOmitsTemperature('o1')).toBe(true);
    expect(modelOmitsTemperature('o3-mini')).toBe(true);
    expect(modelOmitsTemperature('O4')).toBe(true);
  });

  test('other models keep temperature', () => {
    expect(modelOmitsTemperature('gpt-4o')).toBe(false);
    expect(modelOmitsTemperature('gpt-3.5-turbo')).toBe(false);
    expect(modelOmitsTemperature('claude-sonnet-5')).toBe(false);
    // A model merely NAMED with a leading "o" is not an o-series model
    expect(modelOmitsTemperature('openrouter/llama')).toBe(false);
    expect(modelOmitsTemperature('')).toBe(false);
  });
});

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
