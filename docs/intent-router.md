# Intent-Aware LLM Router

## Overview

Two-stage intent-aware router for automatic model selection based on prompt analysis.

## Architecture

### Stage 1: Intent Detection
- **Classifier**: Uses `gpt-5-mini` with temp=0, maxTokens=160
- **Timeout**: 10 seconds
- **Output**: Strict JSON with intent, category, chosenModel, confidence, reason

### Stage 2: Specialized Routing

#### Coding Intent
- `coding_quick` → claude-sonnet-4-5-20250929
  - Small functions, snippets, type fixes, conversions
- `coding_review` → claude-opus-4-5-20251101
  - Refactoring, PR review, code explanation, risk identification
- `coding_debug` → gpt-5.2
  - Stack traces, runtime errors, error logs
- `coding_complex_impl` → gpt-5.2
  - Architecture + constraints, algorithms, performance, edge cases
- **Fallback**: confidence < 0.6 → gpt-5-mini

#### Writing Intent
- `writing_light` → claude-haiku-4-5-20251001
  - Summarize, shorten, casual rewrite, quick polish
- `writing_standard` → claude-sonnet-4-5-20250929
  - Marketing copy, blog posts, brand voice, storytelling
- `writing_high_stakes` → claude-opus-4-5-20251101
  - Executive messaging, public statements, sensitive content
- **Fallback**: confidence < 0.6 → claude-sonnet-4-5-20250929

#### Analysis Intent
- `analysis_standard` → gpt-5-mini
  - Compare options, planning, basic reasoning
- `analysis_complex` → gpt-5.2
  - Deep tradeoffs, multi-step reasoning with constraints
- **Fallback**: confidence < 0.6 or unknown → gpt-5-mini

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
- Coding debug → gpt-5.2
- Coding review → claude-opus-4-5-20251101
- Coding quick → claude-sonnet-4-5-20250929
- Writing standard → claude-sonnet-4-5-20250929
- Writing high-stakes → claude-opus-4-5-20251101
- Writing light → claude-haiku-4-5-20251001
- Analysis standard → gpt-5-mini
- Analysis complex → gpt-5.2
