/**
 * Anger Meter System
 * Tracks cumulative anger points over conversation with escalation/de-escalation logic
 */

import type { AngerMeterInfo, AngerConfig, SentimentAnalysis, EmotionState } from '../types.js';
import { loadAngerConfig } from '../config/anger-config.js';

export class AngerMeter {
  private config: AngerConfig;
  private angerPoints: number = 0.0;
  private currentLevel: 'normal' | 'irritated' | 'agitated' | 'enraged' = 'normal';
  private lastMessageTime: number = Date.now();
  private messageCount: number = 0;
  private consecutiveAngerCount: number = 0;
  private lastEmotion: string | null = null;
  private escalationCooldownRemaining: number = 0;
  
  // De-escalation tracking (for enraged state)
  private apologyCount: number = 0;
  private recentApologies: number[] = [];
  private enragedDeEscalationBlocked: boolean = false;
  
  // History for debugging
  private pointHistory: Array<{
    timestamp: number;
    old_points: number;
    new_points: number;
    change: number;
    reason: string;
  }> = [];

  constructor(config?: AngerConfig) {
    // Config will be loaded async, but we need it synchronously
    // So we'll load it in a sync way or use default
    this.config = config || this.getDefaultConfigSync();
  }

  /**
   * Initialize with async config loading
   */
  static async create(configPath?: string): Promise<AngerMeter> {
    const config = await loadAngerConfig(configPath);
    return new AngerMeter(config);
  }

  /**
   * Get default config synchronously (fallback)
   */
  private getDefaultConfigSync(): AngerConfig {
    return {
      anger_multiplier: 15.0,
      thresholds: { irritated: 12, agitated: 25, enraged: 50 },
      decay: { idle_rate: 0.3, time_decay_enabled: false, time_rate: 0.5, minimum_floor: 0 },
      bonuses: { consecutive_anger: 5, rapid_escalation: 3, vulgar_language: 8, direct_insults: 12 },
      penalties: { apology_reduction: -15, calm_language: -3, positive_emotion: -8 },
      meter: { max_points: 100, escalation_cooldown: 2, de_escalation_immediate: true },
      de_escalation: { enraged_apology_requirement: 2, apology_memory_limit: 5, reset_apology_count_on_anger: true },
      debug: { show_meter_in_response: true, log_point_changes: true }
    };
  }

