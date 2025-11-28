import { Router } from "express";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

const GLADIA_API_KEY = process.env.GLADIA_API_KEY;
const GLADIA_API_URL = process.env.GLADIA_API_URL || "https://api.gladia.io";

/**
 * GET /api/gladia/config
 * Returns Gladia configuration for frontend (API key is kept server-side)
 */
router.get("/config", (_req, res) => {
  if (!GLADIA_API_KEY) {
    res.status(503).json({
      error: "Gladia API key not configured",
      success: false,
      message: "Please set GLADIA_API_KEY in your .env file",
    });
    return;
  }

  // Return configuration without exposing API key directly
  // Frontend will use this endpoint to initialize Gladia session
  res.json({
    success: true,
    apiUrl: GLADIA_API_URL,
    // For multilingual support (Ah Meng: English, Chinese, Singlish)
    defaultLanguages: ["en", "zh"],
    codeSwitching: true,
    hasApiKey: !!GLADIA_API_KEY,
  });
});

/**
 * POST /api/gladia/session
 * Creates a new Gladia session and returns session token
 * This keeps the API key secure on the server
 */
router.post("/session", async (req, res) => {
  try {
    if (!GLADIA_API_KEY) {
      res.status(503).json({
        error: "Gladia API key not configured",
        success: false,
      });
      return;
    }

    const {
      languages = ["en", "zh"], // Default: English, Chinese
      codeSwitching = true,
      model = "solaria-1",
    } = req.body;

    const sessionConfig = {
      model,
      language_config: {
        languages,
        code_switching: codeSwitching,
      },
      encoding: "wav/pcm",
      sample_rate: 16000,
      bit_depth: 16,
      channels: 1,
    };

    // Start a Gladia live session
    const sessionResponse = await fetch(`${GLADIA_API_URL}/v2/live`, {
      method: "POST",
      headers: {
        "x-gladia-key": GLADIA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { raw: errorText };
      }

      console.error("❌ [GLADIA] API error response:", {
        status: sessionResponse.status,
        statusText: sessionResponse.statusText,
        errorData,
        rawResponse: errorText,
      });

      throw new Error(
        errorData.detail?.message ||
          errorData.message ||
          errorData.error ||
          `Gladia API error: ${sessionResponse.status} - ${errorText.substring(
            0,
            200
          )}`
      );
    }

    const sessionData = (await sessionResponse.json()) as {
      id?: string;
      session_id?: string;
      url?: string;
      websocket_url?: string;
      created_at?: string;
    };

    // Handle both response formats: Gladia uses 'id' and 'url', but we check for both
    const sessionId = sessionData.id || sessionData.session_id;
    const websocketUrl = sessionData.url || sessionData.websocket_url;

    if (!sessionId || !websocketUrl) {
      console.error("❌ [GLADIA] Invalid session response:", sessionData);
      throw new Error(
        "Invalid session response from Gladia API - missing id/session_id or url/websocket_url"
      );
    }

    res.json({
      success: true,
      sessionId,
      websocketUrl,
      // Return session config for frontend
      config: {
        languages,
        codeSwitching,
        model,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Gladia Session Error:", err);
    res.status(500).json({
      error: "Failed to create Gladia session",
      details: err.message,
      success: false,
    });
  }
});

/**
 * GET /api/gladia/health
 * Health check endpoint
 */
router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Gladia STT API Running!",
    hasApiKey: !!GLADIA_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

export default router;
