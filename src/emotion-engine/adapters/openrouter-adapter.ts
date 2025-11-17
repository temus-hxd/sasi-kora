/**
 * OpenRouter API Adapter
 * Wrapper for OpenRouter API (supports Grok and other models)
 */

import type { ChatMessage } from '../types.js';
import { GroqAPIError } from '../utils/errors.js';

export interface OpenRouterAdapterOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export class OpenRouterAdapter {
  private apiKey: string;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;
  private timeout: number;

  constructor(options: OpenRouterAdapterOptions = {}) {
    const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }

    this.apiKey = apiKey;
    this.defaultModel = options.model || 'x-ai/grok-4-fast';
    this.defaultMaxTokens = options.maxTokens || 1500;
    this.defaultTemperature = options.temperature ?? 0.7;
    this.timeout = options.timeout || 30000; // 30 seconds
  }

  /**
   * Call OpenRouter API with retries and error handling
   */
  async call(
    messages: ChatMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<string> {
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || this.defaultMaxTokens;
    const temperature = options.temperature ?? this.defaultTemperature;

    // Convert ChatMessage[] to OpenRouter format
    const openRouterMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      // Create a promise with timeout
      const fetchPromise = fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.VERCEL_URL || 'http://localhost:8888',
          'X-Title': 'SASI-KORA Emotion Engine',
        },
        body: JSON.stringify({
          model,
          messages: openRouterMessages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`OpenRouter API call timed out after ${this.timeout}ms`));
        }, this.timeout);
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(JSON.stringify(errorData));
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new GroqAPIError('No content in OpenRouter response', {
          model,
          response: data,
        });
      }

      return content;
    } catch (error: unknown) {
      const err = error as Error;
      const errorMessage = err.message || String(error);

      // Check for specific error types
      if (errorMessage.includes('safety') || errorMessage.includes('content') || errorMessage.includes('moderation')) {
        throw new GroqAPIError(
          'Content was rejected by safety filters. Please rephrase your message.',
          { model, originalError: errorMessage }
        );
      }

      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        throw new GroqAPIError('Rate limit exceeded. Please try again in a moment.', {
          model,
          originalError: errorMessage,
        });
      }

      // Generic error
      throw new GroqAPIError(`Error generating response: ${errorMessage}`, {
        model,
        originalError: errorMessage,
      });
    }
  }

  /**
   * Get available models (for future use)
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as any;
      if (!data.data) {
        return [];
      }

      return data.data.map((m: any) => m.id).filter((id: any): id is string => id !== undefined);
    } catch (error) {
      console.warn('Failed to fetch OpenRouter models:', error);
      return [];
    }
  }
}

