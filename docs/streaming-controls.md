# Streaming Controls and Cancel Behavior

## Overview

The UI implements robust control locking during streaming and intelligent cancel behavior to prevent stuck states and provide clear feedback to users.

## Control Locking During Streaming

### Locked Controls

While `isStreaming === true`, the following controls are disabled:

1. **Verify Mode Toggle**
   - `disabled={isStreaming}`
   - Visual: 50% opacity, cursor not-allowed
   - Prevents mode switching during active streams

2. **Model Count Selector** (when Verify Mode is ON)
   - `disabled={isStreaming}`
   - Visual: 50% opacity, cursor not-allowed
   - Prevents changing model count during active streams

3. **Submit Button**
   - `disabled={isStreaming || !prompt.trim() || isOverLimit}`
   - Visual: Gray background, cursor not-allowed
   - Label changes to "Streaming..."

4. **Prompt Textarea**
   - `disabled={isStreaming}`
   - Prevents editing prompt during stream

### Unlocked During Streaming

- **Cancel Button** - Available to abort stream
- **Clear Button** - Hidden during streaming (only appears after completion)

## Cancel Behavior

### Single-Answer Mode

**When Cancel is clicked:**

1. **Abort Request:**
   ```typescript
   abortControllerRef.current.abort()
   ```

2. **Set Error State:**
   - Error message: "Stream cancelled"
   - Preserves partial output in response

3. **Clean Up:**
   - `setIsStreaming(false)` - Unlocks all controls
   - `abortControllerRef.current = null` - Clears reference

4. **Result:**
   - Controls re-enable immediately
   - User can edit prompt and retry
   - Partial response remains visible
   - Clear button appears

### Verify Mode

**When Cancel is clicked:**

1. **Abort Request:**
   - Aborts the single SSE stream serving all models

2. **Mark Panels as Cancelled:**
   ```typescript
   setModelPanels((prevPanels) => {
     Object.keys(updatedPanels).forEach((modelId) => {
       if (!updatedPanels[modelId].metadata) {
         updatedPanels[modelId].error = "Cancelled by user";
       }
     });
   });
   ```

3. **Preserve Completed Panels:**
   - Only marks incomplete panels (no metadata yet)
   - Panels that finished before cancel show their results
   - Mixed state: Some panels with results, others with "Cancelled by user"

4. **Clean Up:**
   - `setIsStreaming(false)` - Unlocks controls
   - `abortControllerRef.current = null`

5. **Result:**
   - All controls re-enable
   - Cancelled panels show error: "Cancelled by user"
   - Completed panels show their results
   - Partial responses preserved in each panel
   - Clear button appears

## Stuck State Prevention

### Try-Catch-Finally Pattern

All streaming handlers use try-catch-finally to ensure cleanup:

```typescript
try {
  // Streaming logic
} catch (err) {
  // Error handling
} finally {
  setIsStreaming(false);        // Always unlock controls
  abortControllerRef.current = null;
}
```

### Cancel Handler Protection

```typescript
const handleCancel = () => {
  try {
    // Abort logic
  } catch (err) {
    console.error("Error during cancel:", err);
  } finally {
    setIsStreaming(false);        // Always unlock
    abortControllerRef.current = null;
  }
};
```

**Guarantees:**
- Controls never remain locked after cancel
- Even if abort fails, UI recovers
- Multiple cancel clicks are safe

### Error Handling

**AbortError Detection:**
```typescript
if (err.name === "AbortError") {
  // User cancelled - expected behavior
  setError("Stream cancelled");
}
```

**Network Errors:**
```typescript
else {
  // Unexpected error
  setError(err.message);
}
```

**Always in Finally Block:**
```typescript
finally {
  setIsStreaming(false);  // ← This ALWAYS runs
}
```

## State Transitions

### Normal Flow

```
Idle
  → Submit clicked
  → isStreaming = true, controls lock
  → Stream completes
  → isStreaming = false, controls unlock
```

### Cancel Flow

```
Streaming
  → Cancel clicked
  → Abort signal sent
  → Error: "Stream cancelled"
  → isStreaming = false, controls unlock
  → Partial output preserved
```

### Error Flow

```
Streaming
  → Network error occurs
  → Error caught
  → Error displayed
  → isStreaming = false, controls unlock
```

### Stuck Prevention Flow

```
Streaming
  → Something goes wrong
  → Finally block executes
  → isStreaming = false (guaranteed)
  → Controls unlock (guaranteed)
```

## Visual Feedback

### Locked State

| Control | Normal | Locked (Streaming) |
|---------|--------|-------------------|
| Verify Toggle | Clickable, full opacity | Disabled, 50% opacity |
| Model Count | Clickable, full opacity | Disabled, 50% opacity |
| Submit | Blue, "Submit" | Gray, "Streaming..." |
| Prompt | White, editable | Gray, disabled |
| Cancel | Hidden | Visible, clickable |

### Cancelled State (Verify Mode)

**Panel with partial output:**
```
┌─────────────────────────────┐
│ 🎯 Model: mock-code-1       │
│ Response: This is a mock... │
│                             │
│ ❌ Error                    │
│ Cancelled by user           │
└─────────────────────────────┘
```

**Panel that completed before cancel:**
```
┌─────────────────────────────┐
│ 🎯 Model: mock-quality-1    │
│ Response: Full response...  │
│                             │
│ ✓ Metadata                  │
│ Latency: 450ms              │
└─────────────────────────────┘
```

## Implementation Details

### Control Disabling Logic

**Verify Mode Toggle:**
```typescript
<button
  disabled={isStreaming}
  className={`... ${isStreaming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
>
```

**Model Count Buttons:**
```typescript
<button
  disabled={isStreaming}
  className={`... ${isStreaming ? "opacity-50 cursor-not-allowed" : ""}`}
>
```

### Cancellation Logic

**Single-Answer:**
```typescript
abortControllerRef.current.abort();
// Error handler catches AbortError
// Sets error: "Stream cancelled"
```

**Verify Mode:**
```typescript
abortControllerRef.current.abort();
// Mark incomplete panels as cancelled
setModelPanels((prev) => {
  // Only panels without metadata get error
});
```

## Testing Scenarios

### Test 1: Cancel in Single-Answer Mode

1. Submit prompt
2. Click Cancel immediately
3. ✅ Controls unlock
4. ✅ Error: "Stream cancelled"
5. ✅ Partial output visible
6. ✅ Can submit again

### Test 2: Cancel in Verify Mode (Early)

1. Enable Verify Mode, select 2 models
2. Submit prompt
3. Click Cancel immediately (before any complete)
4. ✅ Both panels show "Cancelled by user"
5. ✅ Partial outputs preserved
6. ✅ Controls unlock

### Test 3: Cancel in Verify Mode (Late)

1. Enable Verify Mode, select 2 models
2. Submit prompt
3. Wait for one panel to complete
4. Click Cancel
5. ✅ Completed panel shows full response
6. ✅ Incomplete panel shows "Cancelled by user"
7. ✅ Controls unlock

### Test 4: Multiple Cancel Clicks

1. Submit prompt
2. Click Cancel multiple times rapidly
3. ✅ No errors in console
4. ✅ Controls unlock cleanly
5. ✅ UI remains functional

### Test 5: Cancel After Network Error

1. Stop dev server
2. Submit prompt
3. Click Cancel during error handling
4. ✅ No stuck state
5. ✅ Controls unlock

## Error Prevention

### Potential Issues Prevented

❌ **Controls stuck locked** - Finally block always unlocks
❌ **Cancel doesn't work** - Try-catch protects abort call
❌ **Multiple cancels cause errors** - Null checks prevent crashes
❌ **Partial output lost** - State preserved before abort
❌ **Completed panels cancelled** - Only incomplete panels marked

## File Location

`src/app/page.tsx` - All control locking and cancel logic
