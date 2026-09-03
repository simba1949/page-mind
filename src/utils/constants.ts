import { AppSettings } from '../types';

// Default application settings
export const DEFAULT_SETTINGS: AppSettings = {
  profiles: [],
  activeProfileId: null,
  language: 'en',
  theme: 'auto'
};

// Convenience presets for supported API formats
export const API_PRESETS = {
  'openai-chat': {
    name: 'OpenAI Chat',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      'gpt-3.5-turbo',
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4o'
    ]
  },
  'openai-responses': {
    name: 'OpenAI Responses',
    baseUrl: 'https://api.openai.com/v1',
    models: []
  },
  'anthropic-messages': {
    name: 'Anthropic Messages',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      'claude-3-haiku-20240307',
      'claude-3-sonnet-20240229',
      'claude-3-opus-20240229'
    ]
  },
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
