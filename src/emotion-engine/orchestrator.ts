/**
 * Orchestrator
 * Manages conversation flow with sentiment analysis and agent routing
 */

import type {
  ChatMessage,
  SentimentAnalysis,
  OrchestratorDecision,
  OrchestratorInsights,
  EmotionState,
  EmotionalState,
} from './types.js';
import { AngerMeter } from './systems/anger-meter.js';
import { AgentFactory } from './agents/agent-factory.js';
import { SentimentAgent } from './agents/sentiment-agent.js';
import { StateManager } from './utils/state-manager.js';

export class Orchestrator {
  private angerMeter: AngerMeter;
  private agentFactory: AgentFactory;
  private sentimentAgent: SentimentAgent;
  private currentAgent: string = 'normal';
  private emotionalHistory: EmotionalState[] = [];
  private ended: boolean = false;
  private clientName?: string;

  constructor(clientName?: string) {
    this.clientName = clientName || process.env.CLIENT_NAME || 'synapse';
    // Anger meter and agents will be initialized asynchronously
    this.angerMeter = null as any; // Will be set in initialize()
    this.agentFactory = new AgentFactory(this.clientName);
    this.sentimentAgent = new SentimentAgent(this.clientName);
  }

  /**
   * Initialize orchestrator (async setup)
   */
  async initialize(): Promise<void> {
    // Initialize anger meter
    this.angerMeter = await AngerMeter.create();
    
    // Initialize sentiment agent
    await this.sentimentAgent.initialize();
  }

