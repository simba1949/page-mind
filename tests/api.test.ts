import { APIService } from '../src/sidepanel/sidepanel';
import { APIConfig } from '../src/types';
import { installFetchMock } from './helpers/chrome';

const config: APIConfig = {
  format: 'openai-chat',
  apiKey: 'test-api-key',
  model: 'gpt-3.5-turbo',
  maxTokens: 1000,
  temperature: 0.7
};

describe('APIService', () => {
  let fetchMock: ReturnType<typeof installFetchMock>;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  test('rejects chat when the API key is missing', async () => {
    const service = new APIService({ ...config, apiKey: '' });

    await expect(service.chat([])).rejects.toThrow('API key is required');
  });

  test('sends the expected request shape to the OpenAI endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'chatcmpl-test',
        choices: [{ message: { content: 'Test response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })
    });

    const response = await new APIService(config).chat([
      { id: 't', role: 'user', content: 'Hello', timestamp: 1 }
    ]);

    expect(response.content).toBe('Test response');
    expect(response.usage?.totalTokens).toBe(30);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key'
        })
      })
    );
  });

  test('surfaces API error messages', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Invalid API key' } })
    });

    await expect(new APIService(config).chat([])).rejects.toThrow('Invalid API key');
    consoleError.mockRestore();
  });

  test.each(['openai-chat', 'openai-responses', 'anthropic-messages'] as const)(
    '%s sends the conversation session to OpenCode across service recreation', async format => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
      const provider = { ...config, format, baseUrl: 'https://opencode.ai/zen/go/v1' };
      const sessionId = crypto.randomUUID();
      await new APIService(provider).chat([], undefined, sessionId);
      await new APIService({ ...provider, model: 'another-model' }).chat([], undefined, sessionId);
      const nextSession = crypto.randomUUID();
      await new APIService(provider).chat([], undefined, nextSession);
      expect(fetchMock.mock.calls.map(([, init]) => new Headers(init.headers).get('x-opencode-session')))
        .toEqual([sessionId, sessionId, nextSession]);
      const headers = new Headers(fetchMock.mock.calls[0][1].headers);
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get(format === 'anthropic-messages' ? 'x-api-key' : 'authorization'))
        .toBe(format === 'anthropic-messages' ? config.apiKey : `Bearer ${config.apiKey}`);
    }
  );

  test('standalone OpenCode clients reuse a default session without changing model discovery', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    const service = new APIService({ ...config, baseUrl: 'https://opencode.ai/inference/go/openai/v1' });
    await service.fetchModels();
    await service.chat([]);
    await service.chat([]);
    const headers = fetchMock.mock.calls.map(([, init]) => new Headers(init.headers));
    expect(headers[0].has('x-opencode-session')).toBe(false);
    expect(headers[1].get('x-opencode-session')).toMatch(/^[a-f0-9-]{36}$/);
    expect(headers[2].get('x-opencode-session')).toBe(headers[1].get('x-opencode-session'));
  });

  test.each(['https://api.openai.com/v1', 'https://opencode.ai.evil.example/v1', 'https://proxy.example/opencode.ai/v1'])(
    'does not disclose conversation IDs to %s', async baseUrl => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
      await new APIService({ ...config, baseUrl }).chat([], undefined, crypto.randomUUID());
      expect(new Headers(fetchMock.mock.calls[0][1].headers).has('x-opencode-session')).toBe(false);
    }
  );

  test('caps oversized provider error bodies', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('x'.repeat(40_000))
    });

    await expect(new APIService(config).fetchModels()).rejects.toThrow('HTTP 502');
  });

  describe('truncateContent', () => {
    test('truncates content past the limit with an ellipsis', () => {
      const truncated = new APIService(config).truncateContent('a'.repeat(10000), 8000);

      expect(truncated.length).toBe(8003);
      expect(truncated.endsWith('...')).toBe(true);
    });

    test('keeps short content untouched', () => {
      const content = 'short content';
      expect(new APIService(config).truncateContent(content, 8000)).toBe(content);
    });
  });
});