  /**
   * Process a message and update anger meter
   */
  processMessage(
    message: string,
    sentimentAnalysis: SentimentAnalysis
  ): [string, AngerMeterInfo] {
    const currentTime = Date.now();
    this.messageCount += 1;

    // Apply time-based decay if enabled
    if (this.config.decay.time_decay_enabled) {
      const timePassed = (currentTime - this.lastMessageTime) / 60000; // minutes
      const timeDecay = timePassed * this.config.decay.time_rate;
      this.adjustPoints(-timeDecay, 'time_decay');
    }

    // Calculate base points from sentiment
    const emotion = sentimentAnalysis.emotion || 'neutral';
    let intensity = sentimentAnalysis.intensity || 0.0;

    let pointsChange = 0.0;
    const changeReasons: string[] = [];

    // Check if this is an anger-related emotion OR contains vulgar/insulting language
    const angerEmotions = ['anger', 'frustration', 'irritation', 'rage', 'annoyance'];
    let isAngry = angerEmotions.includes(emotion);
    const hasVulgarLanguage = this.containsVulgarLanguage(message);
    const hasDirectInsults = this.containsDirectInsults(message);

    // Force anger detection if vulgar/insulting language is present
    if (hasVulgarLanguage || hasDirectInsults) {
      isAngry = true;
      if (!angerEmotions.includes(emotion)) {
        intensity = Math.max(intensity, 0.7); // Force minimum anger intensity
        changeReasons.push('forced_anger_detection');
      }
    }

    if (isAngry) {
      // Reset apology count if user gets angry again
      this.resetApologyCountIfAngry(true);

      // Base points from anger intensity
      const basePoints = intensity * this.config.anger_multiplier;
      pointsChange += basePoints;
      changeReasons.push(`anger_base: +${basePoints.toFixed(1)}`);

      // Consecutive anger bonus
      if (this.lastEmotion && angerEmotions.includes(this.lastEmotion)) {
        this.consecutiveAngerCount += 1;
        const bonus = this.config.bonuses.consecutive_anger;
        pointsChange += bonus;
        changeReasons.push(`consecutive_anger: +${bonus}`);
      } else {
        this.consecutiveAngerCount = 1;
      }

      // Check for vulgar language
      if (hasVulgarLanguage) {
        const vulgarBonus = this.config.bonuses.vulgar_language;
        pointsChange += vulgarBonus;
        changeReasons.push(`vulgar_language: +${vulgarBonus}`);
      }

      // Check for direct insults
      if (hasDirectInsults) {
        const insultBonus = this.config.bonuses.direct_insults;
        pointsChange += insultBonus;
        changeReasons.push(`direct_insults: +${insultBonus}`);
      }
    } else {
      // Not angry - apply decay and check for penalties
      this.consecutiveAngerCount = 0;

      // Idle decay
      const idleDecay = this.config.decay.idle_rate;
      pointsChange -= idleDecay;
      changeReasons.push(`idle_decay: -${idleDecay}`);

      // Check for apology
      if (this.containsApology(message)) {
        const apologyPenalty = this.config.penalties.apology_reduction;
        pointsChange += apologyPenalty; // apology_reduction is negative
        changeReasons.push(`apology: ${apologyPenalty}`);

        // Track apology for de-escalation logic
        this.trackApology();
      }

      // Check for positive emotions
      const positiveEmotions = ['joy', 'happiness', 'excitement', 'enthusiasm'];
      if (positiveEmotions.includes(emotion)) {
        const positivePenalty = this.config.penalties.positive_emotion;
        pointsChange += positivePenalty; // positive_emotion is negative
        changeReasons.push(`positive_emotion: ${positivePenalty}`);
      }

      // Check for calm language
      if (this.containsCalmLanguage(message)) {
        const calmPenalty = this.config.penalties.calm_language;
        pointsChange += calmPenalty; // calm_language is negative
        changeReasons.push(`calm_language: ${calmPenalty}`);
      }
    }

    // Apply points change
    this.adjustPoints(pointsChange, changeReasons.join(', '));

    // Determine agent based on current anger level (includes de-escalation blocking)
    const newAgent = this.determineAgent();

    // Check if de-escalation was blocked/forced and add to change reasons
    let deEscalationNote = '';
    if (this.enragedDeEscalationBlocked && this.currentLevel === 'enraged') {
      deEscalationNote = `de_escalation_blocked: need ${this.getApologiesNeeded()} more apologies`;
      changeReasons.push(deEscalationNote);
    } else if (this.currentLevel !== 'enraged' && this.apologyCount >= this.config.de_escalation.enraged_apology_requirement) {
      deEscalationNote = `de_escalation_forced: ${this.apologyCount} apologies received`;
      changeReasons.push(deEscalationNote);
    }

    // Update cooldown
    if (this.escalationCooldownRemaining > 0) {
      this.escalationCooldownRemaining -= 1;
    }

    // Update state
    this.lastEmotion = emotion;
    this.lastMessageTime = currentTime;

    // Prepare meter info for response
    const meterInfo: AngerMeterInfo = {
      anger_points: Math.round(this.angerPoints * 10) / 10,
      anger_level: newAgent as 'normal' | 'irritated' | 'agitated' | 'enraged',
      points_change: Math.round(pointsChange * 10) / 10,
      change_reasons: changeReasons,
      consecutive_anger: this.consecutiveAngerCount,
      message_count: this.messageCount,
      thresholds: this.config.thresholds,
      max_points: this.config.meter.max_points,
    };

    // Add debug info if enabled
    if (this.config.debug.show_meter_in_response) {
      meterInfo.debug = {
        last_emotion: this.lastEmotion || undefined,
        escalation_cooldown: this.escalationCooldownRemaining,
        point_history: this.pointHistory.slice(-5), // Last 5 changes
        apology_count: this.apologyCount,
        apologies_needed: this.currentLevel === 'enraged' ? this.getApologiesNeeded() : 0,
        de_escalation_blocked: this.enragedDeEscalationBlocked,
      };
    }

    return [newAgent, meterInfo];
  }

  /**
   * Adjust anger points and log the change
   */
  private adjustPoints(change: number, reason: string): void {
    const oldPoints = this.angerPoints;
    this.angerPoints += change;

    // Apply bounds
    const maxPoints = this.config.meter.max_points;
    const minPoints = this.config.decay.minimum_floor;
    this.angerPoints = Math.max(minPoints, Math.min(maxPoints, this.angerPoints));

    // Log change if enabled
    if (this.config.debug.log_point_changes) {
      this.pointHistory.push({
        timestamp: Date.now(),
        old_points: Math.round(oldPoints * 10) / 10,
        new_points: Math.round(this.angerPoints * 10) / 10,
        change: Math.round(change * 10) / 10,
        reason,
      });

      // Keep only last 20 records
      if (this.pointHistory.length > 20) {
        this.pointHistory = this.pointHistory.slice(-20);
      }
    }
  }