  /**
   * Process user message and return response with agent type and sentiment analysis
   */
  async processMessage(
    message: string,
    conversationHistory: ChatMessage[],
    emotionState?: EmotionState
  ): Promise<[string, string, any, EmotionState]> {
    // Ensure initialized
    if (!this.angerMeter) {
      await this.initialize();
    }

    // Restore state if provided (for stateless serverless)
    if (emotionState) {
      this.restoreState(emotionState);
    }

    // Check if conversation is ended
    if (this.ended) {
      const finalState = this.getCurrentState();
      return [
        '[Conversation ended. Please reset to start a new chat.]',
        this.currentAgent,
        { ended: true },
        finalState,
      ];
    }

    // Step 1: Run sentiment analysis (required before routing and anger meter)
    console.log('⏱️  [TRACE] Starting sentiment analysis...');
    const sentimentStart = Date.now();
    const sentimentAnalysis = await this.sentimentAgent.analyzeSentiment(message);
    const sentimentDuration = (Date.now() - sentimentStart) / 1000;
    console.log(`⏱️  [TRACE] Sentiment analysis completed in ${sentimentDuration.toFixed(2)}s`);

    // Step 2: Process anger meter (anger persists across messages)
    const angerEmotions = ['anger', 'frustration', 'irritation', 'rage', 'annoyance'];
    const happyEmotions = ['joy', 'happiness', 'excitement', 'enthusiasm', 'pleasure'];
    const sadEmotions = ['sadness', 'melancholy', 'grief', 'disappointment', 'sorrow'];
    const emotion = sentimentAnalysis.emotion || 'neutral';
    const intensity = sentimentAnalysis.intensity || 0;

    // ALWAYS use anger meter system - anger persists regardless of current message emotion
    const [angerAgent, angerMeterInfo] = this.angerMeter.processMessage(message, sentimentAnalysis);
    
    // Determine next agent based on emotion and anger meter
    // Priority: Anger > Happiness > Sadness > Normal
    let nextAgent: string;
    let action: string;
    let thinking: string;

    // If anger meter says we should be angry, use that (anger persists)
    if (angerAgent !== 'normal') {
      nextAgent = angerAgent;
      if (angerEmotions.includes(emotion)) {
        action = 'anger_meter_routing_angry';
        thinking = `Angry message detected. Anger meter: ${angerMeterInfo.anger_points} pts, routing to ${angerAgent} agent.`;
      } else {
        action = 'anger_meter_routing_persistent';
        thinking = `Non-angry message but anger persists. Anger meter: ${angerMeterInfo.anger_points} pts, routing to ${angerAgent} agent.`;
      }
    }
    // If no anger, route based on positive emotions
    else if (happyEmotions.includes(emotion)) {
      if (intensity >= 0.7) {
        nextAgent = 'ecstatic';
        action = 'emotion_routing_happy_high';
        thinking = `High intensity happiness (${intensity.toFixed(2)}) detected, routing to ecstatic agent.`;
      } else if (intensity >= 0.4) {
        nextAgent = 'cheerful';
        action = 'emotion_routing_happy_medium';
        thinking = `Medium intensity happiness (${intensity.toFixed(2)}) detected, routing to cheerful agent.`;
      } else {
        nextAgent = 'pleased';
        action = 'emotion_routing_happy_low';
        thinking = `Low intensity happiness (${intensity.toFixed(2)}) detected, routing to pleased agent.`;
      }
    }
    // Route based on negative emotions (sadness)
    else if (sadEmotions.includes(emotion)) {
      if (intensity >= 0.7) {
        nextAgent = 'depressed';
        action = 'emotion_routing_sad_high';
        thinking = `High intensity sadness (${intensity.toFixed(2)}) detected, routing to depressed agent.`;
      } else if (intensity >= 0.4) {
        nextAgent = 'sorrowful';
        action = 'emotion_routing_sad_medium';
        thinking = `Medium intensity sadness (${intensity.toFixed(2)}) detected, routing to sorrowful agent.`;
      } else {
        nextAgent = 'melancholy';
        action = 'emotion_routing_sad_low';
        thinking = `Low intensity sadness (${intensity.toFixed(2)}) detected, routing to melancholy agent.`;
      }
    }
    // Default to normal
    else {
      nextAgent = 'normal';
      action = 'emotion_routing_normal';
      thinking = `Neutral emotion (${emotion}, ${intensity.toFixed(2)}) detected, routing to normal agent.`;
    }

    // Create orchestrator thinking for anger meter decision
    const orchestratorThinking: OrchestratorDecision = {
      current_agent: this.currentAgent,
      next_agent: nextAgent,
      action,
      thinking,
      emotion_detected: emotion,
      intensity_detected: sentimentAnalysis.intensity,
      anger_meter: angerMeterInfo,
    };

    // Step 3: Check for walk-away (enraged at max points)
    if (nextAgent === 'enraged') {
      const angerPoints = angerMeterInfo.anger_points;
      const maxPoints = angerMeterInfo.max_points;
      if (angerPoints >= maxPoints) {
        this.ended = true;
        const walkawayMsg = `<t>🔥 ${Math.round(angerPoints)}/${maxPoints} pts (LVL 3) I'M DONE WITH THIS. WALKING AWAY.</t>BYE. I'M OUT. CONVERSATION OVER.`;
        const finalState = this.getCurrentState();
        return [walkawayMsg, nextAgent, { ended: true, walkaway: true }, finalState];
      }
    }

    // Step 4: Generate response and insights in parallel
    console.log(`⏱️  [TRACE] Starting agent response generation for: ${nextAgent}`);
    console.log(`📜 Conversation history length: ${conversationHistory.length}`);
    if (conversationHistory.length > 0) {
      console.log(`📜 Last message in history: ${conversationHistory[conversationHistory.length - 1].role}: ${conversationHistory[conversationHistory.length - 1].content.substring(0, 50)}...`);
    }
    console.log(`💬 Current user message: ${message.substring(0, 50)}...`);
    const agentStart = Date.now();

    // Create enhanced history with universal instruction
    // Add current user message to history before sending to agent
    const historyWithCurrentMessage: ChatMessage[] = [
      ...conversationHistory,
      { role: 'user', content: message },
    ];
    
    const universalInstruction: ChatMessage = {
      role: 'system',
      content: 'You will use <t></t> tags',
    };
    const enhancedHistory = [...historyWithCurrentMessage, universalInstruction];

    // Get agent response
    const agent = await this.agentFactory.getAgent(nextAgent);
    let response: string;

    // Special handling for enraged agent (needs anger meter info)
    if (nextAgent === 'enraged' && 'generateResponse' in agent) {
      const enragedAgent = agent as any;
      response = await enragedAgent.generateResponse(enhancedHistory, angerMeterInfo);
    } else {
      response = await agent.generateResponse(enhancedHistory);
    }

    // Generate insights in parallel (simulated - could be async)
    const orchestratorInsights = this.generateInsights(
      sentimentAnalysis,
      orchestratorThinking,
      message
    );

    const agentDuration = (Date.now() - agentStart) / 1000;
    console.log(`⏱️  [TRACE] Agent response generation (${nextAgent}) completed in ${agentDuration.toFixed(2)}s`);

    // Step 5: Check bye detector
    if (this.byeDetector(response)) {
      this.ended = true;
      const finalState = this.getCurrentState();
      return [response, nextAgent, { ended: true }, finalState];
    }

    // Step 6: Update emotional history and current agent
    this.updateEmotionalHistory(sentimentAnalysis, nextAgent);
    this.currentAgent = nextAgent;

    // Step 7: Prepare analysis data for API response
    const analysisData = {
      sentiment_analysis: sentimentAnalysis,
      orchestrator_decision: orchestratorThinking,
      orchestrator_insights: orchestratorInsights,
    };

    const currentState = this.getCurrentState();

    return [response, nextAgent, analysisData, currentState];
  }

