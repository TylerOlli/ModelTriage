# Intent-Aware LLM Router

## Overview

Two-stage intent-aware router for automatic model selection based on prompt analysis.
**Now includes Gemini models (gemini-2.5-flash, gemini-2.5-pro) as cost-aware alternatives.**

## Architecture

### Stage 1: Intent Detection
- **Classifier**: Uses `gpt-5-mini` with default temp (1), maxTokens=2000 (for reasoning models)
- **Timeout**: 10 seconds
- **Output**: Strict JSON with intent, category, chosenModel, confidence, reason

### Stage 2: Specialized Routing

#### Coding Intent (Primary → Alternative)
- **coding_quick** → claude-sonnet-4-5-20250929 (confidence ≥ 0.6)
  - Alternative: gemini-2.5-flash (confidence < 0.6, cost-aware)
  - Small functions, snippets, type fixes, conversions

- **coding_review** → claude-opus-4-5-20251101 (confidence ≥ 0.6)
  - Alternative: gemini-2.5-pro (confidence < 0.6)
  - Refactoring, PR review, code explanation, risk identification

- **coding_debug** → gpt-5.2 (confidence ≥ 0.6)
  - Alternative: gemini-2.5-pro (confidence < 0.6)
  - Stack traces, runtime errors, error logs

- **coding_complex_impl** → gpt-5.2 (confidence ≥ 0.6)
  - Alternative: gemini-2.5-pro (confidence < 0.6)
  - Architecture + constraints, algorithms, performance, edge cases

#### Writing Intent (Primary → Alternative)
- **writing_light** → claude-haiku-4-5-20251001 (confidence ≥ 0.6)
  - Alternative: gemini-2.5-flash (confidence < 0.6, cost-aware)
  - Summarize, shorten, casual rewrite, quick polish

- **writing_standard** → claude-sonnet-4-5-20250929 (confidence ≥ 0.6)
  - Alternative: gemini-2.5-pro (confidence < 0.6)
  - Marketing copy, blog posts, brand voice, storytelling

- **writing_high_stakes** → claude-opus-4-5-20251101 (confidence ≥ 0.6)
  - Alternative: gemini-2.5-pro (fallback only, confidence < 0.6)
  - Executive messaging, public statements, sensitive content

#### Analysis Intent (Primary → Alternative)
- **analysis_standard** → gpt-5-mini (confidence ≥ 0.6)
  - Alternative: gemini-2.5-flash (confidence < 0.6, cost-aware)
  - Compare options, planning, basic reasoning

- **analysis_complex** → gpt-5.2 (confidence ≥ 0.6)
  - Alternative: gemini-2.5-pro (confidence < 0.6)
  - Deep tradeoffs, multi-step reasoning with constraints

#### Fallback & Cost Controls
- **Safety threshold**: confidence < 0.5 → always default to gpt-5-mini
- **Low confidence (0.5 ≤ confidence < 0.6)**:
  - Light tasks → gemini-2.5-flash (cost-aware)
  - Complex tasks → gemini-2.5-pro
- **Preference**: gemini-2.5-flash over gemini-2.5-pro when both viable
- **Classifier failure**: Default to gpt-5-mini

## API Integration

### Request
```json
{
  "prompt": "string",
  "models": ["model-id"]  // optional - omit for auto-routing
}
```

### Response
```json
{
  "routing": {
    "mode": "auto" | "manual",
    "intent": "coding" | "writing" | "analysis" | "unknown",
    "category": "string",
    "chosenModel": "model-id",
    "confidence": 0.85,
    "reason": "string"
  },
  "results": [
    {
      "modelId": "model-id",
      "text": "response",
      "latencyMs": 1234,
      ...
    }
  ]
}
```

## Usage

### Auto Mode (Default)
- Verify/Advanced Mode: **OFF**
- Don't send `models` array in request
- Router selects best model automatically
- UI displays auto-selection label

### Manual Mode
- Verify/Advanced Mode: **ON**
- Send `models` array with user-selected models
- No classification performed
- Multiple models executed in parallel

## Files Changed

1. **`lib/llm/intent-router.ts`** - Two-stage router implementation
2. **`src/app/api/stream/route.ts`** - API integration with auto/manual mode detection
3. **`src/app/page.tsx`** - Frontend updates for auto-routing display
4. **`__tests__/llm/intent-router.test.ts`** - Router tests with sample prompts
5. **`package.json`** - Added test:intent-router script

## Testing

Run router tests:
```bash
npm run test:intent-router
```

Test scenarios:
- Coding debug (high confidence) → gpt-5.2
- Coding debug (low confidence) → gemini-2.5-pro
- Coding review (high confidence) → claude-opus-4-5-20251101
- Coding quick (low confidence) → gemini-2.5-flash
- Writing standard (high confidence) → claude-sonnet-4-5-20250929
- Writing light (low confidence) → gemini-2.5-flash
- Writing high-stakes → claude-opus-4-5-20251101
- Analysis standard (low confidence) → gemini-2.5-flash
- Analysis complex (high confidence) → gpt-5.2
- Very low confidence (< 0.5) → gpt-5-mini (always)
