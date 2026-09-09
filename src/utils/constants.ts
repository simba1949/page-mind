import type { ApiFormat, AppSettings } from '../types/index.js';

export const DEFAULT_SETTINGS: AppSettings = {
  profiles: [],
  activeProfileId: null,
  language: 'zh',
  theme: 'auto'
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
  SCHEMA_VERSION: 'settings_schema_version'
} as const;

export const STORAGE_SCHEMA_VERSION = 3;
export const ENCRYPTED_API_KEY_PREFIX = 'enc:v1:';

export const LIMITS = {
  MAX_CONTEXT_LENGTH: 8000,
  MAX_MESSAGE_LENGTH: 4000,
  MAX_HISTORY_MESSAGES: 100,
  MAX_HISTORY_BYTES: 8_000_000,
  MAX_ATTACHMENTS: 4,
  MAX_API_PROFILES: 10
} as const;
