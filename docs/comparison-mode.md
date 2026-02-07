# Comparison Mode

## Overview

Comparison Mode allows users to compare responses from multiple models side-by-side, helping to evaluate quality, consistency, and identify potential issues through parallel execution and diff analysis.

## Features

### Multi-Model Execution
- Run 2-3 models in parallel (default: 2, max: 3 per spec)
- Independent streaming per model panel
- Isolated error handling (one model failure doesn't affect others)

### Side-by-Side Display
- Dedicated panel per model
- Real-time streaming per panel
- Per-panel routing explanation
- Per-panel metadata (model, latency, tokens)

### Diff Summary
- Appears after all streams complete
- Highlights:
  - **Agreement** - Concepts present in all responses
  - **Disagreement** - Unique content per model
  - **Omissions** - Length/detail variations
  - **Conflicting Assumptions** - Potential contradictions
- Non-blocking (doesn't prevent panel streaming)
- Graceful failure (shows error if diff fails)

## Usage

### UI Toggle

1. **Enable Comparison Mode**
   - Toggle switch in the UI (default: OFF)
   - Warning: "higher cost and latency"

2. **Select Model Count**
   - Choose 2 or 3 models
   - Default: 2

3. **Submit Prompt**
   - Same prompt sent to all selected models
   - Each model independently routed and streamed

### API Usage

**Endpoint:** `POST /api/stream`

**Request (Comparison Mode):**
```json
{
  "prompt": "Your prompt here",
  "models": ["model-1", "model-2"]
}
```

**Response:** SSE stream with multiplexed events

**Event Types:**

1. **Routing Event** (per model):
```json
{
  "type": "routing",
  "modelId": "model-1",
  "routing": {
    "model": "mock-code-1",
    "reason": "Optimized for code generation",
    "confidence": "high"
  }
}
```

2. **Chunk Event** (per model):
```json
{
  "type": "chunk",
  "modelId": "model-1",
  "content": "text content",
  "done": false
}
```

3. **Metadata Event** (per model):
```json
{
  "type": "metadata",
  "modelId": "model-1",
  "metadata": {
    "model": "mock-code-1",
    "provider": "mock",
    "latency": 450,
    "tokenUsage": { "total": 45 }
  }
}
```

4. **Error Event** (per model or global):
```json
{
  "type": "error",
  "modelId": "model-1", // optional
  "error": "Error message"
}
```

## Implementation Details

### Parallel Streaming

- All models stream simultaneously
- Single SSE connection with `modelId` to multiplex events
- No buffering - chunks sent as received
- Independent completion per model

### Error Isolation

- Errors are scoped to specific model panels
- One model failure doesn't terminate other streams
- Page remains fully functional after errors
- Partial results preserved

### Diff Analysis

The diff analyzer performs simple text comparison:

- **Common words** → Agreement
- **Unique words per model** → Disagreement
- **Length variance** → Omissions
- **Negation vs affirmation** → Conflicting assumptions

**Note:** MVP uses basic heuristics. More sophisticated semantic analysis can be added post-MVP.

## Constraints & Limits

Per `.specify/conventions.md`:

- **Default:** 2 models
- **Maximum:** 3 models (enforced)
- **Max prompt:** 4,000 characters
- **Max tokens per model:** 800
- **Cost warning:** Displayed before execution

## MockProvider Only

Current implementation uses `MockProvider` for all model executions:
- `model-1`, `model-2`, `model-3` → All use `MockProvider`
- Real providers (OpenAI, Anthropic) to be added later
- Routing still applied per model

## Examples

### Example 1: Code Comparison

**Prompt:** "Write a function to calculate fibonacci"

**Model 1 (mock-code-1):**
```
Here's a code example...
[streams response]
```

**Model 2 (mock-code-1):**
```
Here's a code example...
[streams response]
```

**Diff Summary:**
- ✓ Agreement: Both mention "code", "example", "mock"
- ⚠ Disagreement: Unique hash values differ
- ℹ Omissions: Similar response lengths

### Example 2: Analytical Comparison

**Prompt:** "Compare React and Vue"

**Model 1 (mock-quality-1):**
```
[Analytical response about React vs Vue]
```

**Model 2 (mock-quality-1):**
```
[Analytical response about React vs Vue]
```

**Diff Summary:**
- ✓ Agreement: Common analytical terms
- ⚠ Disagreement: Different emphasis areas
- ⚡ Conflicting Assumptions: Check for contradictions

## User Flow

1. User enables Comparison Mode toggle
2. Selects number of models (2 or 3)
3. Enters prompt (max 4,000 chars)
4. Clicks Submit
5. Sees side-by-side panels appear
6. Each panel streams independently:
   - Routing info appears first
   - Response streams in real-time
   - Metadata appears when complete
7. After all streams complete:
   - Diff summary appears
   - User can review comparison

## File Structure

- `lib/diff/types.ts` - Diff types
- `lib/diff/analyzer.ts` - Diff analysis logic
- `src/app/api/stream/route.ts` - API with Comparison Mode support
- `src/app/page.tsx` - UI with side-by-side panels

## Compliance

Per `.specify/requirements.md`:

✅ Comparison Mode explicitly enabled (not default)
✅ Cost and latency warning displayed
✅ Multiple models execute in parallel
✅ Default: 2 models
✅ Maximum: 3 models (enforced)
✅ Side-by-side rendering
✅ Independent streaming per panel
✅ Failure isolation
✅ Diff summary with agreement/disagreement
✅ Non-blocking diff generation
✅ Graceful degradation if diff fails

## Future Enhancements

Not yet implemented (post-MVP):

- Semantic similarity analysis
- Factual consistency checking
- Citation/source comparison
- User preference for diff categories
- Export comparison results
- Custom model selection (vs auto-routing)
