# KORA-Synapse Refactoring Notes

## Project Overview

**Source Project**: `/Users/raphael.moreno/Projects/mcp/KORA-synapse`  
**Target Project**: `/Users/raphael.moreno/Projects/mcp/SASI-KORA`  
**Goal**: Refactor Python FastAPI emotional-state engine to Node.js/TypeScript for Vercel deployment

### Primary Motivation
- Eliminate dual-runtime friction (Node + Python) on Vercel
- Fix opaque Python lambda crashes (`FUNCTION_INVOCATION_FAILED`)
- Converge on single Node/TS runtime for predictable deployments
- Preserve all avatar/TTS behaviors, multi-agent prompts, and client customizations

---

## Architecture Overview

### Current System (As-Is)

```
Browser (ReadyPlayerMe UI)
    ↓ POST /api/chat
Node.js server.js (Express)
    ↓ POST /api/emotional-state/chat (proxy)
Python FastAPI (backend/main.py)
    ↓ Groq LLM API
Groq (llama-3.3-70b-versatile)
```

### Target System (To-Be)

```
Browser (ReadyPlayerMe UI)
    ↓ POST /api/chat
Node.js server.js (Express)
    ↓ Direct import
Node/TS Emotion Engine Module
    ↓ Groq SDK (@groq/sdk)
Groq (llama-3.3-70b-versatile)
```

---

## Core Components

### 1. Orchestrator System (`backend/orchestrator/orchestrator.py`)

**Purpose**: Manages conversation flow, sentiment analysis, and agent routing

**Key Methods**:
- `process_message(message, conversation_history)` → Returns `(response, agent_type, analysis_data)`
- `_get_agent_response(agent_name, conversation_history, orchestrator_thinking)` → Generates response from selected agent
- `reset_state()` → Resets all state (anger meter, emotional history, current agent)

**Flow**:
1. Run sentiment analysis (required first step)
2. Process anger meter (determines agent routing)
3. Generate response + insights in parallel
4. Check bye detector (ends conversation if agent says goodbye)
5. Update emotional history and current agent
6. Return response with metadata

**State Management**:
- `current_agent`: Current active agent name
- `emotional_history`: Last 5 emotional states for trajectory tracking
- `anger_meter`: AngerMeter instance (persists across messages)
- `ended`: Boolean flag for conversation termination

**Agent Types**:
- **Normal**: `normal_agent`
- **Happy**: `pleased` (L1), `cheerful` (L2), `ecstatic` (L3)
- **Sad**: `melancholy` (L1), `sorrowful` (L2), `depressed` (L3)
- **Angry**: `irritated` (L1), `agitated` (L2), `enraged` (L3)

**Special Behaviors**:
- Enraged agent at max anger points (100/100) → Walk away message, ends conversation
- Bye detector → Ends conversation if agent says goodbye phrases
- Universal `<t></t>` tags instruction added to all agents

---

### 2. Anger Meter System (`backend/utils/anger_meter.py`)

**Purpose**: Tracks cumulative anger points over conversation with escalation/de-escalation logic

**Configuration** (`anger_config.yaml`):
- `anger_multiplier`: 15.0 (base multiplier for sentiment intensity)
- `thresholds`: `irritated: 12`, `agitated: 25`, `enraged: 50`
- `decay`: `idle_rate: 0.3`, `time_decay_enabled: false`
- `bonuses`: `consecutive_anger: 5`, `vulgar_language: 8`, `direct_insults: 12`
- `penalties`: `apology_reduction: -15`, `calm_language: -3`, `positive_emotion: -8`
- `meter`: `max_points: 100`, `escalation_cooldown: 2`
- `de_escalation`: `enraged_apology_requirement: 2`, `apology_memory_limit: 5`

**Key Methods**:
- `process_message(message, sentiment_analysis)` → Returns `(agent_name, meter_info)`
- `reset_meter()` → Resets all anger state
- `_determine_agent()` → Determines agent based on anger points

**Point Calculation**:
- Base points: `intensity * anger_multiplier` (for anger emotions)
- Bonuses: consecutive anger, vulgar language, direct insults
- Penalties: apologies, calm language, positive emotions
- Decay: idle decay per non-angry message

