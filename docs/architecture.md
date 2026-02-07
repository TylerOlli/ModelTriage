# Architecture Documentation

## Overview

ModelTriage is built on Next.js 15 (App Router) with TypeScript and Tailwind CSS. The architecture separates concerns into UI (Next.js pages), API (SSE streaming endpoints), and core library modules (providers, routing, diff analysis).

## Folder Structure

```
modeltriage/
├── src/app/                    # Next.js App Router
│   ├── api/stream/
│   │   └── route.ts            # SSE streaming endpoint (single + Comparison Mode)
│   ├── page.tsx                # Main UI with prompt input, Comparison Mode toggle
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
│
├── lib/                        # Core library modules
│   ├── providers/              # LLM provider abstraction
│   │   ├── types.ts            # Provider interface definition
│   │   ├── mock-provider.ts    # MockProvider implementation
│   │   └── index.ts            # Exports
│   ├── routing/                # Rules-based model routing
│   │   ├── types.ts            # Routing types (RoutingDecision)
│   │   ├── router.ts           # ModelRouter implementation
│   │   └── index.ts            # Exports
│   └── diff/                   # Diff analysis for Comparison Mode
│       ├── types.ts            # Diff types (DiffSummary)
│       ├── analyzer.ts         # DiffAnalyzer implementation
│       └── index.ts            # Exports
│
├── __tests__/                  # Unit tests
│   ├── attachments/
│   │   └── processor.test.ts
│   ├── diff/
│   │   └── analyzer.test.ts
│   └── llm/
│       └── intent-router.test.ts
│
├── docs/                       # Documentation
├── .specify/                   # Product specifications (source of truth)
└── package.json
```

## Module Descriptions

### `src/app/` - UI and API

**`src/app/page.tsx`:**
- Main UI component
- Handles prompt input, Comparison Mode toggle, model count selection
- Manages streaming state (isStreaming, panels, error)
- Calls `/api/stream` endpoint
- Renders response panels and diff summary
- Implements localStorage persistence for UI settings

**`src/app/api/stream/route.ts`:**
- SSE streaming endpoint (`POST /api/stream`)
- Validates input (prompt length, model count)
- Routes single-answer requests to appropriate model
- Multiplexes Comparison Mode requests (2-3 models in parallel)
- Streams events: routing → chunks → metadata
- Implements per-model error isolation using `Promise.allSettled`

### `lib/llm/` - LLM Provider Integration

**Purpose:** Unified interface for all LLM provider implementations and intelligent routing.

**`providers/`:**
- `openai.ts` - OpenAI GPT models (gpt-5-mini, gpt-5.2)
- `anthropic.ts` - Anthropic Claude models (Opus, Sonnet, Haiku)
- `gemini.ts` - Google Gemini models (Flash, Pro)
- Each provider implements: `runModel()` and `streamModel()` functions

**`intent-router.ts`:**
- `IntentRouter` - Intelligent model selection based on prompt and attachments
- Analyzes user intent (coding, writing, vision, analysis)
- Routes to appropriate model with confidence scores
- Supports attachment-aware routing (images → Gemini, code → Claude)

**`router.ts`:**
- `routeToProvider()` - Maps model IDs to their provider implementations
- Handles dynamic imports and streaming setup

**`types.ts`:**
- `LLMRequest`, `LLMResponse` - Unified request/response types
- `ModelId` - Type-safe model identifiers

### `lib/diff/` - Comparison Analysis

**Purpose:** Compare outputs from multiple models in Comparison Mode to identify agreement, disagreement, omissions, and conflicts.

**`analyzer.ts`:**
- `DiffAnalyzer.analyze(responses[])` returns `DiffSummary`
- Identifies:
  - **Agreement:** Common phrases across all models
  - **Disagreement:** Contradictory statements
  - **Omissions:** Content present in some models but not others
  - **Conflicting assumptions:** Different foundational approaches

**`types.ts`:**
- `DiffSummary`: agreement, disagreement, omissions, conflictingAssumptions

