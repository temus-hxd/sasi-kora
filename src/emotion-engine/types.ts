/**
 * Core TypeScript types for the Emotion Engine
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface SentimentAnalysis {
  emotion: string;
  intensity: number; // 0.0 to 1.0
  emotional_indicators: string[];
  thinking: string;
}

export interface AngerMeterInfo {
  anger_points: number;
  anger_level: 'normal' | 'irritated' | 'agitated' | 'enraged';
  points_change: number;
  change_reasons: string[];
  consecutive_anger: number;
  message_count: number;
  thresholds: {
    irritated: number;
    agitated: number;
    enraged: number;
  };
  max_points: number;
  debug?: {
    last_emotion?: string;
    escalation_cooldown?: number;
    point_history?: Array<{
      timestamp: number;
      old_points: number;
      new_points: number;
      change: number;
      reason: string;
    }>;
    apology_count?: number;
    apologies_needed?: number;
    de_escalation_blocked?: boolean;
  };
}

export interface OrchestratorDecision {
  current_agent: string;
  next_agent: string;
  action: string;
  thinking: string;
  emotion_detected: string;
  intensity_detected: number;
  anger_meter: AngerMeterInfo;
}

export interface OrchestratorInsights {
  current_state: string;
  emotional_intensity: string;
  trigger_explanation: string;
  conversation_trajectory: string;
  detected_triggers: string[];
  state_transition: string;
  orchestrator_suggestion: string;
  anger_points: number;
  anger_level: string;
  anger_thresholds: {
    irritated: number;
    agitated: number;
    enraged: number;
  };
  anger_change_reasons: string[];
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  history?: ChatMessage[];
  emotion_state?: EmotionState; // For stateless serverless design
  language?: string; // 'en' or 'cn'
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  agent_type: string;
  timestamp: string;
  sentiment_analysis?: SentimentAnalysis;
  orchestrator_decision?: OrchestratorDecision;
  orchestrator_insights?: OrchestratorInsights;
  emotion_state?: EmotionState; // Returned state for client to store
  avatar_emoji?: string; // Emoji for ReadyPlayerMe avatar control
}

export interface EmotionState {
  anger_points: number;
  current_agent: string;
  emotional_history: EmotionalState[];
  ended: boolean;
  consecutive_anger_count: number;
  last_emotion?: string;
  escalation_cooldown_remaining: number;
  apology_count: number;
  recent_apologies: number[];
  enraged_de_escalation_blocked: boolean;
}

export interface EmotionalState {
  emotion: string;
  intensity: number;
  agent: string;
}

export type AgentType =
  | 'normal'
  | 'pleased'
  | 'cheerful'
  | 'ecstatic'
  | 'melancholy'
  | 'sorrowful'
  | 'depressed'
  | 'irritated'
  | 'agitated'
  | 'enraged';

export interface AngerConfig {
  anger_multiplier: number;
  thresholds: {
    irritated: number;
    agitated: number;
    enraged: number;
  };
  decay: {
    idle_rate: number;
    time_decay_enabled: boolean;
    time_rate: number;
    minimum_floor: number;
  };
  bonuses: {
    consecutive_anger: number;
    rapid_escalation: number;
    vulgar_language: number;
    direct_insults: number;
  };
  penalties: {
    apology_reduction: number;
    calm_language: number;
    positive_emotion: number;
  };
  meter: {
    max_points: number;
    escalation_cooldown: number;
    de_escalation_immediate: boolean;
  };
  de_escalation: {
    enraged_apology_requirement: number;
    apology_memory_limit: number;
    reset_apology_count_on_anger: boolean;
  };
  debug: {
    show_meter_in_response: boolean;
    log_point_changes: boolean;
  };
}
