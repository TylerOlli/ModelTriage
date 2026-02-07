# UI States and User Actions

## Overview

The UI provides clear states and actions to guide users through the application workflow, from initial instructions to error recovery.

## State Management

### Empty State (Before First Run)

**When shown:** No response, no error, not streaming

**Display:**
- Comprehensive "How it works" guide
- Split into two sections:
  1. **Single-Answer Mode** (Default) - 🎯
     - One AI response
     - Auto-selected model
     - Fast and cost-effective
  2. **Comparison Mode** (Optional) - ⚡
     - Compare 2-3 models
     - Side-by-side comparison
     - Higher cost/latency warning

**Purpose:** Help new users understand the two modes and choose the right one for their needs.

### Loading State (During Streaming)

**When shown:** `isStreaming === true`

**Single-Answer Mode:**
- "Starting stream..." message before first chunk
- "Streaming..." indicator in response header
- Submit button shows "Streaming..."
- Cancel button appears

**Comparison Mode:**
- Spinning indicator per panel
- Independent loading states per model
- All panels stream simultaneously

### Success State (After Completion)

**Single-Answer Mode:**
- Routing explanation (model + reason)
- Streamed response
- Metadata (model, provider, latency, tokens)
- Clear button appears

**Comparison Mode:**
- Side-by-side panels with routing info
- Independent responses per model
- Per-panel metadata
- Diff summary (agreement, disagreement, omissions, conflicts)
- Clear button appears

### Error State

**When shown:** Error occurred during streaming or processing

**Display:**
- Red error box with warning icon (⚠️)
- Error message
- "Try Again" button (clears error and allows retry)

**Example:**
```
┌─────────────────────────────────┐
│ ⚠️ Error          [Try Again]   │
│                                 │
│ Prompt exceeds maximum length   │
└─────────────────────────────────┘
```

**Purpose:** Clear error communication with immediate recovery action.

## User Actions

### Submit Button

**Label:** "Submit" (normal) / "Streaming..." (during stream)

**States:**
- **Enabled:** Prompt has text, under 4,000 chars, not streaming
- **Disabled:** Empty prompt, over limit, or currently streaming

**Behavior:**
- Single-Answer Mode: Calls single model
- Comparison Mode: Calls multiple models in parallel

### Cancel Button

**When shown:** Only during streaming

**Behavior:**
- Aborts the current stream
- Preserves partial output
- Shows error: "Stream cancelled"

### Clear Button

**When shown:** After results appear (response or error) and not streaming

**Behavior:**
- Resets response panels
- Clears error state
- Removes routing info
- Clears metadata
- Removes diff summary (Comparison Mode)
- Clears prompt text and removes from localStorage
- **Does not clear:** Comparison Mode setting, model count

**Purpose:** Quick way to start completely fresh while preserving mode settings.

### Try Again Button

**When shown:** In error state

**Behavior:**
- Same as Clear button (resets error state)
- User can then modify prompt and resubmit

**Location:** Inside error message box (top right)

## State Transitions

### Normal Flow (Single-Answer)

```
Empty State
    ↓ (User enters prompt and clicks Submit)
Loading State
    ↓ (Stream completes)
Success State
    ↓ (User clicks Clear)
Empty State (Instructions hidden)
```

### Normal Flow (Comparison Mode)

```
Empty State
    ↓ (User enables Comparison Mode, enters prompt, submits)
Loading State (multiple panels)
    ↓ (All streams complete)
Success State (with diff summary)
    ↓ (User clicks Clear)
Empty State (Instructions hidden)
```

### Error Flow

```
Empty State
    ↓ (User submits invalid/problematic prompt)
Error State
    ↓ (User clicks "Try Again")
Empty State (ready to retry)
```

### Cancellation Flow

```
Loading State
    ↓ (User clicks Cancel)
Error State ("Stream cancelled")
    ↓ (User clicks "Try Again" or "Clear")
Empty State
```

## Conditional Display Logic

### Instructions

```typescript
{!response && !isStreaming && !error && (
  <Instructions />
)}
```

**Show when:**
- No response yet
- Not currently streaming
- No error present

### Clear Button

```typescript
{hasResults && !isStreaming && (
  <ClearButton />
)}
```

**Show when:**
- Results exist (response or error or model panels)
- Not currently streaming

### Try Again Button

```typescript
{error && (
  <TryAgainButton />
)}
```

**Show when:**
- Error state is present

### Cancel Button

```typescript
{isStreaming && (
  <CancelButton />
)}
```

**Show when:**
- Currently streaming

## Implementation

### Clear Handler

```typescript
const handleClear = () => {
  // Reset single-answer mode state
  setResponse("");
  setError(null);
  setRouting(null);
  setMetadata(null);

  // Reset Comparison Mode state
  setModelPanels({});
  setDiffSummary(null);
  setDiffError(null);

  // Clear prompt text and remove from localStorage
  setPrompt("");
  localStorage.removeItem("lastPrompt");
};
```

### Has Results Check

```typescript
const hasResults = response || error || Object.keys(modelPanels).length > 0;
```

## Visual Hierarchy

### Button Priority

1. **Primary Action (Blue):** Submit
2. **Secondary Action (Gray):** Cancel, Clear
3. **Error Action (Red border):** Try Again

### State Indicators

- **Loading:** Spinning animation (blue)
- **Success:** Metadata box (blue background)
- **Warning:** Cost message (orange text)
- **Error:** Error box (red background)
- **Info:** Instructions (white background)

## Accessibility

- All buttons have clear labels
- Error messages are readable
- Loading states are visible
- Actions are keyboard accessible
- State changes are obvious

## User Benefits

1. **Clear Guidance:** Instructions explain both modes before use
2. **Quick Recovery:** Try Again button for immediate retry
3. **Clean Reset:** Clear button to start fresh
4. **Preserved Settings:** Clear doesn't reset Comparison Mode or prompt
5. **State Awareness:** Always clear what's happening (loading, error, success)

## File Location

`src/app/page.tsx` - All state management and UI logic