**Escalation Rules**:
- **Gradual Escalation Enforced**: No direct jumps from normal→enraged or irritated→enraged
- **Escalation Cooldown**: 2 messages before allowing escalation again
- **De-escalation Blocking**: Enraged state requires 2+ apologies before de-escalation allowed
- **Gradual De-escalation**: Enraged→normal must go through agitated→irritated first

**Vulgar/Insult Detection**:
- Vulgar patterns: `fuck`, `shit`, `damn`, `hell`, `ass`, `bitch`, `crap`, `bastard`, `piss`, `stupid`, `idiot`, `moron`, `dumb`, `retard`, multiple `!`, ALL CAPS (4+ letters)
- Direct insults: `suck my`, `go fuck`, `fuck you`, `screw you`, `eat shit`, `kiss my ass`, `blow me`, `you suck`, `you're stupid`, `shut up`, `shut the fuck up`, `dickhead`, `asshole`, `piece of shit`, sexual references, combined vulgar+insult

**Apology Detection**:
- Patterns: `sorry`, `apologize`, `apologies`, `my bad`, `forgive me`, `didn't mean`, `excuse me`, `pardon`

**Return Format**:
```javascript
{
  anger_points: 25.0,
  anger_level: "agitated",
  points_change: 5.0,
  change_reasons: ["anger_base: +10.5", "consecutive_anger: +5"],
  consecutive_anger: 2,
  message_count: 5,
  thresholds: { irritated: 12, agitated: 25, enraged: 50 },
  max_points: 100,
  debug: { /* optional debug info */ }
}
```

---

### 3. Base Agent System (`backend/agents/base_agent.py`)

**Purpose**: Base class for all emotional agents with Groq/OpenRouter LLM integration

**Key Features**:
- Prompt loading from `prompts/{client}/emotional-state-engine-prompts/`
- Supports both Groq and OpenRouter providers (model name with `/` = OpenRouter)
- Combines multiple prompts: `personality` + `linguistic-engine` + `false-memory` + `agent-specific`
- Model selection via env vars (e.g., `MODEL_NORMAL`, `MODEL_SENTIMENT`, `MODEL_ENRAGED`)
- Conversation history trimming (max 20 messages)

**Prompt Structure**:
```
{sassi_personality.md}
---
{linguistic-engine.md}
---
{false-memory.md}
---
{agent-specific.md}
```

**LLM Call Method** (`_call_groq`):
- Converts `ChatMessage` list to API format
- Adds system prompt
- Trims history to 20 messages
- Calls Groq or OpenRouter API
- Returns response text
- Error handling for safety filters, rate limits, etc.

**Agent Initialization**:
```python
super().__init__(
    prompt_file="normal_agent.md",
    skip_personality=False,  # Set True for sentiment agent
    model_env_var="MODEL_NORMAL"  # Optional env var for model selection
)
```

---

### 4. Sentiment Agent (`backend/agents/sentiment_agent.py`)

**Purpose**: Analyzes sentiment of user messages (required before routing)

**Key Method**:
- `analyze_sentiment(message)` → Returns JSON sentiment data

**Return Format**:
```json
{
  "emotion": "anger|joy|sadness|neutral|...",
  "intensity": 0.0-1.0,
  "emotional_indicators": ["trigger phrase 1", "trigger phrase 2"],
  "thinking": "Analysis reasoning..."
}
```

**Special Handling**:
- Uses `sassi_personality_mini.md` instead of full personality
- Low temperature (0.3) for consistent analysis
- JSON parsing with markdown code block cleanup
- Raises HTTPException on JSON parse failure

---

### 5. Agent Implementations

**All agents follow same pattern**:
```python
class NormalAgent(BaseAgent):
    def __init__(self):
        super().__init__("normal_agent.md", model_env_var="MODEL_NORMAL")
    
    async def generate_response(self, messages: List[ChatMessage]) -> str:
        return await self._call_groq(messages)
```

