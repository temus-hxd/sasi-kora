/**
 * Base Agent Class
 * Base class for all emotional agents with Groq/OpenRouter LLM integration
 */

import type { ChatMessage } from '../types.js';
import { loadPrompt } from '../utils/prompt-loader.js';
import { GroqAdapter } from '../adapters/groq-adapter.js';
import { OpenRouterAdapter } from '../adapters/openrouter-adapter.js';

export interface BaseAgentOptions {
  promptFile: string;
  skipPersonality?: boolean;
  modelEnvVar?: string;
  clientName?: string;
  language?: string; // 'en' or 'cn'
}

export abstract class BaseAgent {
  protected systemPrompt: string;
  protected agentType: string;
  protected model: string;
  protected groqAdapter!: GroqAdapter; // Initialized conditionally in constructor
  protected openRouterAdapter?: OpenRouterAdapter;
  protected clientName: string;
  protected language: string; // 'en' or 'cn'
  private initialized: boolean = false;
  private useOpenRouter: boolean = false;

  constructor(options: BaseAgentOptions) {
    this.clientName =
      options.clientName || process.env.CLIENT_NAME || 'synapse';
    this.language = options.language || 'en'; // Default to 'en'
    this.systemPrompt = ''; // Will be set by initialize()
    this.agentType = this.constructor.name.toLowerCase().replace('agent', '');

    // Determine model from env var or default
    if (options.modelEnvVar) {
      // Use Grok (OpenRouter) for angry agents by default
      const isAngryAgent = [
        'MODEL_IRRITATED',
        'MODEL_AGITATED',
        'MODEL_ENRAGED',
      ].includes(options.modelEnvVar);
      const defaultModel = isAngryAgent
        ? 'x-ai/grok-4-fast'
        : 'llama-3.1-8b-instant';

      let modelName = process.env[options.modelEnvVar] || defaultModel;

      // Check if model uses OpenRouter (contains '/')
      this.useOpenRouter = modelName.includes('/');

      // Fix common model name issues (only for Groq models)
      if (!this.useOpenRouter) {
        if (modelName.includes('meta-llama/')) {
          modelName = modelName.replace('meta-llama/', '');
          console.warn(
            `⚠️  Fixed model name for ${options.modelEnvVar}: removed 'meta-llama/' prefix. Using: ${modelName}`
          );
        }
        // Fix common mistake: llama-3.1-8b-instruct -> llama-3.1-8b-instant
        if (modelName === 'llama-3.1-8b-instruct') {
          modelName = 'llama-3.1-8b-instant';
          console.warn(
            `⚠️  Fixed model name for ${options.modelEnvVar}: changed 'instruct' to 'instant'. Using: ${modelName}`
          );
        }
      }
      this.model = modelName;
    } else {
      this.model = 'llama-3.1-8b-instant'; // Default fallback
      this.useOpenRouter = false;
    }

    // Initialize adapters based on model type
    if (this.useOpenRouter) {
      this.openRouterAdapter = new OpenRouterAdapter({
        model: this.model,
      });
    } else {
      this.groqAdapter = new GroqAdapter({
        model: this.model,
      });
    }

    // Store prompt file and options for async initialization
    (this as any)._promptFile = options.promptFile;
    (this as any)._skipPersonality = options.skipPersonality || false;
  }

  /**
   * Initialize prompts (async) - must be called before use
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const promptFile = (this as any)._promptFile;
      const skipPersonality = (this as any)._skipPersonality;

      // Load core personality based on language (en or cn)
      // DO NOT use sassi_personality.md - use language-specific versions
      let personalityPrompt = '';
      if (!skipPersonality) {
        const personalityFile =
          this.language === 'cn'
            ? 'sassi_personality_chinese.md'
            : 'sassi_personality_english.md';
        personalityPrompt = await loadPrompt(personalityFile, this.clientName);
      }
      const agentPrompt = await loadPrompt(promptFile, this.clientName);

      // Load linguistic engine and false memory prompts
      const linguisticEnginePrompt = await loadPrompt(
        'linguistic-engine.md',
        this.clientName
      );
      const falseMemoryPrompt = await loadPrompt(
        'false-memory.md',
        this.clientName
      );

      // Combine prompts: personality + linguistic engine + false memory + agent-specific
      const promptParts: string[] = [];

      if (!skipPersonality && personalityPrompt) {
        promptParts.push(personalityPrompt);
      }

      if (linguisticEnginePrompt) {
        promptParts.push(linguisticEnginePrompt);
      }

      if (falseMemoryPrompt) {
        promptParts.push(falseMemoryPrompt);
      }

      if (agentPrompt) {
        promptParts.push(agentPrompt);
      }

      // Filter out empty prompts and join
      const nonEmptyParts = promptParts.filter((part) => part.trim());
      this.systemPrompt = nonEmptyParts.join('\n\n---\n\n');
      this.initialized = true;
    } catch (error) {
      const err = error as Error;
      console.error(
        `❌ Failed to load prompts for ${this.agentType}:`,
        err.message
      );
      console.error(
        `   Client: ${this.clientName}, Prompt file: ${(this as any)._promptFile}`
      );
      console.error(`   Error details:`, err);
      // Fallback to basic prompt - but log warning
      console.warn(
        `⚠️  Using fallback generic prompt for ${this.agentType} - prompts not loaded!`
      );
      this.systemPrompt = `You are ${this.agentType} agent. Respond appropriately.`;
      this.initialized = true;
    }
  }

  /**
   * Ensure prompts are loaded (call before using)
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generate response based on conversation history
   */
  abstract generateResponse(messages: ChatMessage[]): Promise<string>;

  /**
   * Trim conversation history to maintain context window
   */
  protected trimConversationHistory(
    messages: ChatMessage[],
    maxMessages: number = 20
  ): ChatMessage[] {
    if (messages.length <= maxMessages) {
      return messages;
    }

    // Keep the most recent messages for better context
    return messages.slice(-maxMessages);
  }

  /**
   * Call LLM API (Groq or OpenRouter) - common LLM call logic
   */
  protected async callGroq(
    messages: ChatMessage[],
    maxTokens: number = 1500,
    temperature: number = 0.7
  ): Promise<string> {
    await this.ensureInitialized();

    // Trim conversation history to manage context window
    const trimmedMessages = this.trimConversationHistory(messages);

    // Add system prompt as first message
    const apiMessages: ChatMessage[] = [
      {
        role: 'system',
        content: this.systemPrompt,
      },
      ...trimmedMessages,
    ];

    // Call appropriate API based on model type
    if (this.useOpenRouter && this.openRouterAdapter) {
      return await this.openRouterAdapter.call(apiMessages, {
        model: this.model,
        maxTokens,
        temperature,
      });
    } else {
      return await this.groqAdapter.call(apiMessages, {
        model: this.model,
        maxTokens,
        temperature,
      });
    }
  }

  /**
   * Get agent type
   */
  getAgentType(): string {
    return this.agentType;
  }

  /**
   * Get model being used
   */
  getModel(): string {
    return this.model;
  }
}
