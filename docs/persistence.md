# UI Persistence

## Overview

The UI implements lightweight localStorage persistence to maintain user preferences across browser sessions.

## Persisted State

### 1. Comparison Mode (boolean)
- **Key:** `comparisonMode`
- **Values:** `"true"` or `"false"`
- **Default:** `false` (OFF)
- **When saved:** Immediately on toggle

### 2. Model Count (number)
- **Key:** `modelCount`
- **Values:** `"2"` or `"3"`
- **Default:** `2`
- **When saved:** Immediately on selection
- **Validation:** Only accepts 2 or 3

### 3. Last Prompt (string, optional)
- **Key:** `lastPrompt`
- **Values:** Any string
- **Default:** Empty string
- **When saved:** 500ms after typing stops (debounced)
- **Clearing:** Removed from localStorage when prompt is empty

## Implementation Details

### Load on Mount

```typescript
useEffect(() => {
  const persistedComparisonMode = localStorage.getItem("comparisonMode");
  const persistedModelCount = localStorage.getItem("modelCount");
  const persistedPrompt = localStorage.getItem("lastPrompt");

  if (persistedVerifyMode !== null) {
    setVerifyMode(persistedVerifyMode === "true");
  }
  if (persistedModelCount !== null) {
    const count = parseInt(persistedModelCount, 10);
    if (count === 2 || count === 3) {
      setModelCount(count);
    }
  }
  if (persistedPrompt) {
    setPrompt(persistedPrompt);
  }
}, []);
```

### Save on Change

**Comparison Mode:**
```typescript
useEffect(() => {
  localStorage.setItem("comparisonMode", comparisonMode.toString());
}, [comparisonMode]);
```

**Model Count:**
```typescript
useEffect(() => {
  localStorage.setItem("modelCount", modelCount.toString());
}, [modelCount]);
```

**Prompt (Debounced):**
```typescript
useEffect(() => {
  const timeoutId = setTimeout(() => {
    if (prompt.trim()) {
      localStorage.setItem("lastPrompt", prompt);
    } else {
      localStorage.removeItem("lastPrompt");
    }
  }, 500); // 500ms debounce

  return () => clearTimeout(timeoutId);
}, [prompt]);
```

## Cost Warning

The "higher cost and latency" message is now conditional:

```typescript
<p className="text-sm text-gray-600">
  Compare responses from multiple models
  {comparisonMode && (
    <span className="text-orange-600 font-medium"> (higher cost and latency)</span>
  )}
</p>
```

**Behavior:**
- **Comparison Mode OFF:** "Compare responses from multiple models"
- **Comparison Mode ON:** "Compare responses from multiple models (higher cost and latency)"

The warning appears in orange (`text-orange-600`) and only when the mode is actively enabled.

## User Experience

### First Visit
1. User arrives at page
2. Comparison Mode is OFF by default
3. Model count is 2 by default
4. Prompt is empty

### Return Visit
1. User arrives at page
2. Comparison Mode state restored from last session
3. Model count restored from last session
4. Last prompt restored (if user typed something)

### Clearing Data

Users can clear persisted data by:
1. **Clear button** - Removes prompt from localStorage and clears textarea
2. Clearing browser localStorage manually
3. Using browser dev tools → Application → Local Storage

**Note:** The Clear button only removes the prompt; Comparison Mode and model count settings are preserved.

## Privacy

- **No server storage:** All data stays in the browser
- **No tracking:** No analytics or external calls
- **No sensitive data:** Only UI preferences stored
- **User control:** Standard browser localStorage deletion applies

## Browser Compatibility

localStorage is supported in all modern browsers:
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Opera: ✅

**Fallback:** If localStorage is unavailable, the app still functions normally with default values.

## Testing

### Manual Testing

1. **Test Comparison Mode persistence:**
   - Toggle Comparison Mode ON
   - Refresh page
   - ✓ Should remain ON

2. **Test Model Count persistence:**
   - Select 3 models
   - Refresh page
   - ✓ Should show 3 selected

3. **Test Prompt persistence:**
   - Type "Test prompt"
   - Wait 1 second
   - Refresh page
   - ✓ Should restore "Test prompt"

4. **Test Cost Warning:**
   - Comparison Mode OFF → No warning shown
   - Toggle Comparison Mode ON → Warning appears in orange
   - Toggle Comparison Mode OFF → Warning disappears

5. **Test Prompt clearing:**
   - Type some text in the prompt
   - Wait for debounce (1 second)
   - Click the Clear button
   - Refresh page
   - ✓ Prompt should be empty (not restored)

### Browser Console Testing

```javascript
// Check stored values
localStorage.getItem("comparisonMode")    // "true" or "false"
localStorage.getItem("modelCount")    // "2" or "3"
localStorage.getItem("lastPrompt")    // stored prompt or null

// Manually set values
localStorage.setItem("comparisonMode", "true")
localStorage.setItem("modelCount", "3")
localStorage.setItem("lastPrompt", "Test")
// Refresh page to see changes

// Clear all
localStorage.clear()
```

## File Changes

- `src/app/page.tsx` - Added localStorage persistence and conditional cost warning

## No Backend Changes

All persistence is client-side only. No API changes required.
