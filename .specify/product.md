# Product

## One sentence
ModelTriage is a decision and verification layer that helps developers evaluate LLM outputs by routing prompts to the most appropriate model and optionally comparing responses to surface meaningful differences.

## Primary user
Developers and technical teams who use large language models in real applications and need confidence in output quality, consistency, cost, and latency.

## Core problem
As the number of capable AI models grows, users are forced to manually choose models without clear guidance, visibility into tradeoffs, or reliable ways to verify correctness. Side-by-side comparisons often create noise rather than clarity, and model updates can introduce silent regressions.

## Core value
ModelTriage introduces judgment and transparency into model usage by:
- Selecting an appropriate model automatically
- Explaining why a model was chosen
- Allowing optional verification across multiple models
- Highlighting agreement, disagreement, and omissions instead of raw output dumps
- Supporting file attachments (text and images) with intelligent routing
- Maintaining conversation context for follow-up questions
- Providing smart history and workflow features
- Tracking usage and routing analytics for authenticated users
- Offering tiered access (Free/Pro) with usage-based limits
- Providing CLI access for developers who prefer the terminal

This reduces cognitive load while increasing trust in AI-assisted work.

## What ModelTriage is
- A tool for evaluating and verifying LLM outputs
- A decision layer between users and AI models
- Infrastructure for model comparison, not a chatbot
- A system for analyzing files and images with appropriate AI models
- A workflow tool with history, follow-ups, and context preservation
- A multi-page application with dashboard, analytics, and account management
- A CLI tool for terminal-first developers (Phase 2)

## What ModelTriage is not
- A general-purpose chat application
- A manual multi-model playground
- An autonomous agent system
- A replacement for application-specific business logic

## Product phases

### MVP (shipped)
Core prompt execution, streaming, intelligent routing, comparison mode, file attachments, prompt history, conversation continuation, and safe mode switching. Single-page application with no authentication or persistence beyond routing analytics.

### Phase 1: Monetization — Auth & Usage (shipped)
- Supabase Auth with email/password signup and login
- Role-based access control (Free and Pro tiers)
- Database-backed usage tracking with atomic daily limits
- Multi-page architecture: pricing, about, dashboard, account
- Routing analytics persistence (prompt hashes, never raw text)
- Client-side prompt cache for privacy-safe dashboard display
- Account management (password change, data export, deletion)

### Phase 2: Monetization — Payments & CLI (planned)
- Stripe integration for Pro plan purchases and subscription management
- API key management for Pro users
- API key auth middleware (Bearer token → user/role resolution)
- CLI tool (`modeltriage-cli` / `mt`) — terminal access to ModelTriage routing and streaming
- CLI supports prompts, file attachments, comparison mode, and usage checking
- Rate limit headers on API-key-authenticated responses

### Phase 3: Usage-Based Pricing & Premium Models (future)
- Usage-based overage billing beyond daily cap
- Premium model gating (expensive models restricted to Pro)
- Usage alerts and monthly usage reports

### Phase 4: Teams & Organizations (future)
- Team/org entity with shared billing and usage pools
- Member management (invite, roles, remove)
- Team dashboard and audit log
- Enterprise features (SSO, SLAs)

## Explicit non-goals
- Long-term prompt or history storage across devices (history is localStorage-only)
- Enterprise features such as organizations, permissions, or audit logs (until scoped)
- Automated actions taken on external systems
- File storage or persistence (attachments processed in-memory only)
- Real-time collaboration or sharing

> If a feature is not described in this file or the requirements, it must not be implemented.