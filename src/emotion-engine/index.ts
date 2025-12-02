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
export {
  loadPrompt,
  clearPromptCache,
  preloadPrompts,
} from './utils/prompt-loader.js';
export {
  loadAngerConfig,
  getDefaultAngerConfig,
} from './config/anger-config.js';

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

// Phase 3 exports
export { SentimentAgent } from './agents/sentiment-agent.js';
export { NormalAgent } from './agents/normal-agent.js';
export {
  HappyLevel1PleasedAgent,
  HappyLevel2CheerfulAgent,
  HappyLevel3EcstaticAgent,
} from './agents/happy-agents.js';
export {
  SadLevel1MelancholyAgent,
  SadLevel2SorrowfulAgent,
  SadLevel3DepressedAgent,
} from './agents/sad-agents.js';
export {
  AngryLevel1IrritatedAgent,
  AngryLevel2AgitatedAgent,
  AngryLevel3EnragedAgent,
} from './agents/angry-agents.js';
export { AgentFactory } from './agents/agent-factory.js';

// Phase 4 exports
export { Orchestrator } from './orchestrator.js';
export { StateManager } from './utils/state-manager.js';
