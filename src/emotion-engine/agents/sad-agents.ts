/**
 * Sad Agents
 * Three levels of sadness: Melancholy (L1), Sorrowful (L2), Depressed (L3)
 */

import { BaseAgent } from './base-agent.js';
import type { ChatMessage } from '../types.js';

export class SadLevel1MelancholyAgent extends BaseAgent {
  constructor(clientName?: string) {
    super({
      promptFile: 'sad-1-melancholy.md',
      modelEnvVar: 'MODEL_MELANCHOLY',
      clientName,
    });
  }

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    await this.ensureInitialized();
    return await this.callGroq(messages);
  }
}

export class SadLevel2SorrowfulAgent extends BaseAgent {
  constructor(clientName?: string) {
    super({
      promptFile: 'sad-2-sorrowful.md',
      modelEnvVar: 'MODEL_SORROWFUL',
      clientName,
    });
  }

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    await this.ensureInitialized();
    return await this.callGroq(messages);
  }
}

export class SadLevel3DepressedAgent extends BaseAgent {
  constructor(clientName?: string) {
    super({
      promptFile: 'sad-3-depressed.md',
      modelEnvVar: 'MODEL_DEPRESSED',
      clientName,
    });
  }

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    await this.ensureInitialized();
    return await this.callGroq(messages);
  }
}

