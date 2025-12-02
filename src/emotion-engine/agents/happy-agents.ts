/**
 * Happy Agents
 * Three levels of happiness: Pleased (L1), Cheerful (L2), Ecstatic (L3)
 */

import { BaseAgent } from './base-agent.js';
import type { ChatMessage } from '../types.js';

export class HappyLevel1PleasedAgent extends BaseAgent {
  constructor(clientName?: string, language?: string) {
    super({
      promptFile: 'happy-1-pleased.md',
      modelEnvVar: 'MODEL_PLEASED',
      clientName,
      language,
    });
  }

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    await this.ensureInitialized();
    return await this.callGroq(messages);
  }
}

export class HappyLevel2CheerfulAgent extends BaseAgent {
  constructor(clientName?: string, language?: string) {
    super({
      promptFile: 'happy-2-cheerful.md',
      modelEnvVar: 'MODEL_CHEERFUL',
      clientName,
      language,
    });
  }

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    await this.ensureInitialized();
    return await this.callGroq(messages);
  }
}

export class HappyLevel3EcstaticAgent extends BaseAgent {
  constructor(clientName?: string, language?: string) {
    super({
      promptFile: 'happy-3-ecstatic.md',
      modelEnvVar: 'MODEL_ECSTATIC',
      clientName,
      language,
    });
  }

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    await this.ensureInitialized();
    return await this.callGroq(messages);
  }
}
