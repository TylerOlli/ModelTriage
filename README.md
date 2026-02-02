# ModelTriage

## What is ModelTriage?

ModelTriage is an LLM decision and verification layer that intelligently routes prompts to the most appropriate model and optionally runs multiple models in parallel for comparison. Instead of guessing which model to use, ModelTriage analyzes your prompt and explains why it selected a particular model (e.g., analytical tasks get routed to quality-focused models, code tasks to code-specialized models). Verify Mode allows side-by-side comparison of 2-3 models with automatic diff analysis to highlight agreements, disagreements, and conflicting assumptions. The system streams responses progressively using Server-Sent Events (SSE) for a responsive, real-time experience.

## MVP v1 Features

This is the **MVP (Minimum Viable Product)** implementation. The following features are **fully implemented**:

### ✅ Single-Answer Mode
- Smart rules-based routing with human-readable explanation
- Real-time SSE streaming (no buffering)
- Loading states and partial output preservation
- Model metadata (latency, tokens, provider)
- Cancel functionality
- Error handling with "Try again" action
- Clear button to reset UI
- Input validation (4,000 character max)

### ✅ Verify Mode
- Toggle to enable multi-model comparison (default: OFF)
- Parallel execution of 2-3 models simultaneously
- Side-by-side streaming panels (each model streams independently)
- Per-panel error isolation (one failure doesn't affect others)
- Diff summary showing agreement, disagreement, omissions, and conflicts
- Cost warning displayed only when Verify Mode is ON
- localStorage persistence for Verify Mode settings and last prompt

### ✅ Routing Explanation
- Every request shows which model was selected and why
- Priority order: analytical → code → creative → long prompts → short prompts → general (fallback)
- Example: "Compare React and Vue" routes to `mock-quality-1` because it's an analytical task

### ✅ Diff Summary
- Automatically compares outputs from multiple models in Verify Mode
- Highlights:
  - Agreement (what all models agree on)
  - Disagreement (where models differ)
  - Omissions (what some models include that others don't)
  - Conflicting assumptions (different foundational approaches)

## What is NOT Implemented (Intentional)

The following are **explicitly out of scope** for MVP v1:

- ❌ Real LLM providers (OpenAI, Anthropic, Google) - using MockProvider only
- ❌ Database persistence (no user accounts, no saved sessions)
- ❌ Feedback/rating system
- ❌ Rate limiting UI
- ❌ Retry logic (errors require manual "Try again")
- ❌ Authentication or user management
- ❌ Cost tracking or billing
- ❌ Advanced diff features (semantic analysis, syntax highlighting)
- ❌ Model performance benchmarking
- ❌ Export/share functionality

## Local Setup

### Prerequisites
- Node.js 18+ and npm

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open the app:**
   - Navigate to [http://localhost:3000](http://localhost:3000) in your browser

### Testing

Run unit tests:
```bash
npm run test:mock     # Test MockProvider
npm run test:routing  # Test routing logic
```

Run integration tests (requires dev server running):
```bash
npm run test:stream   # Test streaming API
```

## How It Works

### Streaming (High-Level)

ModelTriage uses **Server-Sent Events (SSE)** to stream LLM responses in real-time:

1. **Client sends prompt** → `POST /api/stream` with prompt text
2. **Server routes request** → Rules-based router selects appropriate model
3. **Provider streams chunks** → MockProvider generates response chunks asynchronously
4. **SSE delivers chunks** → Server forwards chunks to client as `data: {...}` events
5. **UI renders progressively** → Client appends each chunk to the display in real-time
6. **Metadata sent on completion** → Final event includes latency, tokens, and cost

**Key benefits:**
- No buffering delays (chunks appear immediately)
- Partial output preserved if stream is cancelled or errors
- Clean stream closure on completion
- Multiple models can stream in parallel (Verify Mode)

### Verify Mode (High-Level)

When Verify Mode is enabled, the workflow changes:

1. **Client sends prompt with model list** → `POST /api/stream` with `models: ["model-1", "model-2"]`
2. **Server starts parallel streams** → Each model gets its own provider instance
3. **Events are multiplexed** → SSE events include `modelId` to identify the source panel
4. **Panels stream independently** → Each panel updates as its model streams
5. **Error isolation** → If one model fails, others continue (failed panel shows error card)
6. **Diff analysis runs after completion** → Compares successful outputs to generate summary

**Key benefits:**
- See how different models approach the same prompt
- Identify which model provides the most complete or accurate answer
- Catch hallucinations or omissions by comparing outputs
- Understand trade-offs between speed, quality, and cost

## Architecture

### Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Runtime:** Node.js (SSE streaming)
- **Testing:** Jest + ts-jest

### Project Structure

```
modeltriage/
├── src/app/              # Next.js App Router
│   ├── api/stream/       # SSE streaming endpoint
│   ├── page.tsx          # Main UI with Verify Mode
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── lib/                  # Core library modules
│   ├── providers/        # Provider interface + MockProvider
│   ├── routing/          # Rules-based router
│   └── diff/             # Diff analyzer for Verify Mode
├── __tests__/            # Unit tests
├── docs/                 # Technical documentation
├── .specify/             # Product specifications (source of truth)
└── package.json          # Dependencies and scripts
```

### Key Modules

**Provider Interface (`lib/providers/`):**
- Defines the contract for all LLM providers
- `MockProvider` implements this interface for development
- Real providers (OpenAI, Anthropic) will implement the same interface

**Router (`lib/routing/`):**
- Rules-based model selection
- Returns model name, reason, and confidence
- Prioritizes analytical intents over code keyword matches

**Diff Analyzer (`lib/diff/`):**
- Compares outputs from multiple models
- Identifies agreement, disagreement, omissions, and conflicts
- Runs client-side to avoid blocking streaming

**Streaming API (`src/app/api/stream/`):**
- Single endpoint for both single-answer and Verify Mode
- Validates input (prompt length, model count)
- Streams SSE events with proper multiplexing for Verify Mode
- Per-model error isolation (uses `Promise.allSettled`)

## Future Flags (Not Yet Implemented)

The following environment variables are **reserved for future use** but do NOT currently work:

### `USE_LIVE_PROVIDERS=true` (Future)
When implemented, this will:
- Enable OpenAI, Anthropic, and Google providers
- Require API keys in environment variables
- Incur real API costs

**Current behavior:** Only MockProvider is available regardless of this flag.

### `ENABLE_DB_WRITES=true` (Future)
When implemented, this will:
- Enable session persistence to database
- Save prompts, responses, and user ratings
- Require database connection string

**Current behavior:** No database writes occur regardless of this flag. Only localStorage is used for UI settings.

## Cost Control

By default, the application uses `MockProvider` to ensure:
- ✅ No accidental API costs during development
- ✅ Deterministic, reproducible testing
- ✅ Offline development capability
- ✅ Fast response times

## Specifications

This project is built strictly according to specifications in `.specify/`:
- `product.md` - Product definition and scope
- `conventions.md` - Technical conventions and limits
- `user-stories.md` - User stories and acceptance criteria
- `requirements.md` - Functional requirements

## Documentation

See `docs/` for detailed technical documentation:

### Core Documentation
- `architecture.md` - System architecture, folder structure, SSE event contract, and MockProvider rationale
- `development.md` - Development commands, workflow, and troubleshooting guide

### Feature Documentation
- `streaming-api.md` - SSE endpoint reference
- `verify-mode.md` - Verify Mode implementation details
- `routing.md` - Routing logic and priority rules
- `persistence.md` - localStorage usage
- `ui-states.md` - Empty, loading, and error states
- `streaming-controls.md` - Control locking and cancel behavior
- `execution-correctness.md` - Concurrent run prevention and error isolation
- `hardening-summary.md` - Robustness improvements overview
