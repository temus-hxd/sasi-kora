/**
 * State Manager
 * Handles state serialization/deserialization for stateless serverless design
 */

import type { EmotionState, ChatMessage, EmotionalState } from '../types.js';

export class StateManager {
  /**
   * Detect if this is a new conversation (empty history)
   */
  static isNewConversation(history: ChatMessage[]): boolean {
    return !history || history.length === 0;
  }

  /**
   * Create initial emotion state
   */
  static createInitialState(): EmotionState {
    return {
      anger_points: 0,
      current_agent: 'normal',
      emotional_history: [],
      ended: false,
      consecutive_anger_count: 0,
      last_emotion: undefined,
      escalation_cooldown_remaining: 0,
      apology_count: 0,
      recent_apologies: [],
      enraged_de_escalation_blocked: false,
    };
  }

  /**
   * Serialize emotion state for client storage
   */
  static serializeState(state: EmotionState): EmotionState {
    // Return a clean copy
    return {
      ...state,
      emotional_history: [...state.emotional_history],
      recent_apologies: [...state.recent_apologies],
    };
  }

  /**
   * Deserialize emotion state from client
   */
  static deserializeState(state?: EmotionState): EmotionState {
    if (!state) {
      return this.createInitialState();
    }

    // Validate and return state with defaults
    return {
      anger_points: state.anger_points ?? 0,
      current_agent: state.current_agent || 'normal',
      emotional_history: state.emotional_history || [],
      ended: state.ended ?? false,
      consecutive_anger_count: state.consecutive_anger_count ?? 0,
      last_emotion: state.last_emotion,
      escalation_cooldown_remaining: state.escalation_cooldown_remaining ?? 0,
      apology_count: state.apology_count ?? 0,
      recent_apologies: state.recent_apologies || [],
      enraged_de_escalation_blocked: state.enraged_de_escalation_blocked ?? false,
    };
  }

  /**
   * Update emotional history (keep last 5 states)
   */
  static updateEmotionalHistory(
    history: EmotionalState[],
    emotion: string,
    intensity: number,
    agent: string
  ): EmotionalState[] {
    const newHistory = [
      ...history,
      {
        emotion,
        intensity,
        agent,
      },
    ];

    // Keep last 5 emotional states
    return newHistory.slice(-5);
  }

  /**
   * Get conversation trajectory description
   */
  static getConversationTrajectory(history: EmotionalState[]): string {
    if (history.length < 2) {
      return 'Initial conversation state';
    }

    // Get last few states
    const recentStates = history.slice(-3);

    const trajectoryParts = recentStates.map((state) => {
      const emotionDesc = `${state.emotion}(${state.intensity.toFixed(1)})`;
      return `${state.agent}[${emotionDesc}]`;
    });

    let trajectory = trajectoryParts.join(' → ');

    // Add trend analysis
    if (history.length >= 2) {
      const prevIntensity = history[history.length - 2].intensity;
      const currIntensity = history[history.length - 1].intensity;

      if (currIntensity > prevIntensity + 0.1) {
        trajectory += ' (escalating)';
      } else if (currIntensity < prevIntensity - 0.1) {
        trajectory += ' (de-escalating)';
      } else {
        trajectory += ' (stable)';
      }
    }

    return trajectory;
  }
}