**Agent Files**:
- `normal_agent.py` → `normal_agent.md`
- `happy_level1_pleased_agent.py` → `happy-1-pleased.md`
- `happy_level2_cheerful_agent.py` → `happy-2-cheerful.md`
- `happy_level3_ecstatic_agent.py` → `happy-3-ecstatic.md`
- `sad_level1_melancholy_agent.py` → `sad-1-melancholy.md`
- `sad_level2_sorrowful_agent.py` → `sad-2-sorrowful.md`
- `sad_level3_depressed_agent.py` → `sad-3-depressed.md`
- `angry_level1_irritated_agent.py` → `angry-1-irritated.md`
- `angry_level2_agitated_agent.py` → `angry-2-agitated.md`
- `angry_level3_enraged_agent.py` → `angry-3-enraged.md`

**Special: Enraged Agent**:
- Receives dynamic anger meter display in system message
- Format: `<t>🔥 {points}/{max} pts (LVL {level}) [THOUGHTS]</t>`
- Must start response with exact format
- Counter level calculated from anger percentage (0-3 scale)

---

### 6. Prompt Loader (`backend/utils/prompt_loader.py`)

**Purpose**: Loads markdown prompts from client-specific directories

**Path Structure**:
```
prompts/
  {CLIENT_NAME}/
    emotional-state-engine-prompts/
      {prompt_file}
```

**Client Selection**:
- Environment variable: `CLIENT_NAME` (defaults to `synapse`)
- Loads from: `prompts/{CLIENT_NAME}/emotional-state-engine-prompts/{prompt_file}`

**Prompt Files**:
- `sassi_personality.md` - Core personality
- `sassi_personality_mini.md` - Mini personality (for sentiment)
- `linguistic-engine.md` - Linguistic rules
- `false-memory.md` - False memory system
- `sentiment_agent.md` - Sentiment analysis instructions
- `normal_agent.md` - Normal agent prompt
- `happy-1-pleased.md`, `happy-2-cheerful.md`, `happy-3-ecstatic.md`
- `sad-1-melancholy.md`, `sad-2-sorrowful.md`, `sad-3-depressed.md`
- `angry-1-irritated.md`, `angry-2-agitated.md`, `angry-3-enraged.md`

---

### 7. FastAPI Main (`backend/main.py`)

**Purpose**: FastAPI application entrypoint with Vercel compatibility

**Endpoints**:
- `POST /chat` - Main chat endpoint (stateless, history from client)
- `GET /health` - Health check with env status
- `POST /reset` - Reset orchestrator state
- `GET /conversations/{id}` - Info only (history client-side)
- `DELETE /conversations/{id}` - Info only (history client-side)

**Request Format** (`POST /chat`):
```json
{
  "message": "User message text",
  "conversation_id": "uuid-string (optional)",
  "history": [
    { "role": "user|assistant", "content": "...", "timestamp": "ISO datetime" }
  ]
}
```

**Response Format**:
```json
{
  "response": "Agent response text",
  "conversation_id": "uuid-string",
  "agent_type": "normal|pleased|cheerful|...",
  "timestamp": "ISO datetime",
  "sentiment_analysis": {
    "emotion": "anger",
    "intensity": 0.7,
    "emotional_indicators": ["trigger"],
    "thinking": "..."
  },
  "orchestrator_decision": {
    "current_agent": "normal",
    "next_agent": "irritated",
    "action": "anger_meter_routing_angry",
    "thinking": "...",
    "emotion_detected": "anger",
    "intensity_detected": 0.7,
    "anger_meter": { /* meter_info */ }
  },
  "orchestrator_insights": {
    "current_state": "normal → irritated",
    "emotional_intensity": "0.7/1.0 (moderate emotion)",
    "trigger_explanation": "...",
    "conversation_trajectory": "...",
    "detected_triggers": ["..."],
    "state_transition": "...",
    "orchestrator_suggestion": "...",
    "anger_points": 15.0,
    "anger_level": "irritated",
    "anger_thresholds": { "irritated": 12, "agitated": 25, "enraged": 50 },
    "anger_change_reasons": ["..."]
  }
}
```

**State Management**:
- Stateless: Client sends full conversation history per request
- New conversation detection: Empty history triggers `orchestrator.reset_state()`
- Orchestrator instance is global (persists across requests in same process)

**Vercel Compatibility**:
- Uses Mangum adapter for AWS Lambda/Vercel
- Error handling with JSON responses (not HTML)
- Startup error handling (health endpoint still works if orchestrator fails)

---

### 8. Node.js Server (`server.js`)

**Purpose**: Express server serving static files and proxying to Python emotional-state engine

**Key Routes**:
- `GET /` - Serves `public/rpm-chatbot.html`
- `GET /api/config` - Returns avatar URL and voice ID from env
- `GET /api/health` - Health check
- `POST /api/chat` - Proxies to `/api/emotional-state/chat` (via SassiProvider)
- `GET /api/elevenlabs/*` - ElevenLabs TTS proxy
- Static files: `/js/*`, `/css/*`, `/images/*`

**SassiProvider Integration** (`src/api/providers/SassiProvider.js`):
- Determines API URL: `SASSI_API_URL` > `VERCEL_URL/api/emotional-state` > `localhost:7878`
- Converts history format
- Calls `/chat` endpoint
- Parses memory commands (if any)
- Extracts emoji for avatar control
- Maps agent types to emojis if none found
- Returns standardized response format

**Response Processing**:
- Memory commands: Parsed and executed via `MemoryParser`
- Emoji extraction: Regex for Unicode emoji ranges
- Agent emoji mapping: Fallback if no emoji in response
- Clean response: Removes memory markers

---

## API Contracts

### Emotional-State Engine API

**Base URL**: `/api/emotional-state` (Vercel) or `http://localhost:7878` (local)

**POST /chat**
- Request: `{ message, conversation_id?, history? }`
- Response: `{ response, conversation_id, agent_type, timestamp, sentiment_analysis, orchestrator_decision, orchestrator_insights }`

**GET /health**
- Response: `{ status, timestamp, env, startup_error? }`

**POST /reset**
- Response: `{ message, timestamp, current_agent, anger_counter, anger_points }`

---

## Environment Variables

### Required
- `GROQ_API_KEY` - Groq API key for LLM calls
- `GROQ_MODEL` - Default Groq model (e.g., `llama-3.3-70b-versatile`)
- `ELEVENLABS_API_KEY` - ElevenLabs TTS API key
- `READYPLAYERME_AVATAR_URL` - Avatar URL
- `VOICE_ID` - ElevenLabs voice ID

### Optional (Model Selection)
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

### Optional (Client Configuration)
- `CLIENT_NAME` - Client name for prompt loading (default: `synapse`)
- `SASSI_API_URL` - Override emotional-state API URL
- `OPENROUTER_API_KEY` - For OpenRouter models (model name contains `/`)

---

## File Structure

### Python Backend (`backend/`)
```
backend/
├── api.py                    # Vercel entrypoint (Mangum adapter)
├── main.py                   # FastAPI app with routes
├── requirements.txt          # Python dependencies
├── anger_config.yaml         # Anger meter configuration
├── agents/
│   ├── __init__.py
│   ├── base_agent.py         # Base agent class
│   ├── sentiment_agent.py    # Sentiment analysis
│   ├── normal_agent.py       # Normal agent
│   ├── happy_level1_pleased_agent.py
│   ├── happy_level2_cheerful_agent.py
│   ├── happy_level3_ecstatic_agent.py
│   ├── sad_level1_melancholy_agent.py
│   ├── sad_level2_sorrowful_agent.py
│   ├── sad_level3_depressed_agent.py
│   ├── angry_level1_irritated_agent.py
│   ├── angry_level2_agitated_agent.py
│   ├── angry_level3_enraged_agent.py
│   └── orchestrator_agent.py
├── orchestrator/
│   ├── __init__.py
│   └── orchestrator.py       # Main orchestrator logic
└── utils/
    ├── __init__.py
    ├── anger_meter.py        # Anger meter system
    └── prompt_loader.py      # Prompt loading utility
```

### Node.js Server (`server.js` + `src/`)
```
server.js                      # Main Express server
src/
├── api/
│   ├── chatbot.js            # Chatbot routes
│   ├── elevenlabs-tts.js     # TTS proxy
│   ├── websocket.js          # WebSocket (local only)
│   ├── providers/
│   │   └── SassiProvider.js  # Emotional-state API client
│   └── memory-parser.js      # Memory command parsing
```

