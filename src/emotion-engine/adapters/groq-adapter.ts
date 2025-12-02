/**
 * Groq API Adapter
 * Wrapper for Groq SDK with error handling and retries
 */

import Groq from 'groq-sdk';
import type { ChatMessage } from '../types.js';
import { GroqAPIError } from '../utils/errors.js';

export interface GroqAdapterOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export class GroqAdapter {
  private client: Groq;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;
  private timeout: number;

  constructor(options: GroqAdapterOptions = {}) {
    const apiKey = options.apiKey || process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is required');
    }

    this.client = new Groq({ apiKey });
    let modelName =
      options.model || process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

    // Fix common model name issues
    if (modelName.includes('meta-llama/')) {
      modelName = modelName.replace('meta-llama/', '');
      console.warn(
        `⚠️  Fixed model name: removed 'meta-llama/' prefix. Using: ${modelName}`
      );
    }

    // Fix common mistake: llama-3.1-8b-instruct -> llama-3.1-8b-instant
    if (modelName === 'llama-3.1-8b-instruct') {
      modelName = 'llama-3.1-8b-instant';
      console.warn(
        `⚠️  Fixed model name: changed 'instruct' to 'instant'. Using: ${modelName}`
      );
    }

    this.defaultModel = modelName;
    this.defaultMaxTokens = options.maxTokens || 1500;
    this.defaultTemperature = options.temperature || 0.7;
    this.timeout = options.timeout || 30000; // 30 seconds
  }

  /**
   * Call Groq API with retries and error handling
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

    // Convert ChatMessage[] to Groq format
    const groqMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      // Create a promise with timeout
      const completionPromise = this.client.chat.completions.create({
        model,
        messages: groqMessages,
        max_tokens: maxTokens,
        temperature,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Groq API call timed out after ${this.timeout}ms`));
        }, this.timeout);
      });

      const completion = await Promise.race([
        completionPromise,
        timeoutPromise,
      ]);
      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new GroqAPIError('No content in Groq response', {
          model,
          response: completion,
        });
      }

      return content;
    } catch (error: unknown) {
      const err = error as Error;
      const errorMessage = err.message || String(error);

      // Check for specific error types
      if (
        errorMessage.includes('safety') ||
        errorMessage.includes('content') ||
        errorMessage.includes('moderation')
      ) {
        throw new GroqAPIError(
          'Content was rejected by safety filters. Please rephrase your message.',
          { model, originalError: errorMessage }
        );
      }

      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        throw new GroqAPIError(
          'Rate limit exceeded. Please try again in a moment.',
          {
            model,
            originalError: errorMessage,
          }
        );
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
      const models = await this.client.models.list();
      if (!models.data) {
        return [];
      }
      return models.data
        .map((m) => m.id)
        .filter((id): id is string => id !== undefined);
    } catch (error) {
      console.warn('Failed to fetch Groq models:', error);
      return [];
    }
  }
}
