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

  constructor(clientName?: string) {
    this.clientName = clientName || process.env.CLIENT_NAME || 'synapse';
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
        return new NormalAgent(this.clientName);

      case 'pleased':
        return new HappyLevel1PleasedAgent(this.clientName);
      case 'cheerful':
        return new HappyLevel2CheerfulAgent(this.clientName);
      case 'ecstatic':
        return new HappyLevel3EcstaticAgent(this.clientName);

      case 'melancholy':
        return new SadLevel1MelancholyAgent(this.clientName);
      case 'sorrowful':
        return new SadLevel2SorrowfulAgent(this.clientName);
      case 'depressed':
        return new SadLevel3DepressedAgent(this.clientName);

      case 'irritated':
        return new AngryLevel1IrritatedAgent(this.clientName);
      case 'agitated':
        return new AngryLevel2AgitatedAgent(this.clientName);
      case 'enraged':
        return new AngryLevel3EnragedAgent(this.clientName);

      default:
        console.warn(`Unknown agent name: ${agentName}, defaulting to normal`);
        return new NormalAgent(this.clientName);
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

