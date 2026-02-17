# Model Routing

## Overview

ModelTriage uses intelligent, rules-based routing to automatically select the most appropriate LLM for each prompt. The routing logic is transparent — users see a human-readable explanation of why each model was chosen, along with fit scores that justify the selection.

## Routing Pipeline

```
Prompt + Attachments
  ↓
┌─────────────────────────────────┐
│ 1. Fast-Path Check              │  ← Pattern matching (no LLM call)
│    Code keywords → Claude       │
│    Vision attachments → Gemini  │
│    Short/simple → GPT-5-mini    │
└─────────────┬───────────────────┘
              │ (if no fast-path match)
              ↓
┌─────────────────────────────────┐
│ 2. Intent Classification        │  ← Analyzes prompt characteristics
│    Category, complexity, stakes │
└─────────────┬───────────────────┘
              ↓
┌─────────────────────────────────┐
│ 3. Scoring Engine               │  ← Multi-signal scoring
│    Capability matrix × signals  │
│    → Ranked model candidates    │
└─────────────┬───────────────────┘
              ↓
┌─────────────────────────────────┐
│ 4. Fit Breakdown                │  ← Confidence-forward scoring
│    "Why this model?" evidence   │
└─────────────────────────────────┘
```

## Available Models

| Model | Provider | Profile | Typical Use |
|-------|----------|---------|-------------|
| `gpt-5-mini` | OpenAI | Fast, cost-effective | Short prompts, simple tasks |
| `gpt-5.2` | OpenAI | Deep reasoning | Complex analysis, multi-step reasoning |
| `claude-sonnet-4-5` | Anthropic | Coding workhorse | Code generation, technical content |
| `claude-opus-4-5` | Anthropic | Premium quality | Deep reasoning with code expertise |
| `claude-haiku-4-5` | Anthropic | Fast, lightweight | Quick responses, simple queries |
| `gemini-3-flash-preview` | Google | Fast multimodal | Lightweight vision/text tasks |
| `gemini-3-pro-preview` | Google | Quality multimodal | Screenshots, image analysis |

## Routing Signals

The intent router analyzes multiple signals to select the best model:

- **Content type** — code, analysis, creative writing, conversational
- **Complexity** — simple question vs multi-step reasoning
- **Attachments** — images trigger vision-capable models, code files trigger coding models
- **Prompt length** — short prompts favor fast models, long prompts favor reasoning models
- **Task type** — coding, writing, analysis, Q&A, vision
- **Recency signals** — "latest", "current", "2026" favor models with recent training data

## Attachment-Aware Routing

When files are attached, routing adapts:

- **Images** (`.png`, `.jpg`, `.webp`) → Gemini 3 Pro (vision-optimized)
- **Code files** (`.ts`, `.js`, `.py`, etc.) → Claude Sonnet 4.5 (coding workhorse)
- **Text files** (`.txt`, `.md`, `.json`) → routed normally based on prompt intent
- **Mixed attachments** → vision model takes priority if images present

See [attachment-aware-routing.md](./attachment-aware-routing.md) for details.

## Fast-Path Optimization

Common patterns are detected without an LLM classification call:

- Code keywords (`function`, `debug`, `implement`) → Claude Sonnet
- Vision attachments → Gemini Pro
- Very short prompts (< 50 chars) → GPT-5-mini or Haiku
- Explicit model mentions → direct selection

See [auto-select-latency-optimization.md](./auto-select-latency-optimization.md) for details.

## Fit Scoring ("Why this model?")

Every routing decision includes a `FitBreakdown` with:

- **shortWhy** — one-sentence justification
- **overallFit** — 7–10 score (confidence-forward)
- **fitBreakdown** — 3–5 dimensions (reasoningFit, outputMatch, costEfficiency, speedFit, recencyFit)

Display scores are mapped from raw 0–10 to 7–10 so all visible scores look confident. See [fit-scoring.md](./fit-scoring.md) for details.

## Routing Decision Structure

```typescript
interface RoutingDecision {
  model: string;           // Selected model ID
  reason: string;          // Human-readable explanation
  confidence: number;      // 0-1 confidence score
  taskType: string;        // Classified task type
  stakes: string;          // low | medium | high
  fitBreakdown: FitBreakdown; // "Why this model?" evidence
}
```

## Analytics Persistence

Every routing decision is persisted to PostgreSQL via `persistRoutingDecision()`:

- Prompt hash (SHA-256, never raw text)
- Classification details (category, complexity, task type)
- Model selected and scoring rationale
- Compare mode includes diff summary and verdict

See [persistence.md](./persistence.md) for database details.

## Implementation Files

- `lib/llm/intent-router.ts` — IntentRouter class, fast-path + classification
- `lib/llm/router.ts` — routeToProvider(), maps model IDs to provider implementations
- `lib/llm/prompt-classifier.ts` — LLM-based classification fallback
- `lib/llm/capability-matrix.ts` — model capabilities and characteristics
- `lib/llm/scoring-engine.ts` — multi-signal scoring
- `lib/llm/scoring-types.ts` — scoring type definitions
- `lib/llm/score-breakdown.ts` — fit breakdown types + Zod validation
- `lib/db/persist-routing.ts` — routing decision persistence
- `src/app/api/stream/route.ts` — API integration

## Testing

```bash
npm test
```

Tests cover:
- Intent classification accuracy
- Fast-path routing rules
- Attachment-aware escalation
- Scoring engine correctness
- Fit breakdown validation
