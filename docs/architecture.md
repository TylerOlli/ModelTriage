# Architecture Documentation

## Overview

ModelTriage is built on Next.js 16 (App Router) with React 19, TypeScript, and Tailwind CSS. The backend uses Supabase for authentication, PostgreSQL (via Prisma) for data persistence, and Server-Sent Events (SSE) for real-time response streaming. The architecture separates concerns into UI pages, reusable components, API routes, and core library modules (providers, routing, attachments, auth, diff analysis).

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + Tailwind CSS
- **Language:** TypeScript (strict)
- **Database:** PostgreSQL (Supabase-hosted)
- **ORM:** Prisma
- **Auth:** Supabase Auth (email/password)
- **Runtime:** Node.js (SSE streaming requires non-Edge runtime)
- **Deployment:** Vercel

## Folder Structure

```
modeltriage/
├── src/app/                       # Next.js App Router — pages + API routes
│   ├── page.tsx                   # Homepage — prompt input, streaming responses
│   ├── layout.tsx                 # Root layout (AuthProvider, Nav)
│   ├── pricing/page.tsx           # Public — Free/Pro plan details + FAQ
│   ├── about/page.tsx             # Public — How ModelTriage works
│   ├── dashboard/page.tsx         # Authenticated — usage stats, routing history
│   ├── account/page.tsx           # Authenticated — profile, password, data export, deletion
│   ├── auth/callback/route.ts     # Supabase OAuth callback
│   └── api/
│       ├── stream/route.ts        # SSE streaming endpoint (single + compare)
│       ├── compare/route.ts       # Comparison summary endpoint
│       ├── usage/route.ts         # Usage stats for auth UI
│       ├── dashboard/route.ts     # Dashboard data (usage chart, decisions)
│       └── account/
│           ├── delete/route.ts    # Account + data deletion
│           └── export/route.ts    # Data export (JSON download)
│
├── src/components/                # Reusable React components
│   ├── Nav.tsx                    # Shared navigation bar
│   ├── PromptComposer.tsx         # Prompt input, file attachments, history, model chips
│   ├── AutoResponseView.tsx       # Auto-select mode response display
│   ├── CompareResponseView.tsx    # Compare mode grid + diff summary
│   ├── ConversationHistory.tsx    # Previous turns accordion
│   ├── FollowUpComposer.tsx       # Follow-up prompt input
│   ├── FormattedResponse.tsx      # Markdown rendering for LLM output
│   ├── CodeBlock.tsx              # Syntax-highlighted code blocks
│   ├── ModelSelectionCard.tsx     # "Why this model?" fit scoring panel
│   └── auth/                      # Auth-related UI
│       ├── AuthProvider.tsx       # Auth context + usage state
│       ├── LoginModal.tsx         # Email/password login/signup modal
│       ├── UserMenu.tsx           # User dropdown, dashboard/account links
│       ├── AuthGate.tsx           # Limit-exceeded prompt
│       ├── UpgradeBanner.tsx      # Approaching-limit warning
│       └── RequireAuth.tsx        # Auth guard wrapper for protected pages
│
├── lib/                           # Core library modules
│   ├── llm/                       # LLM providers + routing
│   │   ├── intent-router.ts       # IntentRouter — prompt analysis + model selection
│   │   ├── router.ts              # routeToProvider() — maps model IDs to providers
│   │   ├── prompt-classifier.ts   # LLM-based prompt classification (fallback)
│   │   ├── capability-matrix.ts   # Model capabilities and characteristics
│   │   ├── scoring-engine.ts      # Multi-signal scoring for model selection
│   │   ├── scoring-types.ts       # Scoring type definitions
│   │   ├── score-breakdown.ts     # Fit breakdown types + validation (Zod)
│   │   ├── types.ts               # LLMRequest, LLMResponse, ModelId
│   │   └── providers/
│   │       ├── openai.ts          # OpenAI — gpt-5-mini, gpt-5.2
│   │       ├── anthropic.ts       # Anthropic — claude-sonnet-4-5, claude-opus-4-5, claude-haiku-4-5
│   │       └── gemini.ts          # Google — gemini-3-flash-preview, gemini-3-pro-preview
│   │
│   ├── auth/                      # Authentication utilities
│   │   ├── session.ts             # JWT validation + profile cache
│   │   ├── gates.ts               # Feature flags + limit configuration
│   │   ├── limits.ts              # Usage tracking (atomic upserts)
│   │   ├── supabase-server.ts     # Server-side Supabase client
│   │   └── supabase-browser.ts    # Browser-side Supabase client
│   │
│   ├── db/                        # Database utilities
│   │   ├── prisma.ts              # Prisma client singleton
│   │   └── persist-routing.ts     # Routing decision persistence
│   │
│   ├── attachments/               # File attachment processing
│   │   ├── processor.ts           # Main attachment processor
│   │   ├── complexity-detector.ts # Attachment complexity analysis
│   │   ├── gist-generator.ts      # Text summarization for long files
│   │   ├── image-resizer.ts       # Image preprocessing for vision models
│   │   ├── image-gist-schema.ts   # Image analysis schema
│   │   ├── request-parser.ts      # Multipart form parsing
│   │   └── vision-support.ts      # Vision model capability detection
│   │
│   ├── diff/                      # Comparison analysis
│   │   ├── analyzer.ts            # DiffAnalyzer — agreement, disagreement, omissions
│   │   ├── types.ts               # DiffSummary types
│   │   └── index.ts               # Module exports
│   │
│   ├── constants.ts               # Plan definitions (Free/Pro limits, pricing)
│   ├── models.ts                  # Model definitions + display utilities
│   ├── session-types.ts           # Session/panel type definitions
│   ├── prompt-cache.ts            # Client-side prompt hash ↔ text cache
│   ├── file-validation.ts         # Denylist-based file type validation
│   ├── response-parser.ts         # LLM response parsing utilities
│   ├── code-lang-utils.ts         # Code language detection
│   └── errors.ts                  # Centralized error reporting
│
├── prisma/
│   └── schema.prisma              # Database schema (Profile, DailyUsage, RoutingDecision)
│
├── supabase/
│   └── setup.sql                  # Auto-profile trigger + Row Level Security
│
├── __tests__/                     # Unit + integration tests
│   ├── llm/                       # Router + scoring tests
│   ├── diff/                      # Diff analyzer tests
│   └── attachments/               # Attachment processor tests
│
├── docs/                          # Technical documentation
├── .specify/                      # Product specifications
└── env.example                    # Environment variable reference
```