**Note:** Diff analysis runs **client-side** and does **not block streaming**.

## SSE Event Contract

The `/api/stream` endpoint streams Server-Sent Events (SSE) in the format: `data: {json}\n\n`

### Event Types

#### 1. Routing Event

Sent **first** to indicate which model was selected and why.

**Single-Answer Mode:**
```json
{
  "type": "routing",
  "routing": {
    "model": "mock-quality-1",
    "reason": "Analytical comparison task requiring nuanced understanding",
    "confidence": 0.95
  }
}
```

**Comparison Mode (with modelId):**
```json
{
  "type": "routing",
  "modelId": "model-1",
  "routing": {
    "model": "mock-quality-1",
    "reason": "Analytical comparison task requiring nuanced understanding",
    "confidence": 0.95
  }
}
```

#### 2. Chunk Event

Sent **multiple times** as content is generated. The `done` field indicates whether this is the final chunk.

**Single-Answer Mode:**
```json
{
  "type": "chunk",
  "content": "React and Vue are both popular JavaScript frameworks",
  "done": false
}
```

**Final Chunk:**
```json
{
  "type": "chunk",
  "content": ".",
  "done": true
}
```

**Comparison Mode (with modelId):**
```json
{
  "type": "chunk",
  "modelId": "model-1",
  "content": "React and Vue are both popular JavaScript frameworks",
  "done": false
}
```

#### 3. Metadata Event

Sent **once** after streaming completes.

**Single-Answer Mode:**
```json
{
  "type": "metadata",
  "metadata": {
    "model": "mock-quality-1",
    "provider": "mock",
    "latency": 450,
    "tokenUsage": {
      "prompt": 10,
      "completion": 35,
      "total": 45
    },
    "estimatedCost": 0
  }
}
```

**Comparison Mode (with modelId):**
```json
{
  "type": "metadata",
  "modelId": "model-1",
  "metadata": {
    "model": "mock-quality-1",
    "provider": "mock",
    "latency": 450,
    "tokenUsage": {
      "prompt": 10,
      "completion": 35,
      "total": 45
    },
    "estimatedCost": 0
  }
}
```

#### 4. Error Event

Sent if an error occurs during streaming.

**Per-Model Error (Comparison Mode):**

Isolated to a specific panel. Other models continue processing.

```json
{
  "type": "error",
  "modelId": "model-1",
  "error": "Provider timeout"
}
```

**Global Error:**

Affects the entire stream (all panels).

```json
{
  "type": "error",
  "error": "Invalid request"
}
```

### Event Flow Examples

**Single-Answer Mode:**
1. `routing` → model selection and reason
2. `chunk` (done: false) → first text chunk
3. `chunk` (done: false) → more text
4. ...
5. `chunk` (done: true) → final text chunk
6. `metadata` → latency, tokens, cost

**Comparison Mode (2 models):**
1. `routing` (modelId: "model-1") → model selection for panel 1
2. `routing` (modelId: "model-2") → model selection for panel 2
3. `chunk` (modelId: "model-1", done: false) → text from model 1
4. `chunk` (modelId: "model-2", done: false) → text from model 2
5. ... chunks interleaved as they arrive ...
6. `chunk` (modelId: "model-1", done: true) → final chunk from model 1
7. `metadata` (modelId: "model-1") → metadata for model 1
8. `chunk` (modelId: "model-2", done: true) → final chunk from model 2
9. `metadata` (modelId: "model-2") → metadata for model 2

## Live LLM Providers

### Real Provider Integration

The application integrates with three major LLM providers:

**OpenAI:**
- Models: `gpt-5-mini` (fast), `gpt-5.2` (reasoning)
- Used for: General tasks, complex reasoning

**Anthropic Claude:**
- Models: `claude-sonnet-4-5`, `claude-opus-4-5`, `claude-haiku-4-5`
- Used for: Code analysis, writing, detailed responses

