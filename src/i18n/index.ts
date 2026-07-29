export interface Translations {
  'app.title': string;
  'app.settings': string;
  'app.clear': string;
  'app.send': string;
  'app.placeholder': string;
  'app.loading': string;
  'app.error': string;

  'settings.apiProvider': string;
  'settings.apiKey': string;
  'settings.model': string;
  'settings.language': string;
  'settings.save': string;
  'settings.saved': string;

  'msg.noApiKey': string;
  'msg.noContent': string;
  'msg.networkError': string;
  'msg.apiError': string;
  'msg.contextTooLong': string;

  'action.askAboutPage': string;
  'action.askAboutSelection': string;
  'action.summarize': string;
  'action.explain': string;
  'action.translate': string;
}

export const translations: Record<'en' | 'zh', Translations> = {
  en: {
    // UI Elements
    'app.title': 'PageMind',
    'app.settings': 'Settings',
    'app.clear': 'Clear Chat',
    'app.send': 'Send',
    'app.placeholder': 'Ask me anything about this page...',
    'app.loading': 'Thinking...',
    'app.error': 'An error occurred',

    // Settings
    'settings.apiProvider': 'API Provider',
    'settings.apiKey': 'API Key',
    'settings.model': 'Model',
    'settings.language': 'Language',
    'settings.save': 'Save Settings',
    'settings.saved': 'Settings saved successfully',

    // Messages
    'msg.noApiKey': 'Please configure your API key in settings',
    'msg.noContent': 'No content available from current page',
    'msg.networkError': 'Network error. Please check your connection',
    'msg.apiError': 'API error. Please check your configuration',
    'msg.contextTooLong': 'Page content is too long, using selection instead',

    // Actions
    'action.askAboutPage': 'Ask about this page',
    'action.askAboutSelection': 'Ask about selection',
    'action.summarize': 'Summarize',
    'action.explain': 'Explain',
    'action.translate': 'Translate'
  },
  zh: {
    // UI Elements
    'app.title': '页知',
    'app.settings': '设置',
    'app.clear': '清空对话',
    'app.send': '发送',
    'app.placeholder': '询问关于此页面的任何问题...',
    'app.loading': '思考中...',
    'app.error': '发生错误',

    // Settings
    'settings.apiProvider': 'API 提供商',
    'settings.apiKey': 'API 密钥',
    'settings.model': '模型',
    'settings.language': '语言',
    'settings.save': '保存设置',
    'settings.saved': '设置保存成功',

    // Messages
    'msg.noApiKey': '请在设置中配置您的 API 密钥',
    'msg.noContent': '当前页面没有可用内容',
    'msg.networkError': '网络错误，请检查您的连接',
    'msg.apiError': 'API 错误，请检查您的配置',
    'msg.contextTooLong': '页面内容过长，改用选中内容',

    // Actions
    'action.askAboutPage': '询问关于此页面',
    'action.askAboutSelection': '询问关于选中内容',
    'action.summarize': '总结',
    'action.explain': '解释',
    'action.translate': '翻译'
  }
};

export type TranslationKey = keyof Translations;

/**
 * Internationalization service
 */
export class I18nService {
  private static currentLanguage: 'en' | 'zh' = 'en';

  /**
   * Set current language
   */
  static setLanguage(language: 'en' | 'zh'): void {
    this.currentLanguage = language;
  }

  /**
   * Get translated text for a key
   */
  static t(key: TranslationKey): string {
    return translations[this.currentLanguage][key] || key;
  }

  /**
   * Get all translations for current language
   */
  static getAll(): Translations {
    return translations[this.currentLanguage];
  }
}
