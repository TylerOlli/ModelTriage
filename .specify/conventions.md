# Conventions

## Authority and scope
- The authoritative definition of what gets built is:
  - .specify/product.md
  - .specify/user-stories.md
  - .specify/requirements.md
  - .specify/conventions.md
- docs/modeltriage-overview.md is reference context only. It is not permission to add scope.
- If a feature is not in the specs, it must not be implemented.

## MVP defaults
- Default experience is single-answer mode.
- Verify Mode is optional and must be clearly labeled as higher cost and higher latency.
- Prefer shipping a thin, correct MVP over adding breadth.
- Optimize for low cost and safety during development.

## Tech stack
Frontend
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS

Backend and hosting
- Node.js
- Deployed on Vercel

Data
- PostgreSQL (Supabase-hosted)
- Prisma ORM

Auth
- Supabase Auth (email/password)

Providers
- OpenAI (gpt-5-mini, gpt-5.2)
- Anthropic (claude-sonnet-4-5, claude-opus-4-5, claude-haiku-4-5)
- Google Gemini (gemini-3-flash-preview, gemini-3-pro-preview)

## Streaming transport (locked)
- Use Server-Sent Events (SSE) for streaming model output to the client.
- Streaming is request-scoped, not long-lived:
  - Single-answer mode uses one SSE stream per prompt execution.
  - Verify Mode uses one SSE stream per model execution.
- The stream must begin sending output quickly. Do not buffer until completion.
- The client must tolerate disconnects and treat streaming as best-effort:
  - Partial output must remain visible if a stream ends early.
  - A failure in one model stream must not affect other model panels.
- Do not assume unlimited stream duration in a serverless environment.

## Vercel runtime conventions
- Default to the Node.js runtime for API routes and provider SDK compatibility.
- If streaming duration or reliability becomes an issue, it is acceptable to move only the streaming route to an Edge runtime while keeping the rest of the backend on Node.js.

## Cost control conventions (mandatory)
- Development must default to a low-cost mode.
- Paid providers must be disabled by default in local development.
- Calling live providers requires an explicit opt-in flag.
- In local development, a MockProvider must be the default provider unless live providers are explicitly enabled.

Feature flags
- USE_LIVE_PROVIDERS
- AUTH_DISABLED — bypasses all auth and usage limits for local development

Hard limits
- Enforce a maximum input length per prompt.
- Enforce a maximum output token limit per model request.
- Enforce a maximum number of models allowed in Verify Mode.

Numeric defaults
- Max prompt length: 4,000 characters
- Max output tokens per model: 16,000 (default), 32,000 (hard cap)
- Verify Mode:
  - Default models: 2
  - Free users: max 2 models
  - Pro users: max 3 models
- Usage limits (configurable via env vars):
  - Anonymous: 3 requests lifetime (`ANONYMOUS_MAX_REQUESTS`)
  - Free: 15 requests/day (`FREE_DAILY_LIMIT`)
  - Pro: 200 requests/day (`PRO_DAILY_LIMIT`)
- File attachments:
  - Max files per request: 3
  - Max images per request: 2
  - Max text file size: 2MB
  - Max image file size: 5MB
  - Max characters per text file: 20,000
  - Max total characters across text files: 35,000
  - Text summarization threshold: 12,000 characters
  - Image max dimension: 1024px (resized)
- Prompt history: 10 most recent prompts
- Client-side prompt cache: 200 entries max (localStorage)
- These values are hard limits and must be enforced in code.

Safe defaults
- Verify Mode defaults to OFF.
- When Verify Mode is enabled, default to two models unless explicitly increased.
- Model routing should prefer lower cost models unless the user opts into higher quality.
- Verify Mode must clearly communicate increased cost and latency before execution.

Rate limiting
- Database-backed usage tracking with atomic upserts (Prisma).
- In-memory rate limiters are NOT used (ineffective on serverless).
- Anonymous users tracked via fingerprint hash (IP + localStorage anonymousId).
- Authenticated users tracked via DailyUsage table (resets at midnight UTC).
- Usage limits checked before streaming begins (pre-flight enforcement).

Logging
- Never log full prompts or full model outputs in production logs.
- Log metadata only by default:
  - model name
  - latency
  - token usage when available
  - estimated cost when available

## Persistence conventions
- PostgreSQL database via Supabase, accessed through Prisma ORM.
- Two connection URLs: `DATABASE_URL` (pooled, runtime) and `DIRECT_URL` (direct, migrations).
- Persist:
  - User profiles and roles (auto-created via Supabase Auth trigger)
  - Daily usage counts per user (atomic upserts, no race conditions)
  - Anonymous usage counts per fingerprint (lifetime cap)
  - Routing decisions with classification, scoring, and prompt hashes
  - Optional user feedback (preferred response, rating)
- Do not persist:
  - Full prompt text (only SHA-256 hashes)
  - Full raw model outputs
  - Uploaded file content (in-memory only)
- Persistence is always-on in production. Use `AUTH_DISABLED=true` for local dev bypass.
- Routing decision persistence is fire-and-forget (never blocks the SSE stream).