## Pages

### Public Pages
| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Homepage — prompt input, streaming responses, comparison mode |
| `/pricing` | `src/app/pricing/page.tsx` | Free/Pro plan comparison with FAQ |
| `/about` | `src/app/about/page.tsx` | How ModelTriage works, supported models, privacy |

### Authenticated Pages
| Route | File | Description |
|-------|------|-------------|
| `/dashboard` | `src/app/dashboard/page.tsx` | Usage chart, model distribution, routing history |
| `/account` | `src/app/account/page.tsx` | Profile, password change, data export, account deletion |

### API Routes
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/stream` | POST | Optional | SSE streaming — single or comparison mode |
| `/api/compare` | POST | Optional | Comparison summary generation |
| `/api/usage` | GET | Required | Current usage stats for auth UI |
| `/api/dashboard` | GET | Required | Dashboard data (chart, decisions, distribution) |
| `/api/account/delete` | DELETE | Required | Full account + data deletion |
| `/api/account/export` | GET | Required | JSON data export download |

## Data Flow

### Single-Answer Request

```
User Input (PromptComposer)
  ↓
POST /api/stream { prompt, attachments? }
  ↓
Auth check → Usage limit check → Increment usage
  ↓
IntentRouter.route(prompt, attachments)
  ↓ RoutingDecision (model, reason, confidence, fitBreakdown)
  ↓
