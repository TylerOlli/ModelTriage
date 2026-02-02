# Execution Correctness & Error Isolation

## Overview

The application implements robust execution controls to prevent race conditions, ensure single-run enforcement, and provide proper error isolation in Verify Mode.

## Concurrent Run Prevention

### Problem

Users clicking Submit repeatedly (intentionally or by accident) could trigger multiple concurrent streams, leading to:
- Overlapping responses
- State corruption
- Wasted API calls
- Confusing UI behavior

### Solution: Defensive Dual-Layer Guard

**Layer 1: UI-level (Button disabled)**
```typescript
<button
  disabled={isStreaming || !prompt.trim() || isOverLimit}
  className={...}
>
  {isStreaming ? "Streaming..." : "Submit"}
</button>
```

**Layer 2: Code-level (Function guard)**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!prompt.trim()) return;

  // Prevent concurrent runs - defensive guard
  if (isStreaming || abortControllerRef.current) {
    console.warn("Run already in progress, ignoring duplicate submit");
    return;
  }

  // ... rest of logic
};
```

### Why Both Layers?

1. **UI disabled** - Normal UX, prevents most clicks
2. **Code guard** - Catches edge cases:
   - Form submission via Enter key while button is disabling
   - Race conditions during state updates
   - Programmatic form submissions
   - Rapid clicks during React render cycles

### Behavior

**Scenario: User rapidly clicks Submit**

```
Click 1: ✅ Starts stream, sets isStreaming=true
Click 2: ❌ Button disabled, no action
Click 3: ❌ Button disabled, no action
(Even if clicks somehow reach handleSubmit)
Click 2-N: ❌ Guard returns early, logs warning
```

**Result:**
- Only one stream active
- No state corruption
- No wasted API calls
- Clean console warning for debugging

## Error Isolation in Verify Mode

### Problem

When running multiple models in parallel, one model's error should not affect other models' execution or display.

### Solution: Per-Panel Error Handling

#### SSE Event Processing

**Panel-specific errors (with modelId):**
```typescript
if (data.type === "error") {
  if (modelId) {
    // Isolate error to specific panel
    setModelPanels((prev) => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        error: data.error,
      },
    }));
  } else {
    // Global error (no modelId) - affects entire stream
    throw new Error(data.error);
  }
}
```

**Result:**
- Panel 1 errors → Only Panel 1 shows error
- Panel 2 continues streaming normally
- Panel 3 continues streaming normally

#### API Implementation

The `/api/stream` route wraps each model's processing in try-catch blocks and sends errors with `modelId` for isolation:

```typescript
const modelStreams = models.map(async (requestedModel) => {
  const modelId = requestedModel;
  
  try {
    // ... routing, streaming logic ...
  } catch (error) {
    // Isolate error to this specific panel
    const errorMessage = {
      type: "error",
      modelId,  // Isolates to this panel only
      error: error instanceof Error ? error.message : "Unknown error",
    };
    const sseError = `data: ${JSON.stringify(errorMessage)}\n\n`;
    controller.enqueue(encoder.encode(sseError));
  }
});

// Use allSettled so one failure doesn't stop others
await Promise.allSettled(modelStreams);
```

**Event types:**

```typescript
// Per-model error (isolated to one panel)
{
  type: "error",
  modelId: "model-1",
  error: "Provider timeout"
}

// Global error (stream-level, affects all panels)
{
  type: "error",
  error: "Invalid request"
}
```

### Error Card Display

**Visual Design:**
```tsx
{panel.error ? (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-start gap-2">
      <span className="text-red-600 text-lg">❌</span>
      <div>
        <h4 className="text-sm font-semibold text-red-900 mb-1">
          Error
        </h4>
        <p className="text-sm text-red-700">
          {panel.error}
        </p>
      </div>
    </div>
  </div>
) : ...}
```

**Features:**
- Prominent red styling
- Icon for quick scanning
- Separate from response area
- Clear error message

### Partial Output Preservation

**If a panel errors mid-stream:**

```typescript
// Show partial response if it exists
{panel.response && (
  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed mb-3">
    {panel.response}
  </pre>
)}

// Show error card below partial response
{panel.error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    ...
  </div>
)}
```

**Result:**
```
┌─────────────────────────────────┐
│ 🎯 Model: mock-code-1           │
│                                 │
│ Response:                       │
│ This is the partial response... │  ← Preserved
│ that was streamed before the    │
│ error occurred.                 │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ❌ Error                    │ │  ← Error card
│ │ Provider timeout            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## Comparison Summary with Partial Failures

### Problem

If some panels error, the diff summary should:
- Only compare successful panels
- Not show confusing comparisons with partial/errored data
- Explain why comparison isn't shown if < 2 successful panels

### Solution: Filtered Panel Selection

**Before (problematic):**
```typescript
// Used all panels with any response
const finalResponses = Object.values(currentPanels)
  .filter((p) => p.response.length > 0)
  .map(...);
```

**After (correct):**
```typescript
// Only use successfully completed panels
const successfulPanels = Object.values(currentPanels).filter(
  (p) => !p.error && p.response.length > 0 && p.metadata
);

if (successfulPanels.length >= 2) {
  const finalResponses = successfulPanels.map((p) => ({
    model: p.routing?.model || p.modelId,
    content: p.response,
  }));
  const summary = diffAnalyzer.analyze(finalResponses);
  setDiffSummary(summary);
} else if (successfulPanels.length === 1) {
  // Not enough panels for comparison
  setDiffSummary(null);
}
```

**Criteria for "successful":**
1. `!p.error` - No error occurred
2. `p.response.length > 0` - Has content
3. `p.metadata` - Completed normally (received final metadata)

### Informative Messages

**When < 2 successful panels:**

```tsx
{!isStreaming && !diffSummary && !diffError && Object.keys(modelPanels).length > 0 && (
  (() => {
    const successfulCount = Object.values(modelPanels).filter(
      (p) => !p.error && p.response.length > 0 && p.metadata
    ).length;
    const errorCount = Object.values(modelPanels).filter((p) => p.error).length;
    
    if (errorCount > 0 && successfulCount < 2) {
      return (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <p className="text-sm text-blue-800">
            ℹ Comparison requires at least 2 successful responses. 
            {successfulCount === 1 
              ? " Only 1 panel completed successfully."
              : " No panels completed successfully."}
          </p>
        </div>
      );
    }
    return null;
  })()
)}
```

## Execution Scenarios

### Scenario 1: All Panels Succeed

**Setup:** 3 models, all complete successfully

**Result:**
- ✅ Panel 1: Full response + metadata
- ✅ Panel 2: Full response + metadata
- ✅ Panel 3: Full response + metadata
- ✅ Comparison summary uses all 3

### Scenario 2: One Panel Errors

**Setup:** 3 models, Panel 2 errors mid-stream

**Result:**
- ✅ Panel 1: Full response + metadata
- ❌ Panel 2: Partial response + error card
- ✅ Panel 3: Full response + metadata
- ✅ Comparison summary uses Panels 1 & 3 only

**UI:**
```
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Panel 1 │  │ Panel 2 │  │ Panel 3 │
│ ✓ Done  │  │ ❌ Error│  │ ✓ Done  │
└─────────┘  └─────────┘  └─────────┘

Comparison Summary
Based on 2 models: Panel 1 & Panel 3
```

### Scenario 3: Two Panels Error

**Setup:** 3 models, Panels 1 & 3 error, Panel 2 succeeds

**Result:**
- ❌ Panel 1: Error card
- ✅ Panel 2: Full response + metadata
- ❌ Panel 3: Partial response + error card
- ℹ Message: "Only 1 panel completed successfully"
- ❌ No comparison summary

### Scenario 4: All Panels Error

**Setup:** 3 models, all error

**Result:**
- ❌ Panel 1: Error card
- ❌ Panel 2: Error card
- ❌ Panel 3: Error card
- ℹ Message: "No panels completed successfully"
- ❌ No comparison summary

### Scenario 5: Rapid Submit Clicks

**Setup:** User clicks Submit 5 times rapidly

**Result:**
- ✅ Click 1: Stream starts
- ❌ Clicks 2-5: Ignored (guard returns early)
- Console: "Run already in progress, ignoring duplicate submit" (4×)
- Single stream executes normally

### Scenario 6: Cancel Then Submit

**Setup:** User clicks Submit, Cancel, then Submit again

**Result:**
```
Submit 1: Stream starts, isStreaming=true
Cancel:   Abort, isStreaming=false, abortControllerRef=null
Submit 2: Guard checks pass ✅, new stream starts
```

- ✅ First stream cancels cleanly
- ✅ Second stream starts without interference
- ✅ No stuck states

## State Management

### Critical State Variables

```typescript
const [isStreaming, setIsStreaming] = useState(false);
const abortControllerRef = useRef<AbortController | null>(null);
```

**isStreaming:**
- `true` → Run in progress
- `false` → Idle, can start new run

**abortControllerRef:**
- `null` → No active stream
- `AbortController` → Active stream (can be cancelled)

### State Transitions

**Normal Flow:**
```
Idle: isStreaming=false, abortControllerRef=null
  ↓
Submit: isStreaming=true, abortControllerRef=new AbortController()
  ↓
Streaming: isStreaming=true, abortControllerRef=[object]
  ↓
Complete: isStreaming=false, abortControllerRef=null
```

**Cancel Flow:**
```
Streaming: isStreaming=true, abortControllerRef=[object]
  ↓
Cancel: abortControllerRef.abort()
  ↓
Cleanup: isStreaming=false, abortControllerRef=null
```

**Error Flow:**
```
Streaming: isStreaming=true, abortControllerRef=[object]
  ↓
Error: Caught in try-catch
  ↓
Finally: isStreaming=false, abortControllerRef=null (guaranteed)
```

## Testing Scenarios

### Test 1: Rapid Submit Prevention

**Steps:**
1. Enter prompt
2. Click Submit 10 times rapidly
3. Check console

**Expected:**
- Only 1 stream starts
- Console shows 9 warnings
- UI remains stable

### Test 2: Panel Error Isolation

**Steps:**
1. Enable Verify Mode, 3 models
2. Submit prompt
3. Simulate one panel error (via API modification)

**Expected:**
- Errored panel shows error card
- Other panels continue normally
- Comparison uses only successful panels

### Test 3: All Panels Error

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit prompt that causes all to error
3. Check UI

**Expected:**
- Both panels show error cards
- Message: "No panels completed successfully"
- No comparison summary

### Test 4: Partial Response + Error

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit prompt
3. Simulate Panel 1 error mid-stream

**Expected:**
- Panel 1 shows partial response text
- Panel 1 shows error card below
- Panel 2 continues and completes
- Comparison uses only Panel 2 (message shown)

### Test 5: Guard After Cancel

**Steps:**
1. Submit prompt
2. Click Cancel
3. Immediately click Submit (before controls re-enable)

**Expected:**
- First stream cancels
- Second submit attempt may be blocked by guard or button disabled
- No crashes or state corruption

## Edge Cases Handled

✅ **Rapid clicks during React render** - Guard prevents concurrent runs
✅ **Form submit via Enter key** - Guard catches it
✅ **One panel errors** - Other panels unaffected
✅ **All panels error** - Clear message, no crash
✅ **Partial response + error** - Both shown
✅ **Cancel then submit** - Clean state transitions
✅ **Error in diff analyzer** - Isolated to diff section
✅ **< 2 successful panels** - Informative message

## File Locations

- Implementation: `src/app/page.tsx`
- API error handling: `src/app/api/stream/route.ts`
- This documentation: `docs/execution-correctness.md`

## Key Takeaways

1. **Dual-layer guards** prevent concurrent runs
2. **Per-panel errors** don't affect other panels
3. **Partial output** always preserved
4. **Comparison summary** only uses successful panels
5. **Informative messages** explain missing comparisons
6. **State always cleans up** via try-catch-finally
7. **No retries** - fails fast with clear feedback
