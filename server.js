// SASI-KORA Server - Emotion Engine Test Server
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import session from 'express-session';
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

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true, // Allow cookies to be sent
  })
);
app.use(express.json());

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
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error logging out',
      });
    }
    res.json({
      success: true,
      message: 'Logged out successfully',
      redirect: '/login',
    });
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

// Serve avatar-ui.html (with ReadyPlayerMe avatar) - available at /avatar
app.get('/avatar', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'avatar-ui.html'));
});

// Serve training-hub.html - available at /training-hub
app.get('/training-hub', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'training-hub.html'));
});

// Serve chat-ui.html (text-only testing) - available at /chat
app.get('/chat', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-ui.html'));
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
    console.log(`🎓 Training Hub: http://localhost:${PORT}/training-hub (protected)`);
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
