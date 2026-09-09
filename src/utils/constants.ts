import type { ApiFormat, AppSettings } from '../types/index.js';

export const DEFAULT_SETTINGS: AppSettings = {
  profiles: [],
  activeProfileId: null,
  language: 'zh',
  theme: 'light'
};

export const API_PRESETS: Record<ApiFormat, { name: string; baseUrl: string; models: string[] }> = {
  'openai-chat': { name: 'OpenAI Chat', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4.1-mini'] },
  'openai-responses': { name: 'OpenAI Responses', baseUrl: 'https://api.openai.com/v1', models: ['gpt-5', 'gpt-4.1'] },
  'anthropic-messages': { name: 'Anthropic Messages', baseUrl: 'https://api.anthropic.com/v1', models: ['claude-3-5-sonnet-latest', 'claude-3-haiku-20240307'] }
};

export const STORAGE_KEYS = {
  SETTINGS: 'app_settings',
  CHAT_HISTORY: 'chat_history',
  CONVERSATIONS: 'conversations',
  CONTEXT_SELECTION: 'contextSelection',
  ENCRYPTION_KEY: 'encryption_key',
  SESSION_API_KEYS: 'session_api_keys',
  SESSION_API_KEY: 'session_api_key',
  SCHEMA_VERSION: 'settings_schema_version',
  SETTINGS_PROTOCOL_VERSION: 'settings_protocol_version'
} as const;

// These are independent version identifiers even where their current values
// happen to be equal. Project releases alone must not invalidate settings.
export const PROJECT_VERSION = '0.1.3';
export const SETTINGS_PROTOCOL_VERSION = '1.0';
export const STORAGE_SCHEMA_VERSION = '1.0';
export const ENCRYPTED_API_KEY_PREFIX = 'enc:v1:';

export const LIMITS = {
  MAX_CONTEXT_LENGTH: 8000,
  MAX_MESSAGE_LENGTH: 4000,
  MAX_HISTORY_MESSAGES: 100,
  MAX_HISTORY_BYTES: 8_000_000,
  MAX_ATTACHMENTS: 4,
  MAX_API_PROFILES: 10,
  MAX_CUSTOM_QUICK_ACTIONS: 10,
  MAX_QUICK_ACTION_ITEMS: 13,
  MAX_QUICK_ACTION_LABEL_LENGTH: 80,
  MAX_QUICK_ACTION_PROMPT_LENGTH: 4000
} as const;