### Prompts (`prompts/`)
```
prompts/
└── {CLIENT_NAME}/
    └── emotional-state-engine-prompts/
        ├── sassi_personality.md
        ├── sassi_personality_mini.md
        ├── linguistic-engine.md
        ├── false-memory.md
        ├── sentiment_agent.md
        ├── normal_agent.md
        ├── happy-1-pleased.md
        ├── happy-2-cheerful.md
        ├── happy-3-ecstatic.md
        ├── sad-1-melancholy.md
        ├── sad-2-sorrowful.md
        ├── sad-3-depressed.md
        ├── angry-1-irritated.md
        ├── angry-2-agitated.md
        └── angry-3-enraged.md
```

### Frontend (`public/`)
```
public/
├── rpm-chatbot.html          # Main UI
├── js/
│   ├── app.js
│   ├── AvatarManager.js
│   ├── ChatManager.js
│   ├── TTSManager.js
│   ├── WebSocketManager.js
│   └── ... (other managers)
├── css/
│   └── styles.css
└── images/
    └── background.png
```

---

## Refactoring Requirements

### 1. Core Module Structure

**Target**: `src/emotion-engine/`

```
src/emotion-engine/
├── index.ts                  # Main export
├── orchestrator.ts           # Orchestrator class
├── anger-meter.ts            # Anger meter system
├── agents/
│   ├── base-agent.ts         # Base agent class
│   ├── sentiment-agent.ts    # Sentiment analysis
│   ├── normal-agent.ts
│   ├── happy-agents.ts       # All happy agents
│   ├── sad-agents.ts         # All sad agents
│   └── angry-agents.ts       # All angry agents
├── utils/
│   ├── prompt-loader.ts      # Prompt loading
│   └── types.ts              # TypeScript types
└── config/
    └── anger-config.ts       # Anger meter config (from YAML)
```

### 2. Key Porting Tasks

**Orchestrator**:
- Port `process_message()` async flow
- Port sentiment analysis → anger meter → response generation pipeline
- Port bye detector and walk-away logic
- Port emotional history tracking
- Port state reset logic

**Anger Meter**:
- Port YAML config loading (convert to TS/JSON)
- Port point calculation logic
- Port escalation/de-escalation rules
- Port vulgar/insult/apology detection (regex patterns)
- Port gradual escalation enforcement
- Port de-escalation blocking logic

**Base Agent**:
- Port prompt loading and combination
- Port Groq SDK integration (`@groq/sdk`)
- Port OpenRouter support (HTTP fetch)
- Port conversation history trimming
- Port error handling (safety filters, rate limits)

**Sentiment Agent**:
- Port JSON sentiment analysis
- Port markdown code block cleanup
- Port error handling for invalid JSON

**Prompt Loader**:
- Port client-specific prompt loading
- Port file system reading (`fs/promises`)
- Port path resolution logic

### 3. API Route Implementation

**Target**: `src/api/emotional-state.ts` or integrate into `server.js`

**Endpoints**:
- `POST /api/emotional-state/chat` - Main chat handler
- `GET /api/emotional-state/health` - Health check
- `POST /api/emotional-state/reset` - Reset state

**Integration**:
- Replace `SassiProvider.js` fetch call with direct import
- Remove Python proxy dependency
- Update `server.js` to import emotion engine module

### 4. TypeScript Types

**Required Types**:
```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

interface SentimentAnalysis {
  emotion: string;
  intensity: number;
  emotional_indicators: string[];
  thinking: string;
}

interface AngerMeterInfo {
  anger_points: number;
  anger_level: string;
  points_change: number;
  change_reasons: string[];
  consecutive_anger: number;
  message_count: number;
  thresholds: { irritated: number; agitated: number; enraged: number };
  max_points: number;
}

interface OrchestratorDecision {
  current_agent: string;
  next_agent: string;
  action: string;
  thinking: string;
  emotion_detected: string;
  intensity_detected: number;
  anger_meter: AngerMeterInfo;
}

interface ChatResponse {
  response: string;
  conversation_id: string;
  agent_type: string;
  timestamp: string;
  sentiment_analysis?: SentimentAnalysis;
  orchestrator_decision?: OrchestratorDecision;
  orchestrator_insights?: any;
}
```

