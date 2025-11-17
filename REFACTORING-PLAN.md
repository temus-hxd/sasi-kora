# SASI-KORA Refactoring Plan

**Goal**: Port Python FastAPI emotion engine to Node.js/TypeScript, testable via chat-ui.html

**Total Phases**: 4  
**End Goal**: Working emotion engine accessible via `/api/emotional-state/chat` endpoint

---

## Phase 1: Foundation & Core Infrastructure ✅

**Goal**: Set up TypeScript foundation, types, and core utilities

**Deliverables**:
- [ ] TypeScript configuration (`tsconfig.json`)
- [ ] Core type definitions (`src/emotion-engine/types.ts`)
  - [ ] `ChatMessage` interface
  - [ ] `SentimentAnalysis` interface
  - [ ] `AngerMeterInfo` interface
  - [ ] `OrchestratorDecision` interface
  - [ ] `ChatRequest` interface
  - [ ] `ChatResponse` interface
- [ ] Prompt loader utility (`src/emotion-engine/utils/prompt-loader.ts`)
  - [ ] Load prompts from `prompts/{CLIENT_NAME}/emotional-state-engine-prompts/`
  - [ ] Handle missing prompts gracefully
  - [ ] Cache prompts in memory
- [ ] Anger config loader (`src/emotion-engine/config/anger-config.ts`)
  - [ ] Load YAML config file
  - [ ] Type-safe config interface
  - [ ] Default config fallback
- [ ] Basic error handling (`src/emotion-engine/utils/errors.ts`)
- [ ] Update `package.json` scripts for TypeScript compilation

**Testing**: 
- [ ] Verify prompt loader can load all prompts
- [ ] Verify config loader reads anger_config.yaml correctly
- [ ] Type checking passes

**Commit Message**: `feat: Phase 1 - Foundation & Core Infrastructure (TypeScript setup, types, prompt loader, config loader)`

---

## Phase 2: Core Systems (Anger Meter & Base Agent) ✅

**Goal**: Port anger meter system and base agent with Groq integration

**Deliverables**:
- [ ] Anger Meter system (`src/emotion-engine/systems/anger-meter.ts`)
  - [ ] Point calculation logic
  - [ ] Escalation/de-escalation rules
  - [ ] Vulgar/insult detection (regex patterns)
  - [ ] Apology detection
  - [ ] Gradual escalation enforcement
  - [ ] De-escalation blocking logic
  - [ ] State serialization/deserialization
- [ ] Base Agent class (`src/emotion-engine/agents/base-agent.ts`)
  - [ ] Prompt combination (personality + linguistic + false-memory + agent-specific)
  - [ ] Groq SDK integration (`@groq/sdk`)
  - [ ] OpenRouter support (optional, for future)
  - [ ] Conversation history trimming (max 20 messages)
  - [ ] Error handling (safety filters, rate limits)
  - [ ] Model selection via env vars
- [ ] Groq adapter (`src/emotion-engine/adapters/groq-adapter.ts`)
  - [ ] Groq client wrapper
  - [ ] API call with retries
  - [ ] Error handling
- [ ] Unit tests for anger meter (basic)
- [ ] Unit tests for base agent (basic)

**Testing**:
- [ ] Test anger meter point calculations
- [ ] Test escalation thresholds
- [ ] Test vulgar/insult detection
- [ ] Test base agent can call Groq API
- [ ] Test prompt loading and combination

**Commit Message**: `feat: Phase 2 - Core Systems (Anger Meter & Base Agent with Groq integration)`

---

## Phase 3: Agents & Sentiment Analysis ✅

**Goal**: Port all emotional agents and sentiment analysis

**Deliverables**:
- [ ] Sentiment Agent (`src/emotion-engine/agents/sentiment-agent.ts`)
  - [ ] JSON sentiment analysis
  - [ ] Markdown code block cleanup
  - [ ] Error handling for invalid JSON
  - [ ] Uses `sassi_personality_mini.md`
- [ ] Normal Agent (`src/emotion-engine/agents/normal-agent.ts`)
- [ ] Happy Agents (`src/emotion-engine/agents/happy-agents.ts`)
  - [ ] Pleased (L1)
  - [ ] Cheerful (L2)
  - [ ] Ecstatic (L3)
- [ ] Sad Agents (`src/emotion-engine/agents/sad-agents.ts`)
  - [ ] Melancholy (L1)
  - [ ] Sorrowful (L2)
  - [ ] Depressed (L3)
- [ ] Angry Agents (`src/emotion-engine/agents/angry-agents.ts`)
  - [ ] Irritated (L1)
  - [ ] Agitated (L2)
  - [ ] Enraged (L3) - with dynamic counter display
- [ ] Agent Factory (`src/emotion-engine/agents/agent-factory.ts`)
  - [ ] Create agents by name
  - [ ] Lazy initialization
