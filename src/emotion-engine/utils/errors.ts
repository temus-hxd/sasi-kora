/**
 * Custom error classes for the Emotion Engine
 */

export class EmotionEngineError extends Error {
  constructor(
    public code: string,
    public context: Record<string, unknown>,
    message: string
  ) {
    super(message);
    this.name = 'EmotionEngineError';
  }
}

export class PromptLoadError extends EmotionEngineError {
  constructor(promptFile: string, clientName: string, originalError?: Error) {
    super(
      'PROMPT_LOAD_ERROR',
      { promptFile, clientName },
      `Failed to load prompt file: ${promptFile} (client: ${clientName})${originalError ? ` - ${originalError.message}` : ''}`
    );
    this.name = 'PromptLoadError';
  }
}

export class ConfigLoadError extends EmotionEngineError {
  constructor(configPath: string, originalError?: Error) {
    super(
      'CONFIG_LOAD_ERROR',
      { configPath },
      `Failed to load config file: ${configPath}${originalError ? ` - ${originalError.message}` : ''}`
    );
    this.name = 'ConfigLoadError';
  }
}

export class GroqAPIError extends EmotionEngineError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super('GROQ_API_ERROR', context, message);
    this.name = 'GroqAPIError';
  }
}

export class SentimentAnalysisError extends EmotionEngineError {
  constructor(message: string, originalError?: Error) {
    super(
      'SENTIMENT_ANALYSIS_ERROR',
      { originalError: originalError?.message },
      `Sentiment analysis failed: ${message}`
    );
    this.name = 'SentimentAnalysisError';
  }
}