### 5. Dependencies

**Required npm packages**:
- `@groq/sdk` - Groq SDK for Node.js
- `express` - HTTP server (already present)
- `yaml` or `js-yaml` - YAML parsing (for anger_config.yaml)
- `dotenv` - Environment variables (already present)

**Optional**:
- `typescript` - TypeScript support
- `@types/node` - Node.js types
- `ts-node` - TypeScript execution

### 6. Vercel Configuration

**Update `vercel.json`**:
- Remove Python build (`@vercel/python`)
- Keep Node.js build (`@vercel/node`)
- Update routes to point to Node.js functions
- Remove `/api/emotional-state/*` Python route

### 7. Testing Considerations

**Unit Tests**:
- Anger meter point calculations
- Escalation/de-escalation logic
- Vulgar/insult detection regex
- Sentiment analysis JSON parsing
- Prompt loading and combination

**Integration Tests**:
- Full orchestrator flow (sentiment → anger → response)
- Agent selection and routing
- State reset functionality
- API endpoint responses

**Regression Tests**:
- Verify emoji extraction still works
- Verify response format matches Python version
- Verify anger meter behavior matches Python version
- Verify all agent types respond correctly

---

## Important Implementation Details

### 1. State Management

**Stateless Design**:
- Client sends full conversation history per request
- Orchestrator state (anger meter, current agent) persists in memory (per process)
- New conversation detection: Empty history triggers reset
- **Note**: In serverless (Vercel), state won't persist across invocations - may need to pass state in request or use external storage

**State Reset**:
- Triggered by empty history
- Resets: `current_agent = "normal"`, `anger_meter.reset_meter()`, `emotional_history = []`, `ended = false`

### 2. Anger Meter Persistence

**Current Behavior**:
- Anger meter persists across messages in same process
- Points accumulate and decay over conversation
- State survives between requests (in long-running server)

**Serverless Consideration**:
- Vercel serverless functions are stateless
- Options:
  1. Pass anger meter state in request/response (client stores it)
  2. Use external storage (Redis, database)
  3. Recalculate from conversation history (may not match exactly)

**Recommendation**: Pass state in request/response, client stores in localStorage (matches current browser-memory pattern)

### 3. Emoji Contract

**Critical**: Frontend expects emoji in response for avatar control

**Current Behavior**:
- Agents include emoji in responses
- SassiProvider extracts emoji via regex
- Falls back to agent-type → emoji mapping if no emoji found
- Emoji prepended to response if mapped

**Must Preserve**: Emoji extraction and mapping logic in refactored version

### 4. Memory Commands

**Current Behavior**:
- Responses may contain memory commands (parsed by `MemoryParser`)
- Commands executed server-side
- Response cleaned of memory markers before returning

**Note**: Memory system is separate from emotion engine - may not need to port immediately

### 5. Universal `<t></t>` Tags

**Current Behavior**:
- All agents receive universal instruction: "You will use <t></t> tags"
- Enraged agent gets additional counter display instruction
- Tags used for thinking/thoughts display in UI

**Must Preserve**: Universal instruction in refactored version

### 6. Enraged Agent Counter Display

**Format**: `<t>🔥 {points}/{max} pts (LVL {level}) [THOUGHTS]</t>`

**Calculation**:
- `anger_percentage = anger_points / max_points`
- Level 3: `>= 0.9`, Level 2: `>= 0.7`, Level 1: `< 0.7`
- Must start response with exact format

**Must Preserve**: Counter display logic and format

### 7. Bye Detector

**Phrases**: `bye`, `goodbye`, `i'm done`, `i am done`, `i'm leaving`, `i am leaving`, `i'm out`, `i am out`, `that's it`, `i'm finished`, `i am finished`

**Behavior**: Sets `ended = true`, returns response with `{"ended": true}`

**Must Preserve**: Bye detection logic

### 8. Walk-Away Logic

**Trigger**: Enraged agent + anger points >= max_points (100/100)