  /**
   * Detect if the agent is saying goodbye/walking away
   */
  private byeDetector(text: string): boolean {
    const byePhrases = [
      'bye',
      'goodbye',
      "i'm done",
      'i am done',
      "i'm leaving",
      'i am leaving',
      "i'm out",
      'i am out',
      "that's it",
      "i'm finished",
      'i am finished',
    ];
    const textLower = text.toLowerCase();
    return byePhrases.some((phrase) => textLower.includes(phrase));
  }

  /**
   * Generate enhanced orchestrator insights
   */
  private generateInsights(
    sentimentAnalysis: SentimentAnalysis,
    orchestratorThinking: OrchestratorDecision,
    message: string
  ): OrchestratorInsights {
    const emotion = sentimentAnalysis.emotion || 'neutral';
    const intensity = sentimentAnalysis.intensity || 0;
    const currentAgent = orchestratorThinking.current_agent;
    const nextAgent = orchestratorThinking.next_agent;
    const action = orchestratorThinking.action;

    // Generate conversation trajectory
    const trajectory = StateManager.getConversationTrajectory(this.emotionalHistory);

    // Extract detected triggers
    const triggers = sentimentAnalysis.emotional_indicators || [];

    // Generate state transition explanation
    const stateTransition = this.explainStateTransition(currentAgent, nextAgent, action, intensity);

    // Generate orchestrator suggestion
    const suggestion = this.generateOrchestratorSuggestion(nextAgent, emotion, intensity, action);

    // Create trigger explanation
    const triggerExplanation = this.explainTriggers(triggers, emotion, intensity, message);

    // Extract anger meter info
    const angerMeterData = orchestratorThinking.anger_meter;

    return {
      current_state: `${currentAgent} → ${nextAgent}`,
      emotional_intensity: `${intensity.toFixed(1)}/1.0 (${this.intensityDescription(intensity)})`,
      trigger_explanation: triggerExplanation,
      conversation_trajectory: trajectory,
      detected_triggers: triggers,
      state_transition: stateTransition,
      orchestrator_suggestion: suggestion,
      anger_points: angerMeterData.anger_points,
      anger_level: angerMeterData.anger_level,
      anger_thresholds: angerMeterData.thresholds,
      anger_change_reasons: angerMeterData.change_reasons,
    };
  }

  /**
   * Update emotional history for trajectory tracking
   */
  private updateEmotionalHistory(sentimentAnalysis: SentimentAnalysis, agent: string): void {
    const emotion = sentimentAnalysis.emotion || 'neutral';
    const intensity = sentimentAnalysis.intensity || 0;

    this.emotionalHistory = StateManager.updateEmotionalHistory(
      this.emotionalHistory,
      emotion,
      intensity,
      agent
    );
  }

