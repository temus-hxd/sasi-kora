/**
 * Normal Agent
 * Balanced, professional responses for neutral emotions
 */

import { BaseAgent } from './base-agent.js';
import type { ChatMessage } from '../types.js';

export class NormalAgent extends BaseAgent {
  constructor(clientName?: string) {
    super({
      promptFile: 'normal_agent.md',
      modelEnvVar: 'MODEL_NORMAL',
      clientName,
    });
  }

  /**
   * Generate balanced, professional response
   */
  async generateResponse(messages: ChatMessage[]): Promise<string> {
    await this.ensureInitialized();
    return await this.callGroq(messages);
  }
}