- [ ] Test each agent can generate responses

**Testing**:
- [ ] Test sentiment agent returns valid JSON
- [ ] Test each agent type generates appropriate responses
- [ ] Test enraged agent includes counter display
- [ ] Test agent factory creates correct agents

**Commit Message**: `feat: Phase 3 - All Agents & Sentiment Analysis (10 agents + sentiment)`

---

## Phase 4: Orchestrator & API Integration ✅

**Goal**: Port orchestrator system and connect to API endpoints

**Deliverables**:
- [ ] Orchestrator class (`src/emotion-engine/orchestrator.ts`)
  - [ ] `process_message()` method
  - [ ] Sentiment analysis → anger meter → agent selection flow
  - [ ] Parallel response + insights generation
  - [ ] Bye detector
  - [ ] Walk-away logic (enraged at max points)
  - [ ] Emotional history tracking
  - [ ] State reset functionality
  - [ ] Universal `<t></t>` tags instruction
- [ ] State Manager (`src/emotion-engine/utils/state-manager.ts`)
  - [ ] State serialization (for stateless serverless)
  - [ ] State deserialization
  - [ ] New conversation detection
- [ ] API Routes (`src/api/emotional-state.ts` or integrate into `server.js`)
  - [ ] `POST /api/emotional-state/chat` endpoint
  - [ ] `GET /api/emotional-state/health` endpoint
  - [ ] `POST /api/emotional-state/reset` endpoint
  - [ ] Error handling middleware
  - [ ] Request/response validation
- [ ] Update `server.js` to use emotion engine
- [ ] Integration tests
- [ ] Update chat-ui.js if needed (response format changes)

**Testing**:
- [ ] Test full orchestrator flow (sentiment → anger → response)
- [ ] Test agent routing based on anger meter
- [ ] Test bye detector
- [ ] Test walk-away logic
- [ ] Test state reset
- [ ] Test API endpoints via chat-ui.html
- [ ] Test with Live Server (chat-ui.html)
- [ ] Verify all indicators update correctly in UI

**Commit Message**: `feat: Phase 4 - Orchestrator & API Integration (Full emotion engine working)`

---

## Post-Phase 4: Testing & Polish 🎯

**After Phase 4 completion**:
- [ ] End-to-end testing with chat-ui.html
- [ ] Verify all agent types work correctly
- [ ] Verify anger meter escalation/de-escalation
- [ ] Verify sentiment analysis accuracy
- [ ] Performance testing
- [ ] Error handling edge cases
- [ ] Documentation updates
- [ ] Clean up any TODO comments
- [ ] Remove placeholder code

**Final Commit**: `feat: Complete emotion engine refactoring - ready for production`

---

## Quick Reference: File Structure After All Phases

```
SASI-KORA/
├── server.js                          # Express server (updated)
├── tsconfig.json                      # TypeScript config
├── src/
│   ├── emotion-engine/
│   │   ├── index.ts                   # Main export
│   │   ├── orchestrator.ts            # Orchestrator class
│   │   ├── types.ts                   # TypeScript types
│   │   ├── agents/
│   │   │   ├── base-agent.ts
│   │   │   ├── sentiment-agent.ts
│   │   │   ├── normal-agent.ts
│   │   │   ├── happy-agents.ts
│   │   │   ├── sad-agents.ts
│   │   │   ├── angry-agents.ts
│   │   │   └── agent-factory.ts
│   │   ├── systems/
│   │   │   └── anger-meter.ts
│   │   ├── adapters/
│   │   │   └── groq-adapter.ts
│   │   ├── utils/
│   │   │   ├── prompt-loader.ts
│   │   │   ├── state-manager.ts
│   │   │   └── errors.ts
│   │   └── config/
│   │       ├── anger-config.ts
│   │       └── anger_config.yaml
│   └── api/
│       └── emotional-state.ts         # API routes (optional)
├── prompts/
│   └── synapse/
│       └── emotional-state-engine-prompts/
└── public/
    ├── js/
    │   └── main.js                    # Chat UI (may need updates)
    └── css/
        └── fallout-theme.css
```

---

## Notes

- **Stateless Design**: For Vercel serverless, state (anger meter, current agent) should be passed in request/response, not stored in memory
- **Testing Strategy**: Use chat-ui.html with Live Server to test each phase incrementally
- **Error Handling**: All phases should include proper error handling and logging
- **Type Safety**: Use TypeScript strictly - no `any` types where possible
- **API Compatibility**: Maintain same API contract as Python version for frontend compatibility

---

## Phase Completion Checklist

- [ ] Phase 1: Foundation & Core Infrastructure
- [ ] Phase 2: Core Systems (Anger Meter & Base Agent)
- [ ] Phase 3: Agents & Sentiment Analysis
- [ ] Phase 4: Orchestrator & API Integration

**Status**: Ready to begin Phase 1

