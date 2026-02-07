# ModelTriage

## What is ModelTriage?

ModelTriage is an LLM decision and verification layer that intelligently routes prompts to the most appropriate model and optionally runs multiple models in parallel for comparison. Instead of guessing which model to use, ModelTriage analyzes your prompt and explains why it selected a particular model (e.g., analytical tasks get routed to quality-focused models, code tasks to code-specialized models). Comparison Mode allows side-by-side comparison of 2-3 models with automatic diff analysis to highlight agreements, disagreements, and conflicting assumptions. The system streams responses progressively using Server-Sent Events (SSE) for a responsive, real-time experience.

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
- **File attachments** (text + images) with strict token/cost guardrails

### ✅ Comparison Mode
- Toggle to enable multi-model comparison (default: OFF)
- Parallel execution of 2-3 models simultaneously
- Side-by-side streaming panels (each model streams independently)
- Per-panel error isolation (one failure doesn't affect others)
- Diff summary showing agreement, disagreement, omissions, and conflicts
- Cost warning displayed only when Comparison Mode is ON
- localStorage persistence for Comparison Mode settings and last prompt

### ✅ Routing Explanation
- Every request shows which model was selected and why
- Priority order: analytical → code → creative → long prompts → short prompts → general (fallback)
- Example: "Compare React and Vue" routes to `mock-quality-1` because it's an analytical task

### ✅ Diff Summary
- Automatically compares outputs from multiple models in Comparison Mode
- Highlights:
  - Agreement (what all models agree on)
  - Disagreement (where models differ)
  - Omissions (what some models include that others don't)
  - Conflicting assumptions (different foundational approaches)

### ✅ File Attachments with Smart Routing
- Attach up to **3 files** per request (text or images)
- **Supported text files**: `.txt`, `.log`, `.json`, `.md`, `.ts`, `.js`, `.env`, `.yml`
- **Supported images**: `.png`, `.jpg`, `.webp` (auto-resized for vision models)
- **Strict guardrails**:
  - Text files: 2MB max per file, 20k chars per file, 35k chars total
  - Images: 5MB max per file, 2 images max per request
  - Automatic truncation and summarization to prevent cost overruns
- **Smart routing**:
  - Screenshots → **Gemini 2.5 Pro** (vision-optimized, 92% cost reduction vs Opus)
  - Code/text files → **Claude Sonnet 4.5** (coding workhorse, 80% cost reduction vs Opus)
  - Deep reasoning (Opus, GPT-5.2) only on complexity signals
  - Fast models (Gemini Flash, GPT-5-mini) for lightweight requests
- See [docs/file-attachments.md](docs/file-attachments.md) and [docs/attachment-aware-routing.md](docs/attachment-aware-routing.md) for details

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

2. **Set up environment variables:**
   Create a `.env.local` file in the root directory:
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   
   **Note:** All three API keys are required for the app to function properly.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open the app:**
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

## Deploy to Vercel

ModelTriage is ready for zero-config deployment on Vercel.

### Quick Deploy

1. **Import your repository:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your Git repository

2. **Configure environment variables:**
   - Framework Preset: **Next.js** (auto-detected)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - **Environment Variables (Required):**
     - `OPENAI_API_KEY` - Your OpenAI API key (for GPT models)
     - `ANTHROPIC_API_KEY` - Your Anthropic API key (for Claude models)
     - `GEMINI_API_KEY` - Your Google Gemini API key (for Gemini models)
   
   **Note:** All three API keys are required for the app to build and run successfully.

3. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete (~2-3 minutes)

### Verify Deployment

After deployment, test the following:

**✅ Single-Answer Mode:**
1. Enter a prompt (e.g., "Explain React hooks")
2. Verify response streams progressively (not all at once)
3. Check routing explanation displays correctly
4. Verify metadata shows (model, latency, tokens)

**✅ Comparison Mode:**
1. Enable Comparison Mode toggle
2. Select 2 or 3 models
3. Enter a prompt
4. Verify both/all panels stream independently
5. Check diff summary appears after streaming completes

**✅ Error Handling:**
1. Test empty prompt (should show validation)
2. Test prompt > 4,000 characters (should show error)
3. Cancel a streaming request (should preserve partial output)

### Deployment Notes

**Runtime:**
- The `/api/stream` endpoint uses Node.js runtime (not Edge) for optimal SSE streaming
- This is configured in `src/app/api/stream/route.ts` with `export const runtime = "nodejs"`

**MockProvider:**
- The app uses MockProvider by default (zero external API calls)
- No API keys or secrets required
- All responses are deterministic and work offline

**Environment Variables:**
- None required for MVP
- Future flags (`USE_LIVE_PROVIDERS`, `ENABLE_DB_WRITES`) are not yet implemented

**Streaming:**
- SSE streaming works out-of-the-box on Vercel
- No additional configuration needed
- Chunks are not buffered (progressive rendering confirmed)

**Limitations:**
- Serverless function timeout: 10 seconds on free tier (sufficient for MockProvider)
- Concurrent executions: 100 on free tier (ample for testing)

### Troubleshooting Deployment

**Problem: Streaming appears buffered**
- **Cause:** Browser caching or CDN edge caching
- **Solution:** Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- **Verification:** Open DevTools → Network → check EventStream tab

**Problem: Build fails with TypeScript errors**
- **Cause:** Type errors in code
- **Solution:** Run `npm run build` locally to identify issues
- **Fix:** Run `npm run lint` and resolve errors

**Problem: 404 on API routes**
- **Cause:** Incorrect file structure
- **Solution:** Verify `src/app/api/stream/route.ts` exists
- **Verification:** Check deployment logs for file tree

**Problem: Application crashes**
- **Cause:** Missing dependencies
- **Solution:** Verify `package.json` includes all dependencies
- **Check:** Deployment logs for "Module not found" errors

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
- Multiple models can stream in parallel (Comparison Mode)

### Comparison Mode (High-Level)

When Comparison Mode is enabled, the workflow changes:

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
│   ├── page.tsx          # Main UI with Comparison Mode
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── lib/                  # Core library modules
│   ├── providers/        # Provider interface + MockProvider
│   ├── routing/          # Rules-based router
│   └── diff/             # Diff analyzer for Comparison Mode
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
- Single endpoint for both single-answer and Comparison Mode
- Validates input (prompt length, model count)
- Streams SSE events with proper multiplexing for Comparison Mode
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
- `deployment-checklist.md` - Vercel deployment verification and post-deployment testing

### Feature Documentation
- `streaming-api.md` - SSE endpoint reference
- `comparison-mode.md` - Comparison Mode implementation details
- `routing.md` - Routing logic and priority rules
- `persistence.md` - localStorage usage
- `ui-states.md` - UI states, button behavior, and user actions
- `execution-correctness.md` - Concurrent run prevention and error isolation
