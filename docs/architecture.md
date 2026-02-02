# Architecture Documentation

## Overview

ModelTriage is built on Next.js 15 (App Router) with TypeScript and Tailwind CSS. The architecture separates concerns into UI (Next.js pages), API (SSE streaming endpoints), and core library modules (providers, routing, diff analysis).

## Folder Structure

```
modeltriage/
├── src/app/                    # Next.js App Router
│   ├── api/stream/
│   │   └── route.ts            # SSE streaming endpoint (single + Verify Mode)
│   ├── page.tsx                # Main UI with prompt input, Verify Mode toggle
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
│   └── diff/                   # Diff analysis for Verify Mode
│       ├── types.ts            # Diff types (DiffSummary)
│       ├── analyzer.ts         # DiffAnalyzer implementation
│       └── index.ts            # Exports
│
├── __tests__/                  # Unit tests
│   ├── providers/
│   │   └── mock-provider.test.ts
│   └── routing/
│       └── router.test.ts
│
├── docs/                       # Documentation
├── .specify/                   # Product specifications (source of truth)
└── package.json
```

## Module Descriptions

### `src/app/` - UI and API

**`src/app/page.tsx`:**
- Main UI component
- Handles prompt input, Verify Mode toggle, model count selection
- Manages streaming state (isStreaming, panels, error)
- Calls `/api/stream` endpoint
- Renders response panels and diff summary
- Implements localStorage persistence for UI settings

**`src/app/api/stream/route.ts`:**
- SSE streaming endpoint (`POST /api/stream`)
- Validates input (prompt length, model count)
- Routes single-answer requests to appropriate model
- Multiplexes Verify Mode requests (2-3 models in parallel)
- Streams events: routing → chunks → metadata
- Implements per-model error isolation using `Promise.allSettled`

### `lib/providers/` - Provider Abstraction

**Purpose:** Define a uniform interface for LLM providers to enable swapping between MockProvider and real providers (OpenAI, Anthropic, etc.) without changing application code.

**`types.ts`:**
- `Provider` interface: `stream(prompt, config) => Promise<ProviderResponse>`
- `ProviderConfig`: maxTokens, temperature, etc.
- `StreamChunk`: content, done
- `StreamMetadata`: model, provider, latency, tokenUsage, estimatedCost

**`mock-provider.ts`:**
- Implements `Provider` interface
- Simulates streaming with deterministic output
- No external API calls (zero cost)
- Generates predictable responses based on prompt hash

**Future providers:**
- `openai-provider.ts` (not yet implemented)
- `anthropic-provider.ts` (not yet implemented)
- `google-provider.ts` (not yet implemented)

### `lib/routing/` - Model Selection

**Purpose:** Rules-based routing to select the most appropriate model for a given prompt.

**`router.ts`:**
- `ModelRouter.route(prompt)` returns `RoutingDecision`
- Priority order:
  1. Analytical tasks → `mock-quality-1`
  2. Code-related prompts → `mock-code-1`
  3. Creative writing → `mock-quality-1`
  4. Long prompts (> 1000 chars) → `mock-quality-1`
  5. Short prompts (< 50 chars) → `mock-fast-1`
  6. General prompts → `mock-balanced-1` (fallback)

**`types.ts`:**
- `RoutingDecision`: model, reason, confidence

### `lib/diff/` - Comparison Analysis

**Purpose:** Compare outputs from multiple models in Verify Mode to identify agreement, disagreement, omissions, and conflicts.

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

**Verify Mode (with modelId):**
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

**Verify Mode (with modelId):**
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

**Verify Mode (with modelId):**
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

**Per-Model Error (Verify Mode):**

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

**Verify Mode (2 models):**
1. `routing` (modelId: "model-1") → model selection for panel 1
2. `routing` (modelId: "model-2") → model selection for panel 2
3. `chunk` (modelId: "model-1", done: false) → text from model 1
4. `chunk` (modelId: "model-2", done: false) → text from model 2
5. ... chunks interleaved as they arrive ...
6. `chunk` (modelId: "model-1", done: true) → final chunk from model 1
7. `metadata` (modelId: "model-1") → metadata for model 1
8. `chunk` (modelId: "model-2", done: true) → final chunk from model 2
9. `metadata` (modelId: "model-2") → metadata for model 2

## Why MockProvider Exists

### Zero Cost Development

**Problem:** Real LLM providers (OpenAI, Anthropic, Google) charge per API call. During development and testing, hundreds of requests can quickly become expensive.

**Solution:** `MockProvider` simulates an LLM locally with:
- ✅ **No external API calls** - works offline
- ✅ **Zero API costs** - no accidental charges
- ✅ **Deterministic output** - same prompt always produces the same response
- ✅ **Streaming simulation** - behaves like real providers (async chunks)
- ✅ **Standard interface** - implements the `Provider` interface that real providers will use

### Development Workflow

1. **Default mode:** `MockProvider` only (cost: $0)
2. **Future mode:** `USE_LIVE_PROVIDERS=true` enables real providers (cost: varies)

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
- Calculates realistic token counts based on content length
- Returns zero cost for all MockProvider requests
- Includes latency measurement (simulated)

### Benefits

| Aspect | MockProvider | Real Providers |
|--------|-------------|----------------|
| **Cost** | $0 | $0.01 - $0.10+ per request |
| **Speed** | Instant | Network-dependent |
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
ModelRouter.route(prompt)
  ↓ RoutingDecision
MockProvider.stream(prompt, config)
  ↓ AsyncIterator<StreamChunk>
SSE Events: routing → chunks → metadata
  ↓
Client parses SSE events
  ↓
UI updates progressively
```

### Verify Mode Request

```
User Input (page.tsx)
  ↓
POST /api/stream { prompt, models: ["model-1", "model-2"] }
  ↓
For each model in parallel:
  ├─ ModelRouter.route(prompt, model)
  ├─ MockProvider.stream(prompt, config)
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

### 4. Provider Interface Abstraction
- **Future-proof** - easy to add new providers
- **Testable** - MockProvider enables offline testing
- **Consistent** - all providers return same data structure

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
6. **Max 3 models** - Verify Mode limited to 3 parallel streams
7. **4,000 char prompt limit** - enforced at API level
8. **800 token max output** - enforced per request

### Intentional Design Choices

1. **MockProvider only** - real providers not yet integrated
2. **Client-side persistence** - localStorage for UI settings only
3. **No prompt history** - no saved sessions or replay
4. **No export** - no download or share functionality
5. **No benchmarking** - no performance tracking or comparison
6. **No rate limiting** - assumed single-user local development

These constraints keep the MVP focused and implementation complexity low while allowing future expansion.
