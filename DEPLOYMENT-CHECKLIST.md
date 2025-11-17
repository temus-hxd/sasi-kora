# Deployment Checklist for kora-synapxe-01

## Pre-Deployment Checklist

### ✅ Code Ready
- [x] All prompts updated for Ah Meng character
- [x] TTS speed set to 0.5 for elderly character
- [x] Avatar UI is default route (`/`)
- [x] Chat UI available at `/chat`
- [x] Server exports Express app for Vercel
- [x] Build script configured (`npm run build`)
- [x] TypeScript compiles without errors

### 📋 Environment Variables to Set in Vercel

**Required:**
- [ ] `GROQ_API_KEY` - Your Groq API key
- [ ] `GROQ_MODEL` - Default model (e.g., `llama-3.1-8b-instant`)
- [ ] `OPENROUTER_API_KEY` - OpenRouter API key (for angry agents using Grok)
- [ ] `ELEVENLABS_API_KEY` - ElevenLabs TTS API key
- [ ] `READYPLAYERME_AVATAR_URL` - Your ReadyPlayerMe avatar URL
- [ ] `VOICE_ID` - ElevenLabs voice ID

**Optional (but recommended):**
- [ ] `CLIENT_NAME` - Set to `synapse` (default)
- [ ] `MODEL_IRRITATED` - Set to `x-ai/grok-4-fast` (default for angry agents)
- [ ] `MODEL_AGITATED` - Set to `x-ai/grok-4-fast` (default for angry agents)
- [ ] `MODEL_ENRAGED` - Set to `x-ai/grok-4-fast` (default for angry agents)
- [ ] Other model overrides if needed (`MODEL_*`)

**NOT NEEDED (Legacy/Unused):**
- [ ] `PRIMARY_PROVIDER` - **NOT USED** - Do not set this in Vercel, it's not referenced in the codebase

### 🚀 Deployment Steps

1. **Push to Git Repository**
   ```bash
   git push origin main
   ```

2. **Deploy via Vercel Dashboard**
   - Go to https://vercel.com/new
   - Import your Git repository
   - **Project Name**: `kora-synapxe-01`
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: (leave empty)
   - **Install Command**: `npm install`

3. **Set Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required variables
   - Set for Production, Preview, and Development environments

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `kora-synapxe-01.vercel.app`

### 🔍 Post-Deployment Verification

After deployment, verify:

- [ ] **Root URL** (`https://kora-synapxe-01.vercel.app/`) → Shows Avatar UI (Ah Meng)
- [ ] **Chat UI** (`https://kora-synapxe-01.vercel.app/chat`) → Shows text-only chat
- [ ] **Health Check** (`https://kora-synapxe-01.vercel.app/api/health`) → Returns healthy status
- [ ] **Avatar loads** → ReadyPlayerMe avatar displays correctly
- [ ] **TTS works** → Speech is slow (speed 0.5) and natural
- [ ] **Emotion engine responds** → Ah Meng responds as grumpy 76-year-old
- [ ] **No self-description** → Ah Meng never says "I'm grumpy" or "I'm old"

### 🐛 Troubleshooting

**If build fails:**
- Check Vercel build logs
- Verify TypeScript compiles: `npm run build`
- Ensure all dependencies are in `package.json`

**If environment variables not working:**
- Verify variables are set in Vercel dashboard
- Check variable names match exactly (case-sensitive)
- Redeploy after adding new variables

**If avatar doesn't load:**
- Check `READYPLAYERME_AVATAR_URL` is set correctly
- Verify CORS settings if needed
- Check browser console for errors

**If TTS doesn't work:**
- Verify `ELEVENLABS_API_KEY` and `VOICE_ID` are set
- Check ElevenLabs API quota/limits
- Verify speed setting (should be 0.5)

### 📝 Notes

- The app uses serverless functions, so cold starts may occur on first request
- All API routes are handled by Express server
- Static files are served from `public/` directory
- Emotion engine is stateless and designed for serverless deployment
- Both UIs are available: Avatar at `/`, Chat at `/chat`

