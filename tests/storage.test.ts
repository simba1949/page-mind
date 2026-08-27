import { StorageService } from '../src/utils/storage';
import { installChromeMock } from './helpers/chrome';

const chromeMock = installChromeMock();

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chromeMock.storage.session.get.mockResolvedValue({});
  });

  describe('getSettings', () => {
    test('returns defaults when nothing is stored', async () => {
      chromeMock.storage.local.get.mockResolvedValue({});

      const settings = await StorageService.getSettings();

      expect(settings.api.provider).toBe('openai');
      expect(settings.api.model).toBe('gpt-3.5-turbo');
      expect(settings.language).toBe('en');
    });

    test('merges stored settings over defaults and keeps custom models', async () => {
      chromeMock.storage.local.get.mockResolvedValue({
        app_settings: {
          api: {
            provider: 'openai',
            apiKey: '',
            model: 'm1',
            baseUrl: 'https://gw.example/v1',
            customModels: ['a', 'b']
          },
          language: 'zh',
          theme: 'dark'
        }
      });

      const settings = await StorageService.getSettings();

      expect(settings.api.customModels).toEqual(['a', 'b']);
      expect(settings.api.baseUrl).toBe('https://gw.example/v1');
      // Defaults survive a partial stored api object
      expect(settings.api.maxTokens).toBe(2048);
    });

    test('takes the API key from session storage only', async () => {
      chromeMock.storage.local.get.mockResolvedValue({});
      chromeMock.storage.session.get.mockResolvedValue({ session_api_key: 'sess-key' });

      const settings = await StorageService.getSettings();

      expect(settings.api.apiKey).toBe('sess-key');
    });

    test('falls back to defaults when storage throws', async () => {
      chromeMock.storage.local.get.mockRejectedValue(new Error('boom'));

      const settings = await StorageService.getSettings();

      expect(settings.api.provider).toBe('openai');
    });
  });

  describe('saveSettings', () => {
    test('keeps the API key out of persistent local storage', async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);
      chromeMock.storage.session.set.mockResolvedValue(undefined);

      await StorageService.saveSettings({
        api: { provider: 'openai', apiKey: 'secret-key', model: 'gpt-4o' },
        language: 'zh',
        theme: 'auto'
      });

      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        app_settings: expect.objectContaining({
          api: expect.objectContaining({ apiKey: '' })
        })
      });
      expect(chromeMock.storage.session.set).toHaveBeenCalledWith({
        session_api_key: 'secret-key'
      });
    });

    test('removes the session key when saving an empty key', async () => {
      chromeMock.storage.local.set.mockResolvedValue(undefined);
      chromeMock.storage.session.remove.mockResolvedValue(undefined);

      await StorageService.saveSettings({
        api: { provider: 'openai', apiKey: '  ', model: 'gpt-4o' },
        language: 'en',
        theme: 'auto'
      });

      expect(chromeMock.storage.session.remove).toHaveBeenCalledWith('session_api_key');
    });
  });

  describe('chat history', () => {
    const message = (id: string) => ({
      id,
      role: 'user' as const,
      content: `Message ${id}`,
      timestamp: 1
    });

    test('appends the message and persists it', async () => {
      chromeMock.storage.local.get.mockResolvedValue({ chat_history: [] });
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      await StorageService.saveChatMessage(message('a'));

      expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_history: expect.arrayContaining([message('a')])
        })
      );
    });

    test('trims history to the 100 message limit', async () => {
      const history = Array.from({ length: 105 }, (_, i) => message(`old-${i}`));
      chromeMock.storage.local.get.mockResolvedValue({ chat_history: history });
      chromeMock.storage.local.set.mockResolvedValue(undefined);

      await StorageService.saveChatMessage(message('new'));

      const saved = chromeMock.storage.local.set.mock.calls[0][0] as { chat_history: unknown[] };
      expect(saved.chat_history).toHaveLength(100);
      expect(saved.chat_history).toContainEqual(message('new'));
    });
  });
});
