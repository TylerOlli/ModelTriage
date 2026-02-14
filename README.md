# ModelTriage

## What is ModelTriage?

ModelTriage is an LLM decision and verification layer that intelligently routes prompts to the most appropriate model and optionally runs multiple models in parallel for comparison. Instead of guessing which model to use, ModelTriage analyzes your prompt and explains why it selected a particular model (e.g., analytical tasks get routed to quality-focused models, code tasks to code-specialized models). Comparison Mode allows side-by-side comparison of 2-3 models with automatic diff analysis to highlight agreements, disagreements, and conflicting assumptions. The system streams responses progressively using Server-Sent Events (SSE) for a responsive, real-time experience.

## Features

### Single-Answer Mode
- Smart rules-based routing with human-readable explanation
- Real-time SSE streaming (no buffering)
- Loading states and partial output preservation
- Model metadata (latency, tokens, provider)
- Cancel functionality
- Error handling with "Try again" action
- Clear button to reset UI
- Input validation (4,000 character max)
- **File attachments** (text + images) with strict token/cost guardrails

### Comparison Mode
- Toggle to enable multi-model comparison (default: OFF)
- Parallel execution of 2-3 models simultaneously
- Side-by-side streaming panels (each model streams independently)
- Per-panel error isolation (one failure doesn't affect others)
- Diff summary showing agreement, disagreement, omissions, and conflicts
- Cost warning displayed only when Comparison Mode is ON
- localStorage persistence for Comparison Mode settings and last prompt

### Authentication & Monetization (Phase 1)
- **Supabase Auth** with email/password signup and login
- **Role-based access control** — free and pro tiers
- **Database-backed usage tracking** with atomic increments (no race conditions)
  - Anonymous users: lifetime cap (default 3 requests)
  - Free users: daily cap (default 15 requests/day)
  - Pro users: higher daily cap (default 200 requests/day)
- **API-level enforcement** — limits checked before streaming begins
- **Auth UI** — login modal, user menu with usage bar, auth gate, upgrade banner
- **Account deletion** — full data removal with Supabase admin API
- **Password strength requirements** — 8+ chars, uppercase/lowercase, number
- Configurable limits via environment variables (no redeploy needed)
- `AUTH_DISABLED=true` env var for local development bypass
- Designed for future Stripe integration (`stripeCustomerId` in schema)

### File Attachments with Smart Routing
- Attach up to **3 files** per request (text or images)
- **Supported text files**: `.txt`, `.log`, `.json`, `.md`, `.ts`, `.js`, `.env`, `.yml`
- **Supported images**: `.png`, `.jpg`, `.webp` (auto-resized for vision models)
- **Strict guardrails**:
  - Text files: 2MB max per file, 20k chars per file, 35k chars total
  - Images: 5MB max per file, 2 images max per request
  - Automatic truncation and summarization to prevent cost overruns
- **Smart routing**:
  - Screenshots → **Gemini 3 Pro** (vision-optimized)
  - Code/text files → **Claude Sonnet 4.5** (coding workhorse)
  - Deep reasoning (Opus, GPT-5.2) only on complexity signals
  - Fast models (Gemini Flash, GPT-5-mini) for lightweight requests
- See [docs/file-attachments.md](docs/file-attachments.md) and [docs/attachment-aware-routing.md](docs/attachment-aware-routing.md) for details

### Routing Analytics
- Every routing decision is persisted to PostgreSQL
- Prompt classification, scoring, and model selection recorded
- Compare mode includes diff summary and verdict
- Privacy-safe: only prompt hashes stored, never raw prompts

## Local Setup

### Prerequisites
- Node.js 18+ and npm
- A Supabase project (for auth and database)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file in the root directory:
   ```bash
   # LLM Provider API Keys (Required)
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   GEMINI_API_KEY=...

   # Supabase (Required)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...

   # Database (Required)
   DATABASE_URL=postgresql://...?pgbouncer=true
   DIRECT_URL=postgresql://...

   # Dev Bypass (Optional)
   AUTH_DISABLED=true
   ```

   See `env.example` for the full list of variables.

3. **Set up the database:**
   ```bash
   npx prisma migrate dev
   ```

4. **Run the Supabase setup SQL:**
   Open Supabase Dashboard → SQL Editor → paste contents of `supabase/setup.sql` → Run.
   This creates the auto-profile trigger and enables Row Level Security.

5. **Run the development server:**
   ```bash
   npm run dev
   ```

6. **Open the app:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

### Quick Deploy

1. **Import your repository** at [vercel.com](https://vercel.com)

2. **Configure environment variables:**
   - `OPENAI_API_KEY` — OpenAI API key
   - `ANTHROPIC_API_KEY` — Anthropic API key
   - `GEMINI_API_KEY` — Google Gemini API key
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
   - `DATABASE_URL` — Supabase connection pooler URL
   - `DIRECT_URL` — Supabase direct connection URL

3. **Deploy** and wait for build to complete

### Post-Deploy

- Run `npx prisma migrate deploy` against your production database
- Run `supabase/setup.sql` in the Supabase SQL Editor (if not already done)
- Configure Supabase Auth redirect URLs for your production domain

## Architecture

### Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **Auth:** Supabase Auth
- **Runtime:** Node.js (SSE streaming)

### Project Structure

```
modeltriage/
├── src/app/                  # Next.js App Router
│   ├── api/
│   │   ├── stream/           # SSE streaming endpoint
│   │   ├── compare/          # Comparison summary endpoint
│   │   ├── usage/            # Usage stats endpoint
│   │   └── account/delete/   # Account deletion endpoint
│   ├── auth/callback/        # Supabase auth callback
│   ├── page.tsx              # Main UI
│   └── layout.tsx            # Root layout (AuthProvider)
├── src/components/
│   ├── auth/                 # Auth UI components
│   │   ├── AuthProvider.tsx  # Auth context + usage state
│   │   ├── LoginModal.tsx    # Email/password login/signup
│   │   ├── UserMenu.tsx      # User dropdown + usage bar
│   │   ├── AuthGate.tsx      # Limit-exceeded prompt
│   │   └── UpgradeBanner.tsx # Approaching-limit warning
│   └── ...                   # Other UI components
├── lib/
│   ├── auth/                 # Auth utilities
│   │   ├── session.ts        # JWT validation + profile cache
│   │   ├── gates.ts          # Feature flags + limit config
│   │   ├── limits.ts         # Usage tracking (atomic upserts)
│   │   ├── supabase-server.ts
│   │   └── supabase-browser.ts
│   ├── db/                   # Database utilities
│   │   ├── prisma.ts         # Prisma client singleton
│   │   └── persist-routing.ts # Analytics persistence
│   ├── llm/                  # LLM providers + routing
│   ├── diff/                 # Diff analyzer
│   ├── attachments/          # File attachment processing
│   └── errors.ts             # Centralized error reporting
├── prisma/
│   └── schema.prisma         # Database schema
├── supabase/
│   └── setup.sql             # Trigger + RLS setup
├── docs/                     # Technical documentation
└── env.example               # Environment variable reference
```

## Documentation

### Technical Documentation
See `docs/` folder for comprehensive technical documentation:
- **[Documentation Index](./docs/README.md)** — Complete guide to all documentation
- **Architecture & System Design** — How the system works
- **Feature Guides** — Implementation details for all features

### Product Specifications
The `.specify/` folder contains product strategy and feature planning:
- Used for **major feature planning** (auth, billing, APIs)
- See [.specify/README.md](./.specify/README.md) for details
