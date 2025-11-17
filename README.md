# SASI-KORA - Node.js/TypeScript Emotional State Engine

Refactored emotion engine from Python FastAPI to Node.js/TypeScript for Vercel deployment.

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   - Copy `.env` file (already done)
   - Ensure `GROQ_API_KEY` and `GROQ_MODEL` are set

3. **Start the server**
   ```bash
   # Easy way - use startup script (recommended)
   ./startup.sh
   
   # Or manually
   npm start
   # or for development with auto-reload
   npm run dev
   ```

4. **Open the test UI**
   - Navigate to: http://localhost:8888
   - Use the chat-ui.html interface to test the emotion engine

## 📁 Project Structure

```
SASI-KORA/
├── server.js                          # Express server
├── chat-ui.html                       # Test UI for emotion engine
├── package.json                       # Dependencies
├── .gitignore                         # Git ignore (includes .env)
├── prompts/
│   └── synapse/
│       └── emotional-state-engine-prompts/  # Agent prompts
├── public/
│   ├── css/
│   │   └── fallout-theme.css         # Chat UI styles
│   └── js/
│       └── main.js                    # Chat UI JavaScript
└── src/
    └── emotion-engine/                # Emotion engine (to be implemented)
        ├── agents/                    # Agent implementations
        ├── utils/                     # Utilities
        └── config/
            └── anger_config.yaml      # Anger meter configuration
```

## 🎯 Current Status

✅ **Completed:**
- Project foundation (.gitignore, package.json)
- Prompts copied from KORA-synapse
- Basic Express server with placeholder endpoints
- Chat UI HTML and JavaScript for testing
- Directory structure set up

🚧 **In Progress:**
- Emotion engine implementation (TypeScript)

## 🔧 Environment Variables

Required:
- `GROQ_API_KEY` - Groq API key
- `GROQ_MODEL` - Default Groq model (e.g., `llama-3.3-70b-versatile`)

Optional:
- `CLIENT_NAME` - Client name for prompts (default: `synapse`)
- `PORT` - Server port (default: 8888)
- `MODEL_*` - Per-agent model overrides

## 📝 Next Steps

1. Implement TypeScript emotion engine core
2. Port prompt loader utility
3. Port anger meter system
4. Port base agent and sentiment agent
5. Port all emotional agents
6. Port orchestrator system
7. Connect to API endpoints
8. Test with chat-ui

## 🧪 Testing

Use the chat-ui.html interface at http://localhost:5598 to test the emotion engine once implemented.

## 📚 Documentation

See `cursor-notes.md` for detailed refactoring notes and architecture documentation.

