// SASI-KORA Server - Emotion Engine Test Server
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import emotionalStateRoutes from './dist/api/emotional-state.js';
import configRoutes from './dist/api/config.js';
import elevenLabsRoutes from './dist/api/elevenlabs-tts.js';
import gladiaRoutes from './dist/api/gladia-stt.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8888;

// Detect if running on Vercel
const isVercel =
  process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

// Trust Vercel reverse proxy (required for sessions to work on Vercel)
if (isVercel) {
  app.set('trust proxy', 1);
}

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true, // Allow cookies to be sent
  })
);
app.use(express.json());

// Cookie parser middleware (simple version) - must run first
app.use((req, res, next) => {
  if (!req.cookies) {
    req.cookies = {};
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie) => {
        const parts = cookie.trim().split('=');
        if (parts.length === 2) {
          req.cookies[parts[0].trim()] = decodeURIComponent(parts[1]);
        }
      });
    }
  }
  next();
});

// Cookie-based session helper (for serverless compatibility)
const sessionSecret =
  process.env.SESSION_SECRET || 'default-secret-change-in-production-change-me';
const getSessionKey = () => {
  return crypto.createHash('sha256').update(sessionSecret).digest();
};

const encryptSession = (data) => {
  const key = getSessionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decryptSession = (encryptedData) => {
  try {
    if (!encryptedData) return null;
    const key = getSessionKey();
    const parts = encryptedData.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    return null;
  }
};

// Cookie-based session middleware (works with serverless)
const cookieName = 'auth_session';
app.use((req, res, next) => {
  // Get session from cookie
  const cookie = req.cookies?.[cookieName];

  if (cookie) {
    req.session = decryptSession(cookie) || {};
  } else {
    req.session = {};
  }

  // Save session before sending response
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  const originalEnd = res.end.bind(res);
  const originalRedirect = res.redirect.bind(res);

  const saveSession = () => {
    // Don't try to save session if headers have already been sent
    if (res.headersSent) {
      return;
    }

    if (req.session && Object.keys(req.session).length > 0) {
      const encrypted = encryptSession(req.session);
      res.cookie(cookieName, encrypted, {
        httpOnly: true,
        secure: isVercel,
        sameSite: isVercel ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
    } else if (cookie) {
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: isVercel,
        sameSite: isVercel ? 'none' : 'lax',
      });
    }
  };

  res.send = function (...args) {
    saveSession();
    return originalSend(...args);
  };

  res.json = function (...args) {
    saveSession();
    return originalJson(...args);
  };

  res.end = function (...args) {
    // Only save session if headers haven't been sent (for static files, headers are sent before end)
    if (!res.headersSent) {
      saveSession();
    }
    return originalEnd(...args);
  };

  res.redirect = function (...args) {
    saveSession();
    return originalRedirect(...args);
  };

  next();
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  // Redirect to login for HTML pages, return 401 for API calls
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
  return res.redirect('/login');
};

// Static files (accessible without auth)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// Public routes (no authentication required)
app.get('/login', (req, res) => {
  // If already authenticated, redirect to home
  if (req.session && req.session.authenticated) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Login API endpoint (public)
app.post('/api/login', (req, res) => {
  const { userId, password } = req.body;

  // Get credentials from environment variables
  const validUserId = process.env.LOGIN_USER_ID || 'admin';
  const validPassword = process.env.LOGIN_PASSWORD || 'password123';

  // Validate credentials
  if (userId === validUserId && password === validPassword) {
    // Set session
    req.session.authenticated = true;
    req.session.userId = userId;

    res.json({
      success: true,
      message: 'Login successful',
      redirect: '/',
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid user ID or password',
    });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  // Clear session
  req.session = {};
  // Clear cookie
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: isVercel,
    sameSite: isVercel ? 'none' : 'lax',
  });
  res.json({
    success: true,
    message: 'Logged out successfully',
    redirect: '/login',
  });
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: !!(req.session && req.session.authenticated),
    userId: req.session?.userId || null,
  });
});

// Protected routes (require authentication)
// Serve navigation.html - DEFAULT ROUTE
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'navigation.html'));
});

// Serve persona-selection.html - available at /persona-selection
app.get('/persona-selection', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'persona-selection.html'));
});

// Serve avatar-ui.html (with ReadyPlayerMe avatar) - available at /avatar
app.get('/avatar', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'avatar-ui.html'));
});

// Serve training-hub.html - available at /training-hub
app.get('/training-hub', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'training-hub.html'));
});

// Serve quiz1.html - available at /quiz1
app.get('/quiz1', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'quiz1.html'));
});

// Serve chat-ui.html (text-only testing) - available at /chat
app.get('/chat', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-ui.html'));
});

// Serve feedback-training-report.html - available at /feedback-training-report
app.get('/feedback-training-report', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'feedback-training-report.html'));
});

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'SASI-KORA Emotion Engine',
    timestamp: new Date().toISOString(),
  });
});

// Protected API routes (require authentication)
app.use('/api/emotional-state', requireAuth, emotionalStateRoutes);
app.use('/api/config', requireAuth, configRoutes);
app.use('/api/elevenlabs', requireAuth, elevenLabsRoutes);
app.use('/api/gladia', requireAuth, gladiaRoutes);

// Export app for Vercel (serverless)
export default app;

// Start server locally (only if not in Vercel environment)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 SASI-KORA Server Started!`);
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🔐 Login: http://localhost:${PORT}/login`);
    console.log(`🧭 Navigation: http://localhost:${PORT}/ (protected)`);
    console.log(`🎭 Avatar UI: http://localhost:${PORT}/avatar (protected)`);
    console.log(
      `🎓 Training Hub: http://localhost:${PORT}/training-hub (protected)`
    );
    console.log(`💬 Chat UI: http://localhost:${PORT}/chat (protected)`);
    console.log(`🔊 Health: http://localhost:${PORT}/api/health`);
    console.log(
      `💬 Emotion Engine: http://localhost:${PORT}/api/emotional-state/chat (protected)`
    );
    console.log('');
    console.log('✨ Emotion Engine Ready!');
    console.log('🔒 All routes are protected. Login required to access.');
  });
}