**Google Gemini:**
- Models: `gemini-2.5-flash` (fast), `gemini-2.5-pro` (quality)
- Used for: Vision tasks (screenshots), multimodal requests
- ✅ **Streaming simulation** - behaves like real providers (async chunks)
- ✅ **Standard interface** - implements the `Provider` interface that real providers will use

### Implementation Details

**Deterministic responses:**
- Uses a simple hash of the prompt to seed response generation
- Same prompt → same response (every time)
- Enables predictable testing

**Streaming simulation:**
- Splits response into chunks
- Yields chunks with configurable delay (mimics network latency)
- Returns async iterator compatible with real provider streaming

**Metadata generation:**
- Token usage from provider APIs
- Real latency measurement
- Cost estimation based on provider pricing
| **Reliability** | 100% | Subject to API outages |
| **Offline** | ✅ Works | ❌ Requires internet |
| **Testing** | ✅ Deterministic | ❌ Non-deterministic |
| **Setup** | None | API keys required |

## Data Flow

### Single-Answer Request

```
User Input (page.tsx)
  ↓
POST /api/stream { prompt }
  ↓
IntentRouter.route(prompt, attachments)
  ↓ RoutingDecision
Provider.stream(prompt, config)
  ↓ AsyncIterator<StreamChunk>
SSE Events: routing → chunks → metadata
  ↓
Client parses SSE events
  ↓
UI updates progressively
```

### Comparison Mode Request

```
User Input (page.tsx)
  ↓
POST /api/stream { prompt, models: ["model-1", "model-2"] }
  ↓
For each model in parallel:
  ├─ IntentRouter.route(prompt, model, attachments)
  ├─ Provider.stream(prompt, config)
  └─ SSE Events: routing → chunks → metadata (all with modelId)
  ↓
Client parses SSE events by modelId
  ↓
Each panel updates independently
  ↓
After all streams complete:
  DiffAnalyzer.analyze(responses) → DiffSummary
  ↓
UI shows comparison summary
```

## Key Design Decisions

### 1. SSE over WebSockets
- **Simpler protocol** - one-way server-to-client
- **HTTP compatible** - works through proxies and load balancers
- **Auto-reconnect** - browser handles reconnection
- **No buffering** - chunks sent immediately

### 2. Node.js Runtime (not Edge)
- **Streaming support** - Edge runtime has limitations
- **Provider compatibility** - some SDKs require Node.js
- **Debugging** - better tooling and error messages

### 3. Client-Side Diff Analysis
- **Non-blocking** - doesn't delay streaming
- **Parallel processing** - runs while streams complete
- **Graceful degradation** - if diff fails, streaming still works

### 4. Multi-Provider Support
- **OpenAI, Anthropic, Gemini** - three major providers integrated
- **Consistent interface** - all providers return same data structure
- **Dynamic routing** - requests routed to optimal provider

### 5. Rules-Based Routing (not ML)
- **Transparent** - users see why a model was chosen
- **Predictable** - same prompt always routes to same model
- **Maintainable** - rules can be adjusted without retraining
- **Cost-effective** - no ML inference overhead

## Limitations and Trade-offs

### Current MVP Constraints

1. **No database** - all state is in-memory or localStorage
2. **No authentication** - no user accounts or sessions
3. **Single user** - no multi-tenancy
4. **No retries** - errors require manual "Try again"
5. **Simple diff** - text-based comparison only (no semantic analysis)
6. **Max 3 models** - Comparison Mode limited to 3 parallel streams
7. **4,000 char prompt limit** - enforced at API level
8. **800 token max output** - enforced per request

### Intentional Design Choices

1. **Real providers** - OpenAI, Anthropic, and Gemini integrated
2. **Client-side persistence** - localStorage for UI settings only
3. **No prompt history** - no saved sessions or replay
4. **No export** - no download or share functionality
5. **No benchmarking** - no performance tracking or comparison
6. **No rate limiting** - assumed single-user local development

These constraints keep the MVP focused and implementation complexity low while allowing future expansion.