persistRoutingDecision() → PostgreSQL
  ↓
Provider.stream(prompt, config)
  ↓ AsyncIterator<StreamChunk>
SSE Events: routing → chunks → metadata
  ↓
Client parses SSE → AutoResponseView updates progressively
```

### Comparison Mode Request

```
User Input (PromptComposer)
  ↓
POST /api/stream { prompt, models: ["model-1", "model-2", ...] }
  ↓
Auth check → Usage limit check → Increment usage
  ↓
For each model in parallel (Promise.allSettled):
  ├─ IntentRouter.route(prompt, model, attachments)
  ├─ persistRoutingDecision()
  ├─ Provider.stream(prompt, config)
  └─ SSE Events: routing → chunks → metadata (all with modelId)
  ↓
Client parses SSE by modelId → CompareResponseView panels update independently
  ↓
After all streams complete:
  DiffAnalyzer.analyze(responses) → DiffSummary
  ↓
UI shows comparison summary with verdict
```

## SSE Event Contract

The `/api/stream` endpoint streams events in `data: {json}\n\n` format.

| Event | When | Fields |
|-------|------|--------|
| `routing` | First | `model`, `reason`, `confidence`, `fitBreakdown` |
| `chunk` | Multiple | `content`, `done` (boolean) |
| `metadata` | After streaming | `model`, `provider`, `latency`, `tokenUsage`, `estimatedCost` |
| `error` | On failure | `error` message |

In Comparison Mode, each event also includes a `modelId` field to identify the panel.

## LLM Providers

| Provider | Models | Strengths |
|----------|--------|-----------|
| **OpenAI** | `gpt-5-mini` (fast), `gpt-5.2` (reasoning) | General tasks, complex reasoning |
| **Anthropic** | `claude-sonnet-4-5`, `claude-opus-4-5`, `claude-haiku-4-5` | Code analysis, writing, detailed responses |
| **Google Gemini** | `gemini-3-flash-preview` (fast), `gemini-3-pro-preview` (quality) | Vision tasks, multimodal requests |

All providers implement the same streaming interface via `runModel()` and `streamModel()` functions.

## Authentication & Authorization

```
Browser → Supabase Auth (email/password)
  ↓ JWT
API routes → lib/auth/session.ts → validate JWT → load profile
  ↓
lib/auth/gates.ts → check role + feature flags
  ↓
lib/auth/limits.ts → atomic DailyUsage upsert → allow or deny
```

**User tiers:**
- **Anonymous:** Lifetime cap (default 3 requests), tracked via localStorage `anonId`
- **Free:** Daily cap (default 15 requests/day)
- **Pro:** Higher daily cap (default 200 requests/day)

**Protected pages** use `<RequireAuth>` wrapper component, which redirects unauthenticated users to `/`.

## Database Schema (Prisma)

Key models:
- **Profile** — user metadata, role, Stripe fields (future)
- **DailyUsage** — per-user daily request counts (atomic upserts)
- **RoutingDecision** — every routing decision with classification, scoring, model selection, prompt hash (never raw prompts)

## Key Design Decisions

1. **SSE over WebSockets** — simpler one-way protocol, HTTP-compatible, auto-reconnect
2. **Node.js runtime (not Edge)** — required for streaming and provider SDK compatibility
3. **Client-side diff analysis** — non-blocking, runs after streams complete
4. **Rules-based routing (not ML)** — transparent, predictable, maintainable, no inference overhead
5. **Privacy-by-design** — prompt hashes stored, never raw prompts; client-side prompt cache for display
6. **Atomic usage tracking** — Prisma `upsert` prevents race conditions in daily counters
7. **Component architecture** — UI split into focused components vs monolithic page.tsx
