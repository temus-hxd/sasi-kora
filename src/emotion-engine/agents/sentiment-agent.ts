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

  constructor(clientName?: string) {
    super({
      promptFile: 'sentiment_agent.md',
      skipPersonality: true, // We'll use mini personality instead
      modelEnvVar: 'MODEL_SENTIMENT',
      clientName,
    });
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
      this.personalityContext = await loadPrompt('sassi_personality_mini.md', clientName);
      const agentPrompt = await loadPrompt('sentiment_agent.md', clientName);

      // Load linguistic engine and false memory prompts
      const linguisticEnginePrompt = await loadPrompt('linguistic-engine.md', clientName);
      const falseMemoryPrompt = await loadPrompt('false-memory.md', clientName);

      // Combine prompts: personality_mini + linguistic engine + false memory + agent prompt
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
      (this as any).systemPrompt = `You are a sentiment analysis agent. Analyze the emotion and intensity of messages.`;
      (this as any).initialized = true;
    }
  }

  /**
   * Analyze sentiment of a single message with thinking process
   */
  async analyzeSentiment(message: string): Promise<SentimentAnalysis> {
    await this.ensureInitialized();

    // Create a simple message list for analysis
    const analysisMessages: ChatMessage[] = [
      { role: 'user', content: message }
    ];

    // Get raw response from Groq
    const rawResponse = await this.callGroq(analysisMessages, 300, 0.3);

    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = rawResponse.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```/g, '').trim();
      }

      // Parse JSON response
      const sentimentData = JSON.parse(cleanedResponse) as Partial<SentimentAnalysis>;

      // Validate required fields
      if (typeof sentimentData.emotion !== 'string') {
        throw new Error('Missing or invalid "emotion" field');
      }
      if (typeof sentimentData.intensity !== 'number') {
        throw new Error('Missing or invalid "intensity" field');
      }

      // Add thinking tag if not present
      if (!sentimentData.thinking) {
        sentimentData.thinking = 'Analysis completed without explicit reasoning';
      }

      // Ensure emotional_indicators is an array
      if (!Array.isArray(sentimentData.emotional_indicators)) {
        sentimentData.emotional_indicators = [];
      }

      return {
        emotion: sentimentData.emotion,
        intensity: Math.max(0, Math.min(1, sentimentData.intensity)), // Clamp to 0-1
        emotional_indicators: sentimentData.emotional_indicators,
        thinking: sentimentData.thinking,
      };
    } catch (error) {
      const err = error as Error;
      console.error('⚠️  Sentiment analysis JSON parsing failed:', err.message);
      console.error('Raw response (first 200 chars):', rawResponse.substring(0, 200));
      
      throw new SentimentAnalysisError(
        `AI returned invalid JSON. Please try again. Error: ${err.message}`,
        err
      );
    }
  }

  /**
   * Generate response (not used for sentiment agent - use analyzeSentiment instead)
   */
  async generateResponse(_messages: ChatMessage[]): Promise<string> {
    return 'Sentiment agent should use analyzeSentiment method';
  }
}

