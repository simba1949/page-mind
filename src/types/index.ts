// Configuration types
export type ApiFormat = 'openai-chat' | 'openai-responses' | 'anthropic-messages';

export interface ApiProfile {
  id: string;
  format: ApiFormat;
  apiKey: string;
  model: string;
  baseUrl: string;
  customModels: string[];
  maxTokens?: number;
  temperature?: number;
  rememberApiKey: boolean;
  remark: string;
}

/** Wire-level API configuration used by the standalone service. */
export interface APIConfig {
  format: ApiFormat;
  apiKey: string;
  model: string;
  baseUrl?: string;
  customModels?: string[];
  maxTokens?: number;
  temperature?: number;
}

export type BuiltInQuickActionId = 'summarize' | 'explain' | 'translate';

export interface BuiltInQuickAction {
  kind: 'builtin';
  id: BuiltInQuickActionId;
}

export interface CustomQuickAction {
  kind: 'custom';
  id: string;
  label: string;
  prompt: string;
}

export type QuickActionItem = BuiltInQuickAction | CustomQuickAction;

export interface AppSettings {
  profiles: ApiProfile[];
  activeProfileId: string | null;
  language: 'en' | 'zh';
  theme: 'light' | 'dark';
  quickActions?: QuickActionItem[];
}

// Message types
export interface MessageAttachment {
  id: string;
  kind: 'image' | 'text';
  name: string;
  mime: string;
  dataUrl?: string;
  text?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  context?: PageContext;
  quote?: string;
  attachments?: MessageAttachment[];
  reasoning?: string;
}

export interface PageContext {
  type: 'full_page' | 'selection';
  url: string;
  title: string;
  content: string;
}

// API request/response types
export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Extension message types
export interface ExtensionMessage {
  type: 'GET_PAGE_CONTENT' | 'GET_SELECTION' | 'SEND_TO_AI' | 'OPEN_SIDEPANEL';
  payload?: unknown;
}

export interface ContentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}
