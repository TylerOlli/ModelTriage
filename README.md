# ModelTriage

LLM decision and verification layer

## Development

Install dependencies:
```bash
npm install
```

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Test the MockProvider:
```bash
npm run test:mock     # Run unit tests
npm run test:routing  # Test model routing
npm run demo:mock     # Run streaming demo
npm run test:stream   # Test streaming API (requires dev server)
```

Test the streaming API in your browser:
- Main app: [http://localhost:3000](http://localhost:3000)
- API test page: [http://localhost:3000/test-stream.html](http://localhost:3000/test-stream.html)

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Runtime:** Node.js
- **Deployment:** Vercel

## Project Structure

```
modeltriage/
├── src/
│   └── app/             # App Router directory
│       ├── api/         # API routes
│       │   └── stream/  # SSE streaming endpoint (single + verify mode)
│       ├── layout.tsx   # Root layout
│       ├── page.tsx     # Home page with Verify Mode UI
│       └── globals.css  # Global styles
├── lib/                 # Core library code
│   ├── providers/       # LLM provider interfaces and implementations
│   │   ├── types.ts     # Provider interface definitions
│   │   ├── mock-provider.ts  # Mock provider for development
│   │   └── index.ts     # Exports
│   ├── routing/         # Model routing logic
│   │   ├── types.ts     # Routing types
│   │   ├── router.ts    # Rules-based router
│   │   └── index.ts     # Exports
│   └── diff/            # Diff analysis for Verify Mode
│       ├── types.ts     # Diff types
│       ├── analyzer.ts  # Diff analyzer
│       └── index.ts     # Exports
├── public/              # Static files
│   └── test-stream.html # Stream API test client
├── __tests__/           # Test files
│   ├── providers/       # Provider tests
│   └── routing/         # Routing tests
├── scripts/             # Utility scripts
├── .specify/            # Product specifications
├── docs/                # Documentation
└── package.json         # Dependencies
```

## Features

### Single-Answer Mode (MVP)

The main application interface provides:

- **Prompt input** - Text area for entering prompts (max 4,000 characters)
- **Smart routing** - Automatic model selection with explanation
- **Real-time streaming** - Responses stream progressively as they're generated
- **Loading states** - Clear visual feedback during streaming
- **Metadata display** - Shows model, provider, latency, and token usage
- **Error handling** - Graceful error messages with partial output preservation
- **Cancel functionality** - Ability to stop streaming (partial output preserved)
- **Input validation** - Character counter and length enforcement

**Routing Logic (priority order):**
- Analytical tasks → `mock-quality-1` (e.g., "Compare React and Vue")
- Code-related prompts → `mock-code-1` (e.g., "Write a function...")
- Creative writing → `mock-quality-1`
- Long prompts (> 1000 chars) → `mock-quality-1`
- Short prompts (< 50 chars) → `mock-fast-1`
- General prompts → `mock-balanced-1` (fallback)

### Verify Mode (Optional)

Multi-model comparison with side-by-side panels:

- **Toggle control** - Enable/disable Verify Mode (default: OFF)
- **Model selection** - Choose 2 or 3 models (default: 2, max: 3)
- **Parallel execution** - All models stream simultaneously
- **Independent panels** - Each model has its own streaming panel
- **Error isolation** - One model failure doesn't affect others
- **Diff summary** - Highlights agreement, disagreement, omissions, and conflicts
- **Cost warning** - Clearly labeled as higher cost and latency

**Not yet implemented:**
- Feedback/rating system
- Rate limiting UI
- Real providers (still using MockProvider)

## MockProvider

The `MockProvider` simulates an LLM with streaming for development and testing:

- **No external API calls** - Fully deterministic, works offline
- **Streaming simulation** - Returns async iterators of text chunks
- **Deterministic output** - Same prompt always produces the same response
- **Provider interface** - Implements the standard `Provider` interface that real providers (OpenAI, Anthropic) will implement

### Cost Control

By default, the application uses `MockProvider` unless `USE_LIVE_PROVIDERS=true` is set. This ensures:
- No accidental API costs during development
- Fast, reliable testing
- Predictable behavior

## Streaming API

The `/api/stream` endpoint provides Server-Sent Events (SSE) streaming:

**Endpoint:** `POST /api/stream`

**Request body:**
```json
{
  "prompt": "Your prompt here",
  "model": "optional-model-name",
  "maxTokens": 800
}
```

**Response:** SSE stream with events:
- `chunk` - Text chunks as they're generated
- `metadata` - Final metadata (latency, tokens, cost)
- `error` - Error information if something fails

**Features:**
- ✅ Node.js runtime (not Edge)
- ✅ No buffering - chunks stream immediately
- ✅ One stream per request
- ✅ Clean stream closure on completion
- ✅ Input validation (max 4,000 characters)
- ✅ Max output tokens enforced (800 default)

## Specifications

This project is built strictly according to specifications in `.specify/`:
- `product.md` - Product definition
- `conventions.md` - Technical conventions
- `user-stories.md` - User stories
- `requirements.md` - Functional requirements
