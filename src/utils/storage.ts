import { AppSettings, ChatMessage, PageContext } from '../types';
import { DEFAULT_SETTINGS, STORAGE_KEYS, LIMITS } from './constants';

/**
 * Storage service for managing application data
 */
export class StorageService {
  static async initialize(): Promise<void> {
    // Kept for API compatibility. Credentials live in chrome.storage.session.
  }

  /**
   * Get application settings from storage
   */
  static async getSettings(): Promise<AppSettings> {
    try {
      const [localResult, sessionResult] = await Promise.all([
        chrome.storage.local.get(STORAGE_KEYS.SETTINGS),
        chrome.storage.session.get(STORAGE_KEYS.SESSION_API_KEY)
      ]);
      const stored = localResult[STORAGE_KEYS.SETTINGS] as AppSettings | undefined;
      const settings: AppSettings = stored
        ? { ...stored, api: { ...DEFAULT_SETTINGS.api, ...stored.api } }
        : { ...DEFAULT_SETTINGS, api: { ...DEFAULT_SETTINGS.api } };
      settings.api.apiKey = String(sessionResult?.[STORAGE_KEYS.SESSION_API_KEY] || '');
      return settings;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return { ...DEFAULT_SETTINGS, api: { ...DEFAULT_SETTINGS.api } };
    }
  }

  /**
   * Save application settings to storage
   */
  static async saveSettings(settings: AppSettings): Promise<void> {
    try {
      const apiKey = settings.api.apiKey.trim();
      const settingsToSave: AppSettings = {
        ...settings,
        api: { ...settings.api, apiKey: '' }
      };
      await Promise.all([
        chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settingsToSave }),
        apiKey
          ? chrome.storage.session.set({ [STORAGE_KEYS.SESSION_API_KEY]: apiKey })
          : chrome.storage.session.remove(STORAGE_KEYS.SESSION_API_KEY)
      ]);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Get chat history from storage
   */
  static async getChatHistory(): Promise<ChatMessage[]> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.CHAT_HISTORY);
      return result[STORAGE_KEYS.CHAT_HISTORY] || [];
    } catch (error) {
      console.error('Failed to load chat history:', error);
      return [];
    }
  }

  /**
   * Save chat message to history
   */
  static async saveChatMessage(message: ChatMessage): Promise<void> {
    try {
      const history = await this.getChatHistory();
      history.push(message);

      // Limit history size
      if (history.length > LIMITS.MAX_HISTORY_MESSAGES) {
        history.splice(0, history.length - LIMITS.MAX_HISTORY_MESSAGES);
      }

      await chrome.storage.local.set({
        [STORAGE_KEYS.CHAT_HISTORY]: history
      });
    } catch (error) {
      console.error('Failed to save chat message:', error);
      throw error;
    }
  }

  /**
   * Clear chat history
   */
  static async clearChatHistory(): Promise<void> {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.CHAT_HISTORY);
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      throw error;
    }
  }
}
