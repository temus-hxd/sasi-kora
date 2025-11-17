/**
 * SASI-KORA Emotion Engine
 * Main entry point for the emotion engine module
 */

// Export types
export type {
  ChatMessage,
  SentimentAnalysis,
  AngerMeterInfo,
  OrchestratorDecision,
  OrchestratorInsights,
  ChatRequest,
  ChatResponse,
  EmotionState,
  EmotionalState,
  AgentType,
  AngerConfig,
} from './types.js';

// Export utilities
export { loadPrompt, clearPromptCache, preloadPrompts } from './utils/prompt-loader.js';
export { loadAngerConfig, getDefaultAngerConfig } from './config/anger-config.js';

// Export errors
export {
  EmotionEngineError,
  PromptLoadError,
  ConfigLoadError,
  GroqAPIError,
  SentimentAnalysisError,
} from './utils/errors.js';

// Phase 2 exports
export { BaseAgent } from './agents/base-agent.js';
export type { BaseAgentOptions } from './agents/base-agent.js';
export { AngerMeter } from './systems/anger-meter.js';
export { GroqAdapter } from './adapters/groq-adapter.js';
export type { GroqAdapterOptions } from './adapters/groq-adapter.js';

// Future exports (will be added in later phases)
// export { Orchestrator } from './orchestrator.js';

