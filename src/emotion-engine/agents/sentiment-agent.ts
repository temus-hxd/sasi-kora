/**
 * Sentiment Analysis Agent
 * Analyzes sentiment of user messages (required before routing)
 */

import { BaseAgent } from './base-agent.js';
import type { ChatMessage, SentimentAnalysis } from '../types.js';
import { SentimentAnalysisError } from '../utils/errors.js';
import { loadPrompt } from '../utils/prompt-loader.js';

export class SentimentAgent extends BaseAgent {
  private personalityContext: string = '';
  private includeAdditionalPrompts: boolean = false;

  constructor(clientName?: string) {
    super({
      promptFile: 'sentiment_agent.md',
      skipPersonality: true, // We'll use mini personality instead
      modelEnvVar: 'MODEL_SENTIMENT',
      clientName,
    });
  }

  /**
   * Enable or disable including additional prompts
   */
  setIncludeAdditionalPrompts(include: boolean): void {
    this.includeAdditionalPrompts = include;
    // Reset initialization so prompts are reloaded
    (this as any).initialized = false;
  }

  /**
   * Initialize prompts (override to use mini personality)
   */
  async initialize(): Promise<void> {
    if ((this as any).initialized) {
      return;
    }

    try {
      const clientName = this.clientName;

      // Load mini personality for context and sentiment prompt
      this.personalityContext = await loadPrompt(
        'sassi_personality_mini.md',
        clientName
      );
      const agentPrompt = await loadPrompt('sentiment_agent.md', clientName);

      // Load linguistic engine and false memory prompts
      const linguisticEnginePrompt = await loadPrompt(
        'linguistic-engine.md',
        clientName
      );
      const falseMemoryPrompt = await loadPrompt('false-memory.md', clientName);

      // Load additional prompts if enabled
      let negativeScenarioPrompt: string = '';
      let angryEnragedPrompt: string = '';
      let personalityEnglishPrompt: string = '';

      if (this.includeAdditionalPrompts) {
        try {
          negativeScenarioPrompt = await loadPrompt(
            'negative-scenario-prompt.md',
            clientName
          );
        } catch (error) {
          console.warn('Failed to load negative-scenario-prompt.md:', error);
        }

        try {
          angryEnragedPrompt = await loadPrompt(
            'angry-3-enraged.md',
            clientName
          );
        } catch (error) {
          console.warn('Failed to load angry-3-enraged.md:', error);
        }

        try {
          personalityEnglishPrompt = await loadPrompt(
            'sassi_personality_english.md',
            clientName
          );
        } catch (error) {
          console.warn('Failed to load sassi_personality_english.md:', error);
        }
      }

      // Combine prompts: personality_mini + linguistic engine + false memory + agent prompt
      // + additional prompts (if enabled)
      const promptParts: string[] = [];

      if (this.personalityContext) {
        promptParts.push(this.personalityContext);
      }

      if (linguisticEnginePrompt) {
        promptParts.push(linguisticEnginePrompt);
      }

      if (falseMemoryPrompt) {
        promptParts.push(falseMemoryPrompt);
      }

      // Include additional prompts if enabled
      if (this.includeAdditionalPrompts) {
        if (negativeScenarioPrompt) {
          promptParts.push(negativeScenarioPrompt);
        }
        if (angryEnragedPrompt) {
          promptParts.push(angryEnragedPrompt);
        }
        if (personalityEnglishPrompt) {
          promptParts.push(personalityEnglishPrompt);
        }
      }

      if (agentPrompt) {
        promptParts.push(agentPrompt);
      }

      // Filter out empty prompts and join
      const nonEmptyParts = promptParts.filter((part) => part.trim());
      (this as any).systemPrompt = nonEmptyParts.join('\n\n---\n\n');
      (this as any).initialized = true;
    } catch (error) {
      console.error(`Failed to load prompts for sentiment agent:`, error);
      // Fallback to basic prompt
      (this as any).systemPrompt =
        `You are a sentiment analysis agent. Analyze the emotion and intensity of messages.`;
      (this as any).initialized = true;
    }
  }