  /**
   * Determine which agent to use based on current anger points
   */
  private determineAgent(): string {
    const thresholds = this.config.thresholds;

    let newLevel: 'normal' | 'irritated' | 'agitated' | 'enraged';
    if (this.angerPoints >= thresholds.enraged) {
      newLevel = 'enraged';
    } else if (this.angerPoints >= thresholds.agitated) {
      newLevel = 'agitated';
    } else if (this.angerPoints >= thresholds.irritated) {
      newLevel = 'irritated';
    } else {
      newLevel = 'normal';
    }

    // ENFORCE GRADUAL ESCALATION: No direct jumps from normal to enraged
    const currentRank = this.getLevelRank(this.currentLevel);
    const newRank = this.getLevelRank(newLevel);

    if (currentRank === 0 && newRank === 3) {
      // normal (0) -> enraged (3)
      newLevel = 'agitated'; // Cap at agitated instead
    } else if (currentRank === 1 && newRank === 3) {
      // irritated (1) -> enraged (3)
      newLevel = 'agitated'; // Cap at agitated instead
    }

    // Check escalation cooldown
    if (
      newLevel !== this.currentLevel &&
      this.getLevelRank(newLevel) > this.getLevelRank(this.currentLevel) &&
      this.escalationCooldownRemaining > 0
    ) {
      // Still in cooldown, can't escalate
      newLevel = this.currentLevel;
    }

    // Check de-escalation blocking/forcing for enraged state
    if (this.currentLevel === 'enraged') {
      if (this.canDeEscalateFromEnraged()) {
        // Force de-escalation with 2+ apologies, regardless of points
        if (newLevel === 'enraged') {
          // Calculate what level they should be if not enraged
          if (this.angerPoints >= thresholds.agitated) {
            newLevel = 'agitated';
          } else if (this.angerPoints >= thresholds.irritated) {
            newLevel = 'irritated';
          } else {
            newLevel = 'normal';
          }
        }
      } else if (newLevel !== 'enraged') {
        // Block de-escalation if not enough apologies
        newLevel = 'enraged'; // Force stay in enraged
        this.enragedDeEscalationBlocked = true;
      }
    }

    // ENFORCE GRADUAL DE-ESCALATION: No direct jumps from high anger to normal
    const finalCurrentRank = this.getLevelRank(this.currentLevel);
    const finalNewRank = this.getLevelRank(newLevel);

    // Prevent enraged → normal (must go through agitated first)
    if (finalCurrentRank === 3 && finalNewRank === 0) {
      // enraged (3) -> normal (0)
      newLevel = 'agitated'; // Force intermediate step
    }
    // Prevent agitated → normal (must go through irritated first)
    else if (finalCurrentRank === 2 && finalNewRank === 0) {
      // agitated (2) -> normal (0)
      newLevel = 'irritated'; // Force intermediate step
    }

    // Update current level and reset cooldown if escalating
    if (this.getLevelRank(newLevel) > this.getLevelRank(this.currentLevel)) {
      this.escalationCooldownRemaining = this.config.meter.escalation_cooldown;
    }
    this.currentLevel = newLevel;

    return newLevel;
  }

  /**
   * Get numeric rank for anger level (higher = more angry)
   */
  private getLevelRank(level: string): number {
    const ranks: Record<string, number> = { normal: 0, irritated: 1, agitated: 2, enraged: 3 };
    return ranks[level] || 0;
  }

  /**
   * Check if message contains vulgar/offensive language
   */
  private containsVulgarLanguage(message: string): boolean {
    const vulgarPatterns = [
      /\b(fuck|shit|damn|hell|ass|bitch|crap|bastard|piss)\b/i,
      /\b(stupid|idiot|moron|dumb|retard)\b/i,
      /[!]{2,}/, // Multiple exclamation marks
      /[A-Z]{4,}/, // All caps words (4+ letters)
    ];

    const messageLower = message.toLowerCase();
    return vulgarPatterns.some((pattern) => pattern.test(messageLower) || pattern.test(message));
  }

  /**
   * Check if message contains direct personal insults/attacks
   */
  private containsDirectInsults(message: string): boolean {
    const insultPatterns = [
      /\b(suck my|go fuck|fuck you|screw you)\b/i,
      /\b(eat shit|kiss my ass|blow me)\b/i,
      /\b(you suck|you're stupid|you're an idiot|you are stupid|you are an idiot)\b/i,
      /\b(shut up|shut the fuck up)\b/i,
      /\b(dickhead|asshole|piece of shit)\b/i,
      /(balls|dick|cock)(?=\s|$)/i, // Sexual references
      /\b(fucking idiot|fucking moron|fucking stupid)\b/i, // Combined vulgar + insult
    ];

    const messageLower = message.toLowerCase();
    return insultPatterns.some((pattern) => pattern.test(messageLower) || pattern.test(message));
  }

