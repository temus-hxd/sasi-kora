/**
 * Agent Factory
 * Creates agents by name with lazy initialization
 */

import type { AgentType } from '../types.js';
import { SentimentAgent } from './sentiment-agent.js';
import { NormalAgent } from './normal-agent.js';
import {
  HappyLevel1PleasedAgent,
  HappyLevel2CheerfulAgent,
  HappyLevel3EcstaticAgent,
} from './happy-agents.js';
import {
  SadLevel1MelancholyAgent,
  SadLevel2SorrowfulAgent,
  SadLevel3DepressedAgent,
} from './sad-agents.js';
import {
  AngryLevel1IrritatedAgent,
  AngryLevel2AgitatedAgent,
  AngryLevel3EnragedAgent,
} from './angry-agents.js';
import { BaseAgent } from './base-agent.js';

type AgentInstance = BaseAgent | SentimentAgent;

/**
 * Agent Factory - Creates and manages agent instances
 */
export class AgentFactory {
  private agents: Map<string, AgentInstance> = new Map();
  private clientName?: string;
  private language?: string; // 'en' or 'cn'

  constructor(clientName?: string, language?: string) {
    this.clientName = clientName || process.env.CLIENT_NAME || 'synapse';
    this.language = language || 'en';
  }

  /**
   * Set language for all agents
   */
  setLanguage(language: string): void {
    this.language = language;
    // Clear cache so agents are recreated with new language
    this.clearCache();
  }

  /**
   * Get or create an agent by name
   */
  async getAgent(agentName: string): Promise<AgentInstance> {
    // Normalize agent name
    const normalizedName = this.normalizeAgentName(agentName);

    // Check cache
    if (this.agents.has(normalizedName)) {
      const agent = this.agents.get(normalizedName)!;
      await agent.initialize();
      return agent;
    }

    // Create new agent
    const agent = this.createAgent(normalizedName);
    await agent.initialize();
    this.agents.set(normalizedName, agent);

    return agent;
  }

  /**
   * Normalize agent name to standard format
   */
  private normalizeAgentName(name: string): string {
    const nameMap: Record<string, string> = {
      normal: 'normal',
      pleased: 'pleased',
      cheerful: 'cheerful',
      ecstatic: 'ecstatic',
      melancholy: 'melancholy',
      sorrowful: 'sorrowful',
      depressed: 'depressed',
      irritated: 'irritated',
      agitated: 'agitated',
      enraged: 'enraged',
      sentiment: 'sentiment',
    };

    return nameMap[name.toLowerCase()] || 'normal';
  }

  /**
   * Create agent instance by name
   */
  private createAgent(agentName: string): AgentInstance {
    switch (agentName) {
      case 'sentiment':
        return new SentimentAgent(this.clientName);

      case 'normal':
        return new NormalAgent(this.clientName, this.language);

      case 'pleased':
        return new HappyLevel1PleasedAgent(this.clientName, this.language);
      case 'cheerful':
        return new HappyLevel2CheerfulAgent(this.clientName, this.language);
      case 'ecstatic':
        return new HappyLevel3EcstaticAgent(this.clientName, this.language);

      case 'melancholy':
        return new SadLevel1MelancholyAgent(this.clientName, this.language);
      case 'sorrowful':
        return new SadLevel2SorrowfulAgent(this.clientName, this.language);
      case 'depressed':
        return new SadLevel3DepressedAgent(this.clientName, this.language);

      case 'irritated':
        return new AngryLevel1IrritatedAgent(this.clientName, this.language);
      case 'agitated':
        return new AngryLevel2AgitatedAgent(this.clientName, this.language);
      case 'enraged':
        return new AngryLevel3EnragedAgent(this.clientName, this.language);

      default:
        console.warn(`Unknown agent name: ${agentName}, defaulting to normal`);
        return new NormalAgent(this.clientName, this.language);
    }
  }

  /**
   * Get sentiment agent (convenience method)
   */
  async getSentimentAgent(): Promise<SentimentAgent> {
    return (await this.getAgent('sentiment')) as SentimentAgent;
  }

  /**
   * Clear agent cache (useful for testing or reloading)
   */
  clearCache(): void {
    this.agents.clear();
  }

  /**
   * Get all available agent names
   */
  getAvailableAgents(): AgentType[] {
    return [
      'normal',
      'pleased',
      'cheerful',
      'ecstatic',
      'melancholy',
      'sorrowful',
      'depressed',
      'irritated',
      'agitated',
      'enraged',
    ];
  }
}

