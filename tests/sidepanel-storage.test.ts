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

  test('clears data from an unsupported storage schema instead of migrating it', async () => {
    chromeMock.storage.local.get.mockResolvedValue({ settings_schema_version: 0 });

    await StorageService.prepareStorage();

    expect(chromeMock.storage.local.remove).toHaveBeenCalledWith([
      'app_settings',
      'encryption_key',
      'settings_schema_version'
    ]);
    expect(chromeMock.storage.session.remove).toHaveBeenCalledWith('session_api_key');
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ settings_schema_version: 1 });
  });

  test('encrypts remembered API keys before persistent storage', async () => {
    await StorageService.saveSettings({
      api: { provider: 'openai', apiKey: 'secret-key', model: 'gpt-4o' },
      language: 'zh',
      theme: 'auto',
      rememberApiKey: true
    });

    const savedSettings = chromeMock.storage.local.set.mock.calls
      .map(([value]) => value?.app_settings)
      .find(Boolean) as { api: { apiKey: string } };

    expect(savedSettings.api.apiKey).toMatch(/^enc:v1:/);
    expect(savedSettings.api.apiKey).not.toContain('secret-key');
  });

  test('keeps non-remembered API keys in session storage only', async () => {
    await StorageService.saveSettings({
      api: { provider: 'openai', apiKey: 'session-secret', model: 'gpt-4o' },
      language: 'zh',
      theme: 'auto',
      rememberApiKey: false
    });

    const savedSettings = chromeMock.storage.local.set.mock.calls
      .map(([value]) => value?.app_settings)
      .find(Boolean) as { api: { apiKey: string } };

    expect(savedSettings.api.apiKey).toBe('');
    expect(chromeMock.storage.session.set).toHaveBeenCalledWith({
      session_api_key: 'session-secret'
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

    await StorageService.saveSettings({
      api: { provider: 'openai', apiKey: 'round-trip-secret', model: 'gpt-4o' },
      language: 'zh',
      theme: 'auto',
      rememberApiKey: true
    });

    await expect(StorageService.getSettings()).resolves.toMatchObject({
      api: { apiKey: 'round-trip-secret' },
      rememberApiKey: true
    });
    expect((localStore.app_settings as { api: { apiKey: string } }).api.apiKey)
      .not.toBe('round-trip-secret');
  });
});