## Architecture conventions
- Use a model gateway layer that provides a unified interface across providers.
- Provider-specific logic must live behind adapters and never inside UI components.
- Support parallel execution for Verify Mode.
- Streaming must be independent per model so one slow provider does not block others.
- File attachment processing:
  - Process files in-memory only (no disk writes in serverless)
  - Use multipart/form-data for requests with attachments
  - Automatic image optimization using sharp library
  - Text file truncation and summarization using gpt-5-mini
  - Vision model filtering based on attachment type
  - Generate text gists for routing decisions
  - Generate image gists from vision models during streaming

## Routing conventions
- Phase 1 routing is rules-based only.
- Routing must be explainable with a short human-readable reason.
- Routing must have a clear fallback model if classification fails.
- Learning and personalization are not MVP requirements unless explicitly added to requirements.md.
- Attachment-aware routing:
  - Uploaded code/text files always route to strong coding models (Claude Sonnet 4.5)
  - Never downgrade to fast models (gpt-5-mini) when files are uploaded
  - Images only route to vision-capable models
  - File content and complexity inform routing decisions
  - Text gist generation helps classify file-based requests
  - Image gist generation (from vision models) improves routing reason quality

## Verification and diff conventions
- Verify Mode runs the same prompt across multiple models in parallel.
- The diff summary must highlight:
  - agreement
  - disagreement
  - omissions
  - conflicting assumptions
- The diff summary must not block rendering of model outputs.
- Disagreement is treated as signal, not an error.

## Data and privacy conventions
- Never store raw prompts in the database (SHA-256 hashes only).
- Never store provider API keys in the database.
- Never log secrets, auth headers, or raw tokens.
- Use environment-based configuration for all secrets on Vercel.
- Client-side prompt cache uses SHA-256 hashing matching server-side normalization.
- Prompt text display in dashboard is best-effort (depends on localStorage availability).

## Authentication conventions
- Supabase Auth handles all user sessions (JWT-based).
- A Postgres trigger (`supabase/setup.sql`) auto-creates UserProfile on signup.
- Two session validation modes:
  - `getSession()` — fast local JWT validation (<1ms), for regular API routes
  - `getSessionSecure()` — network call to Supabase, for sensitive operations (account deletion)
- UserProfile cache: 5-minute TTL, per-process (serverless warm instance lifetime).
- Role changes require profile cache invalidation.
- Protected pages use `<RequireAuth>` wrapper component.
- Feature gating centralized in `lib/auth/gates.ts` — no role checks scattered in components.
- Plan definitions centralized in `lib/constants.ts` — single source of truth for limits, features, pricing.

## Observability and metrics conventions
- Record per request:
  - provider and model name
  - latency
  - token usage when available
  - estimated cost when available
- Metrics collection must fail gracefully if providers omit cost or token data.
- Errors must be isolated per model panel and must not crash the page.

## UX conventions
- Side-by-side comparison is a first-class UI pattern in Verify Mode.
- Streaming output must show clear loading and partial states.
- Clearly differentiate between:
  - single-answer mode
  - Verify Mode
- Display cost and latency tradeoffs when available.
- File attachments:
  - Display file chips with icon, name, size, and remove button
  - Show counter (X/3) when files are attached
  - Show security warning about sensitive data
  - Support drag-and-drop with visual feedback (blue border, overlay)
  - Validate file types and show clear error messages
- Prompt history:
  - History button with dropdown popover
  - Show last 10 prompts
  - Click to reuse
  - Can clear all history
- Conversation continuation:
  - "Ask a follow-up" button after responses
  - Visual indicator when in continuation mode
  - Inline follow-up input in Compare mode
- Mode switching:
  - Show confirmation when switching with results present
  - "Restore previous results" button after switch
  - Smooth animations for transitions
- Streaming stages:
  - Show progress indicators (connecting, routing, contacting, streaming)
- Input controls:
  - Character count with warning state at 4,000 limit
  - Reset button with double-click confirmation
  - Disable submit when over limit or no prompt entered

## CLI conventions (Phase 2)
- The CLI is a separate package (`packages/cli/` or standalone repo), published to npm as `modeltriage-cli`.
- The CLI binary is `mt`.
- The CLI is a thin HTTP client — all logic stays server-side. No routing, scoring, or provider code in the CLI.
- The CLI authenticates via saved API key, not browser session cookies.
- API key storage: `~/.config/modeltriage/config.json` (using platform-standard config directory).
- The CLI calls the same `/api/stream` endpoint as the web UI with `Authorization: Bearer mt_...`.
- Streaming: the CLI parses SSE events and renders incrementally (same contract as the browser client).
- Terminal rendering: use `chalk` for colors, render markdown-ish formatting (bold, code blocks, lists).
- `--no-color` and `--json` flags must be supported for scripting and piping.
- Errors must never show stack traces in production — display clear, actionable messages.
- The CLI must not store prompts, responses, or any user data locally (beyond the API key config).

## Serverless streaming implementation rules
- Do not implement streaming in a way that buffers the entire provider response.
- Write chunks as they arrive and flush immediately to the client.
- If a provider does not support true token streaming, do not simulate streaming unless clearly labeled.

## Code quality conventions
- Prefer explicit, readable code over clever abstractions.
- Keep modules small with clear boundaries:
  - UI components
  - model gateway and adapters
  - routing
  - diff and verification
  - persistence
- Add basic accessibility:
  - labeled inputs
  - keyboard focus states
  - readable error messages
- Add minimal tests where they provide the most value:
  - routing classification logic
  - provider adapter normalization
  - diff summary input and output boundaries