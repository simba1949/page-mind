import { APIConfig, ChatMessage, ChatRequest, ChatResponse } from '../types';
import { API_PRESETS } from '../utils/constants';
import { LIMITS } from '../utils/constants';

/**
 * Base API service for LLM communication
 * Supports OpenAI/Anthropic compatible API formats with custom endpoints
 */
export class APIService {
  private config: APIConfig;
  private static readonly REQUEST_TIMEOUT_MS = 45_000;

  constructor(config: APIConfig) {
    this.config = {
      ...config,
      baseUrl: this.normalizeBaseUrl(config.baseUrl || API_PRESETS[config.provider].baseUrl)
    };
  }

  private normalizeBaseUrl(value: string): string {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new Error('Invalid API endpoint');
    }
    const isLocalHttp = url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if (url.protocol !== 'https:' && !isLocalHttp) {
      throw new Error('API endpoint must use HTTPS');
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error('Invalid API endpoint');
    }
    return url.toString().replace(/\/+$/, '');
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), APIService.REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Send chat request to the configured API
   */
  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    if (!this.config.apiKey) {
      throw new Error('API key is required');
    }

    // Use custom baseUrl if provided, otherwise use preset
    const baseUrl = this.config.baseUrl || API_PRESETS[this.config.provider].baseUrl;

    try {
      if (this.config.provider === 'openai') {
        return await this.chatWithOpenAI(messages, baseUrl);
      } else if (this.config.provider === 'anthropic') {
        return await this.chatWithAnthropic(messages, baseUrl);
      } else {
        throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Send request to OpenAI compatible API
   */
  private async chatWithOpenAI(messages: ChatMessage[], baseUrl: string): Promise<ChatResponse> {
    const url = `${baseUrl}/chat/completions`;

    const requestBody = {
      model: this.config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    };

    const response = await this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    };
  }

  /**
   * Send request to Anthropic compatible API
   */
  private async chatWithAnthropic(messages: ChatMessage[], baseUrl: string): Promise<ChatResponse> {
    const url = `${baseUrl}/messages`;

    // Convert messages format for Anthropic
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const requestBody = {
      model: this.config.model,
      max_tokens: this.config.maxTokens || 2048,
      temperature: this.config.temperature,
      messages: conversationMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      ...(systemMessage && { system: systemMessage.content })
    };

    const response = await this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      content: data.content[0]?.text || '',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };
  }

  /**
   * Truncate content to fit within token limits
   */
  truncateContent(content: string, maxLength: number = LIMITS.MAX_CONTEXT_LENGTH): string {
    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength) + '...';
  }
}
