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
