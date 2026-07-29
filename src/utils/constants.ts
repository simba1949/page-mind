import { AppSettings, APIConfig } from '../types';

// Default application settings
export const DEFAULT_SETTINGS: AppSettings = {
  api: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 2048,
    temperature: 0.7
  },
  language: 'en',
  theme: 'auto'
};

// API format presets for common providers
export const API_PRESETS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      'gpt-3.5-turbo',
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4o'
    ]
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      'claude-3-haiku-20240307',
      'claude-3-sonnet-20240229',
      'claude-3-opus-20240229'
    ]
  },
  custom: {
    name: 'Custom (OpenAI Compatible)',
    baseUrl: '',
    models: []
  }
} as const;

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'app_settings',
  CHAT_HISTORY: 'chat_history',
  SESSION_API_KEY: 'session_api_key'
} as const;

// Message limits
export const LIMITS = {
  MAX_CONTEXT_LENGTH: 8000,
  MAX_MESSAGE_LENGTH: 4000,
  MAX_HISTORY_MESSAGES: 100
} as const;
