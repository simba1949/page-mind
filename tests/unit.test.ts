import { StorageService } from '../src/utils/storage';
import { CryptoService } from '../src/utils/crypto';
import { I18nService } from '../src/i18n';
import { APIService } from '../src/utils/api';
import { ChatMessage, APIConfig } from '../src/types';

// Mock Chrome API
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    session: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  },
  sidePanel: {
    setPanelBehavior: jest.fn(),
    open: jest.fn()
  },
  action: {
    onClicked: {
      addListener: jest.fn()
    }
  }
};

global.chrome = mockChrome;

describe('CryptoService', () => {
  let cryptoKey;

  beforeAll(async () => {
    cryptoKey = await CryptoService.generateKey();
  });

  test('should encrypt and decrypt data correctly', async () => {
    const originalData = 'test-api-key-12345';

    const encrypted = await CryptoService.encrypt(originalData, cryptoKey);
    expect(encrypted).not.toBe(originalData);
    expect(encrypted.length).toBeGreaterThan(0);

    const decrypted = await CryptoService.decrypt(encrypted, cryptoKey);
    expect(decrypted).toBe(originalData);
  });

  test('should generate different encrypted output for same input', async () => {
    const data = 'test-data';

    const encrypted1 = await CryptoService.encrypt(data, cryptoKey);
    const encrypted2 = await CryptoService.encrypt(data, cryptoKey);

    expect(encrypted1).not.toBe(encrypted2);
  });
});

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StorageService.initialize();
  });

  test('should return default settings when none stored', async () => {
    mockChrome.storage.local.get.mockResolvedValue({});

    const settings = await StorageService.getSettings();

    expect(settings.api.provider).toBe('openai');
    expect(settings.api.model).toBe('gpt-3.5-turbo');
    expect(settings.language).toBe('en');
  });

  test('should keep API keys out of persistent local storage', async () => {
    mockChrome.storage.local.set.mockResolvedValue(undefined);
    mockChrome.storage.session.set.mockResolvedValue(undefined);

    await StorageService.saveSettings({
      api: {
        provider: 'openai',
        apiKey: 'session-only-key',
        model: 'gpt-4o'
      },
      language: 'zh',
      theme: 'auto'
    });

    expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
      app_settings: expect.objectContaining({
        api: expect.objectContaining({ apiKey: '' })
      })
    });
    expect(mockChrome.storage.session.set).toHaveBeenCalledWith({
      session_api_key: 'session-only-key'
    });
  });

  test('should save and retrieve chat messages', async () => {
    const mockMessage = {
      id: 'test-id',
      role: 'user',
      content: 'Test message',
      timestamp: Date.now()
    };

    mockChrome.storage.local.get.mockResolvedValue({ chat_history: [] });
    mockChrome.storage.local.set.mockResolvedValue(undefined);

    await StorageService.saveChatMessage(mockMessage);

    expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_history: expect.arrayContaining([mockMessage])
      })
    );
  });

  test('should limit chat history size', async () => {
    const messages = Array(105).fill(null).map((_, i) => ({
      id: `msg-${i}`,
      role: 'user',
      content: `Message ${i}`,
      timestamp: Date.now() + i
    }));

    mockChrome.storage.local.get.mockResolvedValue({ chat_history: messages });
    mockChrome.storage.local.set.mockResolvedValue(undefined);

    await StorageService.saveChatMessage({
      id: 'new-msg',
      role: 'user',
      content: 'New message',
      timestamp: Date.now() + 105
    });

    const setCall = mockChrome.storage.local.set.mock.calls[0][0];
    expect(setCall.chat_history.length).toBeLessThanOrEqual(100);
  });
});

describe('I18nService', () => {
  test('should return English translations by default', () => {
    I18nService.setLanguage('en');

    expect(I18nService.t('app.title')).toBe('PageMind');
    expect(I18nService.t('app.send')).toBe('Send');
  });

  test('should return Chinese translations when set', () => {
    I18nService.setLanguage('zh');

    expect(I18nService.t('app.title')).toBe('页知');
    expect(I18nService.t('app.send')).toBe('发送');
  });

  test('should return key for missing translation', () => {
    const missingKey = 'missing.key';
    expect(I18nService.t(missingKey)).toBe(missingKey);
  });

  test('should return all translations for current language', () => {
    I18nService.setLanguage('en');
    const translations = I18nService.getAll();

    expect(translations['app.title']).toBe('PageMind');
    expect(typeof translations).toBe('object');
  });
});

describe('APIService', () => {
  const mockConfig = {
    provider: 'openai',
    apiKey: 'test-api-key',
    model: 'gpt-3.5-turbo',
    maxTokens: 1000,
    temperature: 0.7
  };

  let apiService;

  beforeEach(() => {
    apiService = new APIService(mockConfig);
    global.fetch = jest.fn();
  });

  test('should throw error when API key is missing', async () => {
    const configWithoutKey = { ...mockConfig, apiKey: '' };
    const service = new APIService(configWithoutKey);

    await expect(service.chat([])).rejects.toThrow('API key is required');
  });

  test('should send correct request to OpenAI API', async () => {
    const mockResponse = {
      id: 'chatcmpl-test',
      choices: [{ message: { content: 'Test response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const messages = [{
      id: 'test',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    }];

    const response = await apiService.chat(messages);

    expect(response.content).toBe('Test response');
    expect(response.usage?.totalTokens).toBe(30);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key'
        })
      })
    );
  });

  test('should handle API errors correctly', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Invalid API key' } })
    });

    await expect(apiService.chat([])).rejects.toThrow('Invalid API key');
    consoleError.mockRestore();
  });

  test('should truncate long content', () => {
    const longContent = 'a'.repeat(10000);
    const truncated = apiService.truncateContent(longContent, 8000);

    expect(truncated.length).toBe(8003); // 8000 + '...'
    expect(truncated.endsWith('...')).toBe(true);
  });

  test('should not truncate short content', () => {
    const shortContent = 'short content';
    const result = apiService.truncateContent(shortContent, 8000);

    expect(result).toBe(shortContent);
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle complete message flow', async () => {
    // Initialize storage
    await StorageService.initialize();

    // Mock settings
    const mockSettings = {
      api: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo'
      },
      language: 'en',
      theme: 'auto'
    };

    mockChrome.storage.local.get.mockResolvedValue({
      app_settings: mockSettings
    });
    mockChrome.storage.session.get.mockResolvedValue({
      session_api_key: 'test-key'
    });

    // Load settings
    const settings = await StorageService.getSettings();
    expect(settings.api.provider).toBe('openai');

    // Create API service
    const apiService = new APIService(settings.api);

    // Mock successful API response
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'test',
        choices: [{ message: { content: 'Test response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })
    });

    // Send message
    const response = await apiService.chat([{
      id: 'test',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    }]);

    expect(response.content).toBe('Test response');
  });
});