  /**
   * Analyze sentiment of a single message with thinking process
   * Includes retry logic for better reliability
   */
  async analyzeSentiment(
    message: string,
    retries: number = 3
  ): Promise<SentimentAnalysis> {
    await this.ensureInitialized();

    // Create a simple message list for analysis with strict JSON instruction
    const analysisMessages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'CRITICAL: You MUST return ONLY valid JSON. No text before or after. No markdown. Pure JSON only. Example: {"emotion":"neutral","intensity":0.5,"emotional_indicators":[],"thinking":"..."}',
      },
      { role: 'user', content: message },
    ];

    let lastError: Error | null = null;
    let lastRawResponse: string = '';

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Get raw response from Groq
        const rawResponse = await this.callGroq(analysisMessages, 300, 0.3);
        lastRawResponse = rawResponse;

        // Try to extract JSON from response (handles cases where model adds extra text)
        const jsonData = this.extractJSON(rawResponse);

        // Validate required fields
        if (typeof jsonData.emotion !== 'string') {
          throw new Error('Missing or invalid "emotion" field');
        }
        if (typeof jsonData.intensity !== 'number') {
          throw new Error('Missing or invalid "intensity" field');
        }

        // Add thinking tag if not present
        if (!jsonData.thinking) {
          jsonData.thinking = 'Analysis completed without explicit reasoning';
        }

        // Ensure emotional_indicators is an array
        if (!Array.isArray(jsonData.emotional_indicators)) {
          jsonData.emotional_indicators = [];
        }

        return {
          emotion: jsonData.emotion,
          intensity: Math.max(0, Math.min(1, jsonData.intensity)), // Clamp to 0-1
          emotional_indicators: jsonData.emotional_indicators,
          thinking: jsonData.thinking,
        };
      } catch (error) {
        const err = error as Error;
        lastError = err;

        if (attempt < retries) {
          console.warn(
            `⚠️  Sentiment analysis attempt ${attempt}/${retries} failed, retrying...`,
            err.message
          );
          // Wait a bit before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        } else {
          console.error(
            `⚠️  Sentiment analysis failed after ${retries} attempts:`,
            err.message
          );
          console.error(
            'Raw response (first 300 chars):',
            lastRawResponse.substring(0, 300)
          );

          // Return a safe fallback instead of throwing
          // This allows the conversation to continue even if sentiment analysis fails
          console.warn('⚠️  Using fallback sentiment analysis (neutral)');
          return {
            emotion: 'neutral',
            intensity: 0.5,
            emotional_indicators: [],
            thinking: `Sentiment analysis failed after ${retries} attempts. Using neutral fallback. Error: ${err.message}. Raw response: ${lastRawResponse.substring(0, 100)}...`,
          };
        }
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new SentimentAnalysisError(
      `Sentiment analysis failed after ${retries} attempts: ${lastError?.message || 'Unknown error'}`,
      lastError || undefined
    );
  }

  /**
   * Extract JSON from response, handling cases where model adds extra text
   */
  private extractJSON(response: string): Partial<SentimentAnalysis> {
    let cleanedResponse = response.trim();

    // Remove markdown code blocks if present
    if (cleanedResponse.includes('```json')) {
      const jsonMatch = cleanedResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[1].trim();
      }
    } else if (cleanedResponse.includes('```')) {
      const codeMatch = cleanedResponse.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch) {
        cleanedResponse = codeMatch[1].trim();
      }
    }

    // Try to find JSON object in the response (handles cases where model adds text before/after)
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }

    // Try parsing
    try {
      return JSON.parse(cleanedResponse) as Partial<SentimentAnalysis>;
    } catch (parseError) {
      // If still fails, try to find any valid JSON structure
      // Look for JSON-like patterns
      const jsonPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/;
      const patternMatch = cleanedResponse.match(jsonPattern);
      if (patternMatch) {
        try {
          return JSON.parse(patternMatch[0]) as Partial<SentimentAnalysis>;
        } catch {
          // Fall through to throw original error
        }
      }

      // Store raw response for debugging
      (parseError as any).rawResponse = response;
      throw parseError;
    }
  }

  /**
   * Generate response (not used for sentiment agent - use analyzeSentiment instead)
   */
  async generateResponse(_messages: ChatMessage[]): Promise<string> {
    return 'Sentiment agent should use analyzeSentiment method';
  }
}
