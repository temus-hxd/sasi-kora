# Vercel Deployment Guide for kora-synapxe-01

## Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **Vercel CLI** (optional): `npm i -g vercel`
3. **Environment Variables**: Set up in Vercel dashboard

## Required Environment Variables

Set these in your Vercel project settings (Settings → Environment Variables):

### Required
- `GROQ_API_KEY` - Your Groq API key for LLM calls
- `GROQ_MODEL` - Default Groq model (e.g., `llama-3.1-8b-instant`)
- `ELEVENLABS_API_KEY` - ElevenLabs TTS API key
- `READYPLAYERME_AVATAR_URL` - Your ReadyPlayerMe avatar URL
- `VOICE_ID` - ElevenLabs voice ID

### Optional (Model Overrides)
- `MODEL_ORCHESTRATOR` - Orchestrator agent model
- `MODEL_SENTIMENT` - Sentiment agent model
- `MODEL_NORMAL` - Normal agent model
- `MODEL_PLEASED` - Pleased agent model
- `MODEL_CHEERFUL` - Cheerful agent model
- `MODEL_ECSTATIC` - Ecstatic agent model
- `MODEL_MELANCHOLY` - Melancholy agent model
- `MODEL_SORROWFUL` - Sorrowful agent model
- `MODEL_DEPRESSED` - Depressed agent model
- `MODEL_IRRITATED` - Irritated agent model
- `MODEL_AGITATED` - Agitated agent model
- `MODEL_ENRAGED` - Enraged agent model

### Optional (Configuration)
- `CLIENT_NAME` - Client name for prompts (default: `synapse`)
- `PORT` - Server port (Vercel sets this automatically)
- `SASSI_API_URL` - Override emotional-state API URL

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard

1. **Connect Repository**
   - Go to https://vercel.com/new
   - Import your Git repository (GitHub/GitLab/Bitbucket)
   - Select the repository

2. **Configure Project**
   - **Project Name**: `kora-synapxe-01`
   - **Framework Preset**: Other
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: Leave empty (not needed for Node.js)
   - **Install Command**: `npm install`

3. **Set Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required environment variables listed above
   - Make sure to set them for Production, Preview, and Development

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `kora-synapxe-01.vercel.app`

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (first time - will prompt for configuration)
vercel

# Deploy to production
vercel --prod
```

## Project Structure

```
kora-synapxe-01/
├── server.js              # Express server (entry point)
├── vercel.json            # Vercel configuration
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── dist/                  # Compiled JavaScript (built from src/)
├── public/                # Static files (CSS, JS, images)
├── prompts/               # Agent prompts
└── src/                   # TypeScript source files
```

## Routes

After deployment, your app will be available at:

- **Root URL**: `https://kora-synapxe-01.vercel.app/` → Avatar UI (Ah Meng)
- **Chat UI**: `https://kora-synapxe-01.vercel.app/chat` → Text-only chat UI
- **Health Check**: `https://kora-synapxe-01.vercel.app/api/health`
- **Emotion Engine API**: `https://kora-synapxe-01.vercel.app/api/emotional-state/chat`
- **Config API**: `https://kora-synapxe-01.vercel.app/api/config`
- **TTS API**: `https://kora-synapxe-01.vercel.app/api/elevenlabs/tts`

## Build Process

1. **Install dependencies**: `npm install`
2. **Build TypeScript**: `npm run build` (compiles `src/` → `dist/`)
3. **Start server**: `node server.js`

Vercel will automatically:
- Run `npm install` to install dependencies
- Run `npm run build` to compile TypeScript
- Start the server using `server.js`

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure TypeScript compiles without errors: `npm run build`
- Check Vercel build logs for specific errors

### Environment Variables Not Working
- Verify all required variables are set in Vercel dashboard
- Make sure variables are set for the correct environment (Production/Preview/Development)
- Redeploy after adding new environment variables

### API Routes Not Working
- Check that `vercel.json` is configured correctly
- Verify `server.js` exports the Express app correctly
- Check Vercel function logs for errors

### Static Files Not Loading
- Ensure `public/` directory is included in deployment
- Check that static file routes in `server.js` are correct
- Verify file paths are relative to project root

## Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Wait for DNS propagation

## Monitoring

- **Logs**: View in Vercel dashboard → Deployments → Select deployment → Functions
- **Analytics**: Enable in Project Settings → Analytics
- **Real-time**: View function invocations in real-time

## Notes

- The app uses serverless functions, so cold starts may occur on first request
- All API routes are handled by the Express server in `server.js`
- Static files are served from the `public/` directory
- The emotion engine is stateless and designed for serverless deployment