  /**
   * Check if message contains an apology
   */
  private containsApology(message: string): boolean {
    const apologyPatterns = [
      /\b(sorry|apologize|apologies|my bad|forgive me)\b/i,
      /\b(didn't mean|excuse me|pardon)\b/i,
    ];

    const messageLower = message.toLowerCase();
    return apologyPatterns.some((pattern) => pattern.test(messageLower));
  }

  /**
   * Check if message contains calm/peaceful language
   */
  private containsCalmLanguage(message: string): boolean {
    const calmPatterns = [
      /\b(please|thank you|thanks|appreciate)\b/i,
      /\b(calm|peaceful|relax|chill)\b/i,
      /\b(understand|respect|agree)\b/i,
    ];

    const messageLower = message.toLowerCase();
    return calmPatterns.some((pattern) => pattern.test(messageLower));
  }

  /**
   * Track an apology for de-escalation purposes
   */
  private trackApology(): void {
    this.apologyCount += 1;
    this.recentApologies.push(this.messageCount);

    // Clean up old apologies beyond memory limit
    const memoryLimit = this.config.de_escalation.apology_memory_limit;
    const cutoffMessage = this.messageCount - memoryLimit;
    this.recentApologies = this.recentApologies.filter((msgNum) => msgNum > cutoffMessage);

    // Update apology count based on recent apologies
    this.apologyCount = this.recentApologies.length;
  }

  /**
   * Check if enough apologies have been made to allow de-escalation from enraged
   */
  private canDeEscalateFromEnraged(): boolean {
    if (this.currentLevel !== 'enraged') {
      return true; // Not enraged, can always de-escalate
    }

    const requiredApologies = this.config.de_escalation.enraged_apology_requirement;
    return this.apologyCount >= requiredApologies;
  }

  /**
   * Get number of additional apologies needed for de-escalation
   */
  private getApologiesNeeded(): number {
    if (this.currentLevel !== 'enraged') {
      return 0;
    }

    const requiredApologies = this.config.de_escalation.enraged_apology_requirement;
    return Math.max(0, requiredApologies - this.apologyCount);
  }

  /**
   * Reset apology count if user gets angry again
   */
  private resetApologyCountIfAngry(isAngry: boolean): void {
    const resetOnAnger = this.config.de_escalation.reset_apology_count_on_anger;

    if (isAngry && resetOnAnger && this.apologyCount > 0) {
      this.apologyCount = 0;
      this.recentApologies = [];
      this.enragedDeEscalationBlocked = true;
    }
  }

  /**
   * Reset the anger meter to initial state
   */
  resetMeter(): void {
    this.angerPoints = 0.0;
    this.currentLevel = 'normal';
    this.consecutiveAngerCount = 0;
    this.escalationCooldownRemaining = 0;
    this.apologyCount = 0;
    this.recentApologies = [];
    this.enragedDeEscalationBlocked = false;
    this.pointHistory = [];
    this.messageCount = 0;
    this.lastEmotion = null;
  }

  /**
   * Get current meter status for debugging
   */
  getMeterStatus(): {
    anger_points: number;
    current_level: string;
    consecutive_anger: number;
    cooldown_remaining: number;
    message_count: number;
    thresholds: { irritated: number; agitated: number; enraged: number };
    apology_count: number;
    apologies_needed: number;
  } {
    return {
      anger_points: Math.round(this.angerPoints * 10) / 10,
      current_level: this.currentLevel,
      consecutive_anger: this.consecutiveAngerCount,
      cooldown_remaining: this.escalationCooldownRemaining,
      message_count: this.messageCount,
      thresholds: this.config.thresholds,
      apology_count: this.apologyCount,
      apologies_needed: this.currentLevel === 'enraged' ? this.getApologiesNeeded() : 0,
    };
  }

  /**
   * Serialize state for stateless serverless design
   */
  serializeState(): EmotionState {
    return {
      anger_points: this.angerPoints,
      current_agent: this.currentLevel,
      emotional_history: [], // Will be managed by orchestrator
      ended: false,
      consecutive_anger_count: this.consecutiveAngerCount,
      last_emotion: this.lastEmotion || undefined,
      escalation_cooldown_remaining: this.escalationCooldownRemaining,
      apology_count: this.apologyCount,
      recent_apologies: [...this.recentApologies],
      enraged_de_escalation_blocked: this.enragedDeEscalationBlocked,
    };
  }

  /**
   * Deserialize state from client
   */
  deserializeState(state: EmotionState): void {
    this.angerPoints = state.anger_points;
    this.currentLevel = state.current_agent as 'normal' | 'irritated' | 'agitated' | 'enraged';
    this.consecutiveAngerCount = state.consecutive_anger_count;
    this.lastEmotion = state.last_emotion || null;
    this.escalationCooldownRemaining = state.escalation_cooldown_remaining;
    this.apologyCount = state.apology_count;
    this.recentApologies = [...state.recent_apologies];
    this.enragedDeEscalationBlocked = state.enraged_de_escalation_blocked;
  }
}