  /**
   * Convert intensity to descriptive text
   */
  private intensityDescription(intensity: number): string {
    if (intensity >= 0.8) {
      return 'very strong emotion';
    } else if (intensity >= 0.5) {
      return 'moderate emotion';
    } else if (intensity >= 0.3) {
      return 'mild emotion';
    } else if (intensity >= 0.1) {
      return 'subtle emotion';
    } else {
      return 'minimal emotion';
    }
  }

  /**
   * Explain why the state transition occurred
   */
  private explainStateTransition(
    current: string,
    nextAgent: string,
    action: string,
    intensity: number
  ): string {
    if (action.includes('escalate')) {
      return `Escalating from ${current} to ${nextAgent} due to intensity ${intensity.toFixed(1)} requiring more emotional engagement`;
    } else if (action.includes('de-escalate')) {
      return `De-escalating from ${current} to ${nextAgent} as intensity ${intensity.toFixed(1)} suggests calmer response needed`;
    } else if (action.includes('maintain')) {
      return `Maintaining ${current} agent as intensity ${intensity.toFixed(1)} is appropriate for current emotional level`;
    } else {
      return `Transitioning from ${current} to ${nextAgent} based on emotional context`;
    }
  }

  /**
   * Explain what triggered the emotional detection
   */
  private explainTriggers(triggers: string[], emotion: string, intensity: number, _message: string): string {
    if (!triggers || triggers.length === 0) {
      return `Detected ${emotion} emotion through overall message tone and context`;
    }

    const triggerText = triggers.slice(0, 3).map((t) => `'${t}'`).join(', ');
    return `Key phrases ${triggerText} indicate ${emotion} emotion with ${intensity.toFixed(1)} intensity`;
  }

  /**
   * Generate orchestrator's reasoning and suggestion
   */
  private generateOrchestratorSuggestion(
    agent: string,
    emotion: string,
    intensity: number,
    _action: string
  ): string {
    const agentDescriptions: Record<string, string> = {
      normal: 'balanced, professional responses for neutral emotions',
      pleased: 'gentle positivity and contentment for mild happiness',
      cheerful: 'upbeat enthusiasm and energy for moderate happiness',
      ecstatic: 'overwhelming joy and celebration for intense happiness',
      melancholy: 'gentle, wistful sadness and contemplative responses for mild sadness',
      sorrowful: 'deeper emotional weight and vulnerability for moderate sadness',
      depressed: 'profound sadness and emotional struggle for intense sadness',
      irritated: 'mild annoyance and impatience for low-level anger',
      agitated: 'clear frustration and agitation for moderate anger',
      enraged: 'intense fury and hostility for high-level anger',
    };

    const agentDesc = agentDescriptions[agent] || 'appropriate emotional response';

    if (['joy', 'happiness', 'excitement', 'enthusiasm'].includes(emotion)) {
      return `Using ${agent} agent for ${agentDesc}. Intensity ${intensity.toFixed(1)} matches ${agent} emotional range perfectly.`;
    } else if (['anger', 'frustration', 'irritation', 'rage', 'annoyance'].includes(emotion)) {
      return `Using ${agent} agent for ${agentDesc}. Intensity ${intensity.toFixed(1)} requires appropriate anger expression and venting.`;
    } else {
      return `Using ${agent} agent for ${agentDesc}. Emotion '${emotion}' requires measured, supportive response.`;
    }
  }

  /**
   * Reset orchestrator to initial state
   */
  resetState(): void {
    this.currentAgent = 'normal';
    this.emotionalHistory = [];
    this.angerMeter.resetMeter();
    this.ended = false;
  }

  /**
   * Get current state for serialization
   */
  getCurrentState(): EmotionState {
    const meterState = this.angerMeter.serializeState();
    return {
      ...meterState,
      current_agent: this.currentAgent,
      emotional_history: this.emotionalHistory,
      ended: this.ended,
    };
  }

  /**
   * Restore state from serialized state
   */
  restoreState(state: EmotionState): void {
    this.currentAgent = state.current_agent;
    this.emotionalHistory = state.emotional_history || [];
    this.ended = state.ended || false;
    this.angerMeter.deserializeState(state);
  }
}

