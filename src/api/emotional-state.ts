/**
 * Emotional State API Routes
 * Handles /api/emotional-state/* endpoints
 */

import { Router } from 'express';
import { Orchestrator } from '../emotion-engine/orchestrator.js';
import { StateManager } from '../emotion-engine/utils/state-manager.js';
import type { ChatRequest, ChatResponse } from '../emotion-engine/types.js';

const router = Router();

// Create orchestrator instance (singleton pattern for serverless)
// Store orchestrators by language to support language switching
const orchestratorInstances: Map<string, Orchestrator> = new Map();

/**
 * Get or create orchestrator instance for a specific language
 */
async function getOrchestrator(language: string = 'en'): Promise<Orchestrator> {
  // Normalize language
  const lang = language === 'cn' ? 'cn' : 'en';

  if (!orchestratorInstances.has(lang)) {
    const orchestrator = new Orchestrator(undefined, lang);
    await orchestrator.initialize();
    orchestratorInstances.set(lang, orchestrator);
  }

  const instance = orchestratorInstances.get(lang);
  if (!instance) {
    throw new Error('Failed to initialize orchestrator');
  }
  return instance;
}

/**
 * POST /api/emotional-state/chat
 * Main chat endpoint
 */
router.post('/chat', async (req, res) => {
  try {
    const request: ChatRequest = req.body;

    if (!request.message) {
      res.status(400).json({
        error: 'Message is required',
        success: false,
      });
      return;
    }

    // Get language from request (default to 'en')
    const language = request.language || 'en';

    // Get conversation history from client (or empty list for new conversation)
    const conversationHistory = request.history || [];

    // Get orchestrator instance for the specified language
    const orchestrator = await getOrchestrator(language);

    // Check if this is a new conversation
    if (StateManager.isNewConversation(conversationHistory)) {
      console.log(
        `🆕 New conversation ${request.conversation_id?.substring(0, 8) || 'default'}... - resetting orchestrator state`
      );
      orchestrator.resetState();
    }

    // Deserialize emotion state if provided (for stateless serverless)
    const emotionState = request.emotion_state
      ? StateManager.deserializeState(request.emotion_state)
      : undefined;

    // Process message through orchestrator
    console.log('⏱️  [TRACE] Starting orchestrator.processMessage()');
    const [responseContent, agentType, analysisData, updatedState] =
      await orchestrator.processMessage(
        request.message,
        conversationHistory,
        emotionState
      );

    // Generate conversation ID if not provided
    const conversationId = request.conversation_id || `conv-${Date.now()}`;

    // Extract emoji for avatar control from response
    // Emoji should be the first emoji after </t> tag (thinking tag)
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]/gu;
    const emojis = responseContent.match(emojiRegex) || [];
    let avatarEmoji = emojis[0] || null;

    // Map agent types to emoji if no emoji found in response
    if (!avatarEmoji) {
      const agentEmojiMap: Record<string, string> = {
        normal: '😐',
        pleased: '😊',
        cheerful: '😄',
        ecstatic: '😍',
        melancholy: '😔',
        sorrowful: '😢',
        depressed: '😞',
        irritated: '😤',
        agitated: '😠',
        enraged: '😡',
      };
      avatarEmoji = agentEmojiMap[agentType] || '😐';
    }

    // Create response
    const response: ChatResponse = {
      response: responseContent,
      conversation_id: conversationId,
      agent_type: agentType,
      timestamp: new Date().toISOString(),
      sentiment_analysis: analysisData.sentiment_analysis,
      orchestrator_decision: analysisData.orchestrator_decision,
      orchestrator_insights: analysisData.orchestrator_insights,
      emotion_state: StateManager.serializeState(updatedState), // Return state for client to store
      avatar_emoji: avatarEmoji, // Emoji for ReadyPlayerMe avatar control
    };

    res.json(response);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Error in /api/emotional-state/chat:', err);
    console.error('Stack:', err.stack);

    // Provide more helpful error messages
    let errorMessage = err.message;
    let statusCode = 500;

    if (
      err.message.includes('model_not_found') ||
      err.message.includes('does not exist')
    ) {
      statusCode = 400;
      errorMessage = `Invalid Groq model name. Please check your .env file. Error: ${err.message}`;
    } else if (err.message.includes('GROQ_API_KEY')) {
      statusCode = 500;
      errorMessage = 'GROQ_API_KEY is not set. Please check your .env file.';
    }

    res.status(statusCode).json({
      error: 'Error processing chat',
      message: errorMessage,
      success: false,
    });
  }
});

/**
 * GET /api/emotional-state/health
 * Health check endpoint
 */
router.get('/health', async (_req, res) => {
  try {
    const orchestrator = await getOrchestrator('en'); // Default to 'en' for health check
    const state = orchestrator.getCurrentState();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      env: {
        GROQ_API_KEY: !!process.env.GROQ_API_KEY,
        GROQ_MODEL: process.env.GROQ_MODEL || 'not set',
        CLIENT_NAME: process.env.CLIENT_NAME || 'synapse',
      },
      orchestrator: {
        current_agent: state.current_agent,
        anger_points: state.anger_points,
        ended: state.ended,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({
      status: 'degraded',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/emotional-state/reset
 * Reset orchestrator state
 */
router.post('/reset', async (req, res) => {
  try {
    const language = (req.body as any).language || 'en';
    const orchestrator = await getOrchestrator(language);
    orchestrator.resetState();
    const state = orchestrator.getCurrentState();

    res.json({
      message: 'State reset successfully (client should clear localStorage)',
      timestamp: new Date().toISOString(),
      current_agent: state.current_agent,
      anger_points: state.anger_points,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({
      error: 'Error resetting state',
      message: err.message,
      success: false,
    });
  }
});

/**
 * POST /api/emotional-state/sentiment-prompts
 * Toggle/include additional prompts in sentiment agent
 */
router.post('/sentiment-prompts', async (req, res) => {
  try {
    const { include, language } = req.body as {
      include: boolean;
      language?: string;
    };

    if (typeof include !== 'boolean') {
      res.status(400).json({
        error: 'Invalid request',
        message: 'include must be a boolean',
        success: false,
      });
      return;
    }

    const lang = language || 'en';
    const orchestrator = await getOrchestrator(lang);
    await orchestrator.setSentimentAgentAdditionalPrompts(include);

    res.json({
      success: true,
      message: `Additional prompts ${include ? 'enabled' : 'disabled'}`,
      timestamp: new Date().toISOString(),
      include,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({
      error: 'Error setting sentiment agent prompts',
      message: err.message,
      success: false,
    });
  }
});

export default router;
