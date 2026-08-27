// Configuration types
export interface APIConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  baseUrl?: string; // Custom base URL for compatible APIs
  customModels?: string[]; // Manual model list; when set, the model dropdown uses it instead of querying the API
  maxTokens?: number;
  temperature?: number;
}

export interface AppSettings {
  api: APIConfig;
  language: 'en' | 'zh';
  theme: 'light' | 'dark' | 'auto';
}

// Message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  context?: PageContext;
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
  payload?: any;
}

export interface ContentResponse {
  success: boolean;
  data?: any;
  error?: string;
}