**Message**: `<t>🔥 {points}/{max} pts (LVL 3) I'M DONE WITH THIS. WALKING AWAY.</t>BYE. I'M OUT. CONVERSATION OVER.`

**Behavior**: Sets `ended = true`, returns with `{"ended": true, "walkaway": true}`

**Must Preserve**: Walk-away logic

---

## Migration Checklist

### Phase 1: Core Engine
- [ ] Port prompt loader (TypeScript)
- [ ] Port base agent class (TypeScript)
- [ ] Port Groq SDK integration
- [ ] Port OpenRouter support (if needed)
- [ ] Port sentiment agent
- [ ] Port all emotional agents (normal, happy, sad, angry)

### Phase 2: Orchestration
- [ ] Port anger meter system (TypeScript)
- [ ] Port YAML config loading
- [ ] Port orchestrator class
- [ ] Port state management
- [ ] Port bye detector
- [ ] Port walk-away logic

### Phase 3: API Integration
- [ ] Create `/api/emotional-state/chat` endpoint
- [ ] Create `/api/emotional-state/health` endpoint
- [ ] Create `/api/emotional-state/reset` endpoint
- [ ] Update `SassiProvider.js` to use direct import (or remove)
- [ ] Update `server.js` routes

### Phase 4: Testing & Cleanup
- [ ] Unit tests for anger meter
- [ ] Unit tests for orchestrator
- [ ] Integration tests for API endpoints
- [ ] Regression tests (compare with Python version)
- [ ] Update `vercel.json` (remove Python build)
- [ ] Remove Python backend directory
- [ ] Update documentation

---

## Notes for Future Reference

1. **Stateless Design**: Current Python version is stateless (client sends history), but orchestrator state persists in memory. For Vercel serverless, consider passing state in request/response.

2. **Prompt Loading**: Prompts are loaded from `prompts/{CLIENT_NAME}/emotional-state-engine-prompts/`. Client name comes from `CLIENT_NAME` env var (default: `synapse`).

3. **Model Selection**: Each agent can use different models via env vars (`MODEL_NORMAL`, `MODEL_SENTIMENT`, etc.). Default fallback is `llama-3.1-8b-instant`.

4. **Error Handling**: Groq API errors include safety filter rejections (400), rate limits (429), and generic errors (500). Must handle gracefully.

5. **Timing**: Python version includes timing traces (`⏱️ [TRACE]`). Consider adding similar logging for debugging.

6. **Conversation History**: History is trimmed to 20 messages in base agent. Must preserve this behavior.

7. **Universal Instructions**: All agents receive universal `<t></t>` tags instruction. Enraged agent gets additional counter display instruction.

8. **Emoji Extraction**: Frontend extracts emoji via regex. If no emoji found, maps agent type to emoji. Must preserve this behavior.

9. **Memory Commands**: Memory system is separate but integrated. May not need to port immediately, but must preserve response cleaning.

10. **Gradual Escalation**: Anger meter enforces gradual escalation (no direct jumps). Must preserve this behavior.

---

## Questions to Resolve

1. **State Persistence**: How to handle orchestrator state in serverless environment?
   - Option A: Pass state in request/response (client stores)
   - Option B: Use external storage (Redis, database)
   - Option C: Recalculate from history (may not match exactly)

2. **TypeScript vs JavaScript**: Should we use TypeScript for better type safety, or stick with JavaScript for simplicity?

3. **YAML Config**: Convert `anger_config.yaml` to TypeScript/JSON, or use YAML parser?

4. **Testing Strategy**: What level of testing is required before deployment?

5. **Backward Compatibility**: Do we need to maintain API compatibility with Python version, or can we evolve the API?

---

## References

- **Refactor Blueprint**: `REFACTOR.md` in KORA-synapse project
- **Python Backend**: `/Users/raphael.moreno/Projects/mcp/KORA-synapse/backend/`
- **Node Server**: `/Users/raphael.moreno/Projects/mcp/KORA-synapse/server.js`
- **Prompts**: `/Users/raphael.moreno/Projects/mcp/KORA-synapse/prompts/`
- **Vercel Config**: `/Users/raphael.moreno/Projects/mcp/KORA-synapse/vercel.json`

