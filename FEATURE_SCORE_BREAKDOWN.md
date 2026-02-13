# "Why this model?" Score Breakdown Feature

## Summary

Successfully implemented an expandable "Why this model?" panel that provides transparency into model routing decisions through a compact scoring breakdown system.

## Implementation Details

### 1. Core Types & Schema (`lib/llm/score-breakdown.ts`)

Created a strongly-typed score breakdown system with:

- **ScoreBreakdown** type with 6 required + 1 optional dimensions:
  - Reasoning Complexity (0-10)
  - Output Structure (0-10)
  - Token Volume (0-10)
  - Cost Sensitivity (0-10)
  - Latency Sensitivity (0-10)
  - Recency Requirement (0-10)
  - Safety Sensitivity (0-10, optional)

- **Validation** using Zod schema:
  - Scores: 0-10 range
  - Rationales: 5-80 characters
  - Runtime validation helpers: `validateScoreBreakdown()`, `safeValidateScoreBreakdown()`

- **Metadata**: `DIMENSION_INFO` provides labels and descriptions for each dimension

### 2. Router Integration (`lib/llm/intent-router.ts`)

Enhanced the `IntentRouter` class:

- Added `RoutingDecision.scoreBreakdown?: ScoreBreakdown`
- Implemented `generateScoreBreakdown()` method that:
  - Analyzes intent, category, prompt length, and attachments
  - Assigns scores (0-10) based on task characteristics
  - Generates concise rationales (5-10 words each)
- Integrated into all routing paths:
  - Attachment-aware routing
  - Fast-path routing
  - LLM classifier fallback

### 3. API Integration (`src/app/api/stream/route.ts`)

- Updated routing metadata type to include `scoreBreakdown`
- Score breakdown is now sent via SSE meta event
- Preserved in backend state for final response

### 4. UI Component (`src/app/page.tsx`)

Added expandable panel under the recommended model card:

- **Toggle button**: "Why this model?" / "Show less"
- **Smooth animation**: height + opacity transition (300ms)
- **Compact display**:
  - Dimension label + score badge (blue circle)
  - 5-10 word rationale per dimension
  - Footer note explaining 0-10 scale
- **State management**: 
  - `showWhyThisModel` state (local to current prompt)
  - Auto-reset on new prompt submission

### 5. Session Types (`lib/session-types.ts`)

Updated `ModelPanelData.routing` interface to include optional `scoreBreakdown` field.

### 6. Tests

Created comprehensive test suite:

**Schema Tests** (`__tests__/llm/score-breakdown.test.ts`):
- 11 tests covering validation, boundaries, and defaults
- All tests pass ✓

**Integration Test** (`__tests__/llm/score-breakdown-integration.test.ts`):
- Verifies score breakdown generation across different routing scenarios
- Confirms integration with fast-path and fallback routing

## Usage Example

When a user submits a prompt, the UI now shows:

```
Auto-selected: GPT-5.2

This is a complex implementation task requiring deep reasoning...

[Why this model?] ← Click to expand

  ─── Scoring Breakdown ───
  
  Reasoning Complexity  [8]  Complex multi-step reasoning needed
  Output Structure      [7]  Moderate structure needs
  Token Volume          [7]  Large output volume expected
  Cost Sensitivity      [3]  Cost not a primary concern
  Latency Sensitivity   [4]  Can tolerate slower response
  Recency Requirement   [5]  Current knowledge sufficient
  
  Scores range from 0–10. Higher values indicate greater importance.
```

## Design Principles Met

✓ **Simplicity preserved**: Hidden by default, one click to reveal  
✓ **Minimal UI**: No charts, clean typography, compact layout  
✓ **Smooth transitions**: 300ms height/opacity animation  
✓ **Per-prompt state**: Toggle resets on new submission (no persistence)  
✓ **Type-safe**: Zod validation ensures data integrity  
✓ **Tested**: 11 unit tests + integration tests  
✓ **Compare mode ready**: Architecture supports future expansion

## Files Modified

1. `lib/llm/score-breakdown.ts` (NEW)
2. `lib/llm/intent-router.ts` (MODIFIED)
3. `lib/session-types.ts` (MODIFIED)
4. `src/app/api/stream/route.ts` (MODIFIED)
5. `src/app/page.tsx` (MODIFIED)
6. `package.json` (MODIFIED - added test script)
7. `__tests__/llm/score-breakdown.test.ts` (NEW)
8. `__tests__/llm/score-breakdown-integration.test.ts` (NEW)

## Testing

Run the test suite:
```bash
npm run test:score-breakdown
```

All 11 tests pass, validating:
- Schema constraints (0-10 scores, 5-80 char rationales)
- Required vs optional fields
- Safe validation helpers
- Default score generation
- Dimension metadata completeness

## Notes

- Compare mode currently does NOT show score breakdown (auto-select only)
- Score generation is deterministic based on routing signals
- No LLM calls required for score generation (fast)
- Future enhancement: Could add score breakdown to Compare mode cards
