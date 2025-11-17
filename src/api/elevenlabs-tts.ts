/**
 * ElevenLabs TTS API Routes
 * Handles text-to-speech conversion with lip-sync data
 */

import { Router } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = process.env.VOICE_ID || process.env.ELEVENLABS_VOICE_ID;

/**
 * Clean text for TTS (remove emojis, thinking tags)
 */
function cleanTextForTTS(text: string): string {
  return text
    // Remove thinking tags <t>...</t>
    .replace(/<t>[\s\S]*?<\/t>/gi, '')
    // Remove emojis
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * POST /api/elevenlabs/tts
 * Generate TTS audio with lip-sync data
 */
router.post('/tts', async (req, res) => {
  try {
    const {
      text,
      voiceId = DEFAULT_VOICE_ID,
      emotion = 'neutral',
      modelId = 'eleven_multilingual_v2',
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0.0,
      speed = 0.75,
      speakerBoost = true,
      stream = true,
    } = req.body;

    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    if (!ELEVENLABS_API_KEY) {
      res.status(503).json({
        error: 'ElevenLabs API key not configured',
        success: false,
        demo: true,
      });
      return;
    }

    if (!voiceId || !DEFAULT_VOICE_ID) {
      res.status(503).json({
        error: 'Voice ID not configured. Please set VOICE_ID in your .env file',
        success: false,
      });
      return;
    }

    const cleanText = cleanTextForTTS(text);
    if (!cleanText) {
      res.status(400).json({ error: 'No valid text after cleaning' });
      return;
    }

    console.log(`🎤 ElevenLabs TTS Request: "${cleanText.substring(0, 50)}..." with voice ${voiceId}`);

    const apiUrl = stream
      ? `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`
      : `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: speakerBoost,
        },
        speed: Math.max(0.7, Math.min(1.2, speed)),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as any).detail?.message || `ElevenLabs API error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const audioBase64 = audioBuffer.toString('base64');

    // Estimate duration (client will use actual AudioBuffer.duration)
    const estimatedDuration = Math.max(1.0, audioBuffer.length / (128 * 1000 / 8) * 0.85);

    console.log(`✅ ElevenLabs TTS Success: ~${estimatedDuration.toFixed(2)}s audio`);

    res.json({
      success: true,
      audio: audioBase64,
      voice: voiceId,
      emotion,
      duration: estimatedDuration,
      provider: 'elevenlabs',
      streaming: stream,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ ElevenLabs TTS Error:', err);
    res.status(500).json({
      error: 'ElevenLabs TTS generation failed',
      details: err.message,
      success: false,
    });
  }
});

/**
 * GET /api/elevenlabs/health
 * Health check
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'ElevenLabs TTS API Running!',
    hasApiKey: !!ELEVENLABS_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

export default router;

