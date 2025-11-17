// SASI-KORA Server - Emotion Engine Test Server
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8888;

// Middleware
app.use(cors());
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// Serve chat-ui.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-ui.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'SASI-KORA Emotion Engine',
    timestamp: new Date().toISOString()
  });
});

// Emotion engine API endpoint (will be implemented)
app.post('/api/emotional-state/chat', async (req, res) => {
  try {
    // TODO: Implement emotion engine
    res.json({
      response: 'Emotion engine not yet implemented',
      conversation_id: req.body.conversation_id || 'default',
      agent_type: 'normal',
      timestamp: new Date().toISOString(),
      sentiment_analysis: null,
      orchestrator_decision: null,
      orchestrator_insights: null
    });
  } catch (error) {
    console.error('Error in emotion engine:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Reset endpoint
app.post('/api/emotional-state/reset', (req, res) => {
  // TODO: Implement reset
  res.json({
    message: 'Reset endpoint not yet implemented',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SASI-KORA Server Started!`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🎭 Chat UI: http://localhost:${PORT}`);
  console.log(`🔊 Health: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('⚠️  Emotion engine not yet implemented - placeholder endpoints active');
});

