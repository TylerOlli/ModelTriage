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

## Tech stack (locked for MVP unless updated in specs)
Frontend
- Next.js
- TypeScript
- Streaming UI support

Backend and hosting
- Node.js
- Deployed on Vercel

Data
- PostgreSQL
- Prisma ORM

Providers (initial)
- OpenAI
- Anthropic
- Optional later: Google, local models via Ollama

Local development
- Docker for local development

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
- ENABLE_DB_WRITES

Hard limits
- Enforce a maximum input length per prompt.
- Enforce a maximum output token limit per model request.
- Enforce a maximum number of models allowed in Verify Mode.

Numeric defaults (MVP)
- Max prompt length: 4,000 characters
- Max output tokens per model: 800
- Verify Mode:
  - Default models: 2
  - Absolute maximum: 3
- Throttling: 10 requests per session per 5 minutes
- These values are hard limits and must be enforced in code.

Safe defaults
- Verify Mode defaults to OFF.
- When Verify Mode is enabled, default to two models unless explicitly increased.
- Model routing should prefer lower cost models unless the user opts into higher quality.
- Verify Mode must clearly communicate increased cost and latency before execution.

Rate limiting
- Add basic per-session throttling to prevent rapid repeated requests.
- Prevent automatic retries that would multiply paid calls.

Logging
- Never log full prompts or full model outputs in production logs.
- Log metadata only by default:
  - model name
  - latency
  - token usage when available
  - estimated cost when available

## Persistence conventions (MVP)
- MVP includes a working database.
- Database usage is intentionally minimal and cost-conscious.
- Persist only:
  - request metadata (model name, latency, token usage, estimated cost, timestamp)
  - optional user feedback (preferred response, rating)
- Do not persist:
  - full prompt text
  - full raw model outputs
  - user profiles or long-term identities
- Persistence must be safe to disable in local development.
- All database writes must be gated behind ENABLE_DB_WRITES.

## Architecture conventions
- Use a model gateway layer that provides a unified interface across providers.
- Provider-specific logic must live behind adapters and never inside UI components.
- Support parallel execution for Verify Mode.
- Streaming must be independent per model so one slow provider does not block others.

## Routing conventions
- Phase 1 routing is rules-based only.
- Routing must be explainable with a short human-readable reason.
- Routing must have a clear fallback model if classification fails.
- Learning and personalization are not MVP requirements unless explicitly added to requirements.md.

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
- BYO keys initially.
- Never store provider API keys in the database.
- Never log secrets, auth headers, or raw tokens.
- Use environment-based configuration for all secrets on Vercel.

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