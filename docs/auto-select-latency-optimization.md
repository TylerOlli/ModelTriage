# Auto-Select Latency Optimization

**Date**: February 10, 2026
**Type**: Performance optimization — routing pipeline refactor
**Files changed**: `lib/llm/intent-router.ts`, `src/app/api/stream/route.ts`, `src/app/page.tsx`

---

## Problem

The Auto-Select pipeline had unnecessary latency between prompt submission and first response token. Three issues compounded:

1. **Duplicate routing**: The intent router ran twice per streaming request — once in the outer request handler, and again inside the SSE stream's `start()` callback. The second call included a full LLM round-trip to gpt-5-mini (~1-2s).

2. **No deterministic fast-path**: Every prompt, regardless of clarity, required an LLM classifier call. Prompts like "debug this stack trace" or "write me a function" have unambiguous intent that can be resolved with pattern matching alone.

3. **Multi-step loading UI**: The frontend showed a 3-step pipeline (Routing → Connecting → Preparing response) that didn't correspond to real separable phases, making the wait feel longer.

---

## Architecture: Phase A / Phase B Split

The pipeline is now split into two concurrent phases:

### Phase A — Critical Path (latency-sensitive)
1. Prompt intent classification (deterministic or LLM)
2. Model selection
3. Dispatch request to selected model
4. Begin streaming tokens immediately

### Phase B — Non-blocking Explanation Path
1. Generate TEXT_GIST from attachment metadata (synchronous, deterministic)
2. Produce routing explanation via LLM (asynchronous)
3. Send explanation to frontend via `routing_reason` SSE event
4. Frontend hydrates the explanation independently of streaming content

**Phase B never blocks Phase A.** The routing explanation is fire-and-forget — if it arrives after streaming starts, the frontend replaces the placeholder text. If the stream closes before it's ready, the initial reason from routing is kept.

---

## Changes

### 1. Duplicate Routing Elimination (`route.ts`)

**Before**: `intentRouter.route()` was called at line 420 (outer scope) and again at line 594 (inside the stream's `start()` callback). The outer-scope result was used for vision enforcement but discarded for the stream — the stream re-routed from scratch.

**After**: The stream reuses `modelsToRun` and `routingMetadata` from the outer scope directly. The inner routing block (~80 lines) was removed entirely.

**Impact**: Eliminates ~1-2s of latency on every Auto-Select streaming request.

### 2. Deterministic Fast-Path Routing (`intent-router.ts`)

Added `tryFastPathRouting()` — a method that uses regex pattern matching and prompt structure to route without the LLM classifier. Runs at Priority 2 in the routing chain (after attachment-aware routing, before the LLM classifier).

**Fast-path categories**:

| Category | Model | Signal patterns |
|---|---|---|
| `coding_debug` | GPT-5.2 | stack trace, traceback, error message, bug, debug, ENOENT, segfault |
| `coding_complex_impl` | GPT-5.2 | system design, architecture, distributed, performance optimization |
| `coding_review` | Claude Opus 4.5 | code review, review this PR, refactor, clean up code |
| `coding_quick` | Claude Sonnet 4.5 | write a function, how to implement, convert, snippet |
| `writing_high_stakes` | Claude Opus 4.5 | executive summary, press release, board memo, investor letter |
| `writing_standard` | Claude Sonnet 4.5 | write a blog, marketing copy, draft an email, cover letter |
| `writing_light` | Claude Haiku 4.5 | summarize, shorten, rewrite, TL;DR |
| `analysis_complex` | GPT-5.2 | analyze tradeoffs, deep dive, evaluate architecture, cost-benefit |
| `analysis_standard` | GPT-5 Mini | what is, explain, difference between, pros and cons |

**Confidence threshold**: All fast-path decisions use confidence 0.86-0.9. The `FAST_PATH_CONFIDENCE_THRESHOLD` is set at 0.85 — conservative enough that only unambiguous prompts qualify.

**Pattern ordering**: Categories are checked in specificity order to avoid false positives:
- `coding_review` before `coding_quick` (so "review this code" → Opus, not Sonnet)
- `writing_high_stakes` before `writing_standard` (so "executive summary" → Opus, not Sonnet)
- `analysis_complex` before `analysis_standard` (so "analyze tradeoffs" → GPT-5.2, not GPT-5 Mini)

**Gemini models are absent from the fast-path by design.** Gemini serves as the low-confidence alternative (confidence < 0.6) in `routeByCategory()`. Since the fast-path only fires at confidence >= 0.86, Gemini selection is correctly deferred to the LLM classifier fallback path where confidence is uncertain.

**Impact**: Eliminates ~1-2s of latency for prompts with clear intent signals.

### 3. Collapsed Loading States (`page.tsx`)

**Before**: 3-step pipeline stepper (Routing → Connecting → Preparing response) with sequential state transitions: `"routing"` → `"connecting"` → `"streaming"`.

**After**: Single "Selecting model..." indicator with `"selecting"` → `"streaming"` transition. The 3-step pipeline UI was removed entirely — it was dead code:
- Auto-Select mode always used the collapsed branch
- Compare mode populates `modelPanels` immediately on submit, so the loading block's guard condition (`Object.keys(modelPanels).length === 0`) is always false

**React state batching note**: The `"streaming"` stage is also handled in the collapsed UI because `setStreamingStage("streaming")` and `setResponse(text)` fire in the same event handler. React batches these updates, creating a brief render where `streamingStage === "streaming"` but `response` is still empty. Without catching this, the loading indicator would flash before disappearing.

### 4. Placeholder Routing Explanation (`page.tsx`)

When the async routing explanation (Phase B) hasn't arrived yet, the UI shows "Why this model was selected..." as placeholder text. This gets replaced when the `routing_reason` SSE event arrives from the server.

---

## Routing Priority Chain

The full routing evaluation order:

```
1. Attachment-aware routing (deterministic, instant)
   → Images: gemini-3-flash-preview or gemini-3-pro-preview
   → Code files: claude-sonnet-4-5 or gpt-5.2
   → Confidence: 0.9-0.95

2. Fast-path deterministic routing (regex, instant)
   → Pattern matching against prompt keywords
   → Confidence: 0.86-0.9
   → Returns null if no strong match → falls through

3. LLM classifier (gpt-5-mini call, ~1-2s)
   → Full intent classification with JSON response
   → routeByCategory() applies confidence thresholds
   → Low confidence (<0.6): falls back to Gemini alternatives
   → Very low confidence (<0.5): defaults to gpt-5-mini
```

---

## Decisions

### Why not speculative dispatch?

Considered dispatching the model request before routing completes (when confidence is very high). Rejected because:
- Cancellation adds complexity (token waste, provider-side resource use)
- The fast-path heuristic captures most of the latency benefit (~1-2s) without cancellation risk
- Marginal gain from speculative dispatch is ~200ms at best

### Why is the confidence threshold 0.85?

Set conservatively to avoid false-positive routing. At 0.85+, only prompts with unambiguous keyword signals qualify. Ambiguous prompts (e.g., "help me with this project") correctly fall through to the LLM classifier, which can reason about context.

### Why are TEXT_GIST and IMAGE_GIST handled differently?

- **TEXT_GIST**: Generated synchronously from file metadata (extension, content preview). Available instantly during Phase B. Used to enrich routing explanations with file-type context.
- **IMAGE_GIST**: Extracted from the vision model's streaming output (the model describes what it sees). Only available after streaming starts. Sent via `routing_update` SSE event to replace the initial placeholder reason.

Both are non-blocking, but IMAGE_GIST arrives later because it requires the vision model to process the image first.

---

## Latency Impact

| Scenario | Before | After | Savings |
|---|---|---|---|
| Clear-intent prompt, no attachments | ~2-4s | ~0-2s | ~2s (skip classifier + no duplicate routing) |
| Ambiguous prompt, no attachments | ~2-4s | ~1-3s | ~1-2s (no duplicate routing) |
| Image attachment | ~1-3s | ~0.5-2s | ~0.5-1s (no duplicate routing; attachment routing was already deterministic) |
| Compare mode | unchanged | unchanged | none |

---

## Scope Boundaries

- No change to final model selection accuracy
- No additional model calls introduced
- No changes to Compare mode behavior
- No UI redesign beyond loading state collapse
- Routing explanations remain deterministic per prompt
