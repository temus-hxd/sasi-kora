/**
 * Config API Routes
 * Provides avatar URL and voice ID for ReadyPlayerMe integration
 */

import { Router } from 'express';

const router = Router();

/**
 * GET /api/config
 * Returns avatar URL and voice ID from environment variables
 * Accepts optional ?lang=en or ?lang=cn query parameter
 */
router.get('/', (req, res) => {
  try {
    // Use local avatar file from public/avatar directory, with fallback to env variables
    const avatarUrl =
      process.env.READYPLAYERME_AVATAR_URL ||
      process.env.AVATAR_URL ||
      '/avatar/691325ffff586a2a2794a92c.glb';
    const lang = (req.query.lang as string) || 'en'; // Default to 'en'

    // Get voice ID based on language
    let voiceId: string | undefined;
    if (lang === 'cn') {
      voiceId = process.env.VOICE_ID_CN;
    } else {
      voiceId = process.env.VOICE_ID_EN || process.env.VOICE_ID;
    }

    if (!avatarUrl || !voiceId) {
      res.status(500).json({
        error: 'Configuration missing',
        message: `Please set VOICE_ID${
          lang === 'cn' ? '_CN' : '_EN'
        } in your .env file. Avatar URL defaults to local file if not set.`,
      });
      return;
    }

    res.json({
      avatarUrl,
      voiceId,
      language: lang,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({
      error: 'Failed to load configuration',
      message: err.message,
    });
  }
});

export default router;
