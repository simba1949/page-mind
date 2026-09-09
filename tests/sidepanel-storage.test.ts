import { StorageService } from '../src/sidepanel/sidepanel';
import { installChromeMock } from './helpers/chrome';

const chromeMock = installChromeMock();

describe('side panel credential storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chromeMock.storage.local.get.mockResolvedValue({});
    chromeMock.storage.session.get.mockResolvedValue({});
    chromeMock.storage.local.set.mockResolvedValue(undefined);
    chromeMock.storage.session.set.mockResolvedValue(undefined);
    chromeMock.storage.session.remove.mockResolvedValue(undefined);
  });

  test('migrates the schema without deleting saved settings', async () => {
    chromeMock.storage.local.get.mockResolvedValue({ settings_schema_version: 0 });

    await StorageService.prepareStorage();

    expect(chromeMock.storage.local.remove).toHaveBeenCalledWith(['chat_history', 'conversations', 'contextSelection']);
    expect(chromeMock.storage.local.remove).not.toHaveBeenCalledWith('app_settings');
    expect(chromeMock.storage.local.remove).not.toHaveBeenCalledWith('encryption_key');
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ settings_schema_version: 3 });
  });

  test('moves legacy chat history to session storage during migration', async () => {
    const legacy = [{ id: 'm1', role: 'user', content: 'hello', timestamp: 1 }];
    chromeMock.storage.local.get
      .mockResolvedValueOnce({ settings_schema_version: 2 })
      .mockResolvedValueOnce({ chat_history: legacy });

    await StorageService.prepareStorage();

    expect(chromeMock.storage.session.set).toHaveBeenCalledWith({ chat_history: legacy });
    expect(chromeMock.storage.local.remove).toHaveBeenCalledWith(['chat_history', 'conversations', 'contextSelection']);
  });

  test('clears the retired conversation archive explicitly', async () => {
    await StorageService.clearConversationHistory();

    expect(chromeMock.storage.local.remove).toHaveBeenCalledWith('conversations');
  });

  test('encrypts remembered API keys before persistent storage', async () => {
    await StorageService.saveSettings({ profiles: [{ id: 'p1', format: 'openai-chat', apiKey: 'secret-key', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', customModels: [], rememberApiKey: true, remark: '' }], activeProfileId: 'p1', language: 'zh', theme: 'auto' });

    const savedSettings = chromeMock.storage.local.set.mock.calls.map(([value]) => value?.app_settings).find(Boolean) as { profiles: Array<{ apiKey: string }> };

    expect(savedSettings.profiles[0].apiKey).toMatch(/^enc:v1:/);
    expect(savedSettings.profiles[0].apiKey).not.toContain('secret-key');
  });

  test('keeps non-remembered API keys in session storage only', async () => {
    await StorageService.saveSettings({ profiles: [{ id: 'p1', format: 'openai-chat', apiKey: 'session-secret', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', customModels: [], rememberApiKey: false, remark: '' }], activeProfileId: 'p1', language: 'zh', theme: 'auto' });

    const savedSettings = chromeMock.storage.local.set.mock.calls.map(([value]) => value?.app_settings).find(Boolean) as { profiles: Array<{ apiKey: string }> };

    expect(savedSettings.profiles[0].apiKey).toBe('');
    expect(chromeMock.storage.session.set).toHaveBeenCalledWith({
      session_api_keys: { p1: 'session-secret' }
    });
  });

  test('decrypts a remembered key only when reading it back', async () => {
    const localStore: Record<string, unknown> = {};
    chromeMock.storage.local.get.mockImplementation((key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      return Promise.resolve(Object.fromEntries(keys
        .filter(name => name in localStore)
        .map(name => [name, localStore[name]])));
    });
    chromeMock.storage.local.set.mockImplementation((value: Record<string, unknown>) => {
      Object.assign(localStore, value);
      return Promise.resolve();
    });

    await StorageService.saveSettings({ profiles: [{ id: 'p1', format: 'openai-chat', apiKey: 'round-trip-secret', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', customModels: [], rememberApiKey: true, remark: '' }], activeProfileId: 'p1', language: 'zh', theme: 'auto' });

    await expect(StorageService.getSettings()).resolves.toMatchObject({
      profiles: [{ apiKey: 'round-trip-secret' }]
    });
    expect((localStore.app_settings as { profiles: Array<{ apiKey: string }> }).profiles[0].apiKey)
      .not.toBe('round-trip-secret');
  });
});
