# Unified Follow-Up Composer Component

## Overview

Extracted the Compare mode follow-up input into a shared `<FollowUpComposer />` component that's now used consistently across both Auto-select and Compare modes, providing identical UX and eliminating code duplication.

## Component: FollowUpComposer

### Location
`/src/components/FollowUpComposer.tsx`

### Props API

```typescript
interface FollowUpComposerProps {
  value: string;              // Current input value
  onChange: (value: string) => void;  // Value change handler
  onSubmit: () => void;       // Submit handler (called on Enter or button click)
  isLoading?: boolean;        // Disable during streaming (default: false)
  placeholder?: string;       // Custom placeholder text
  disabled?: boolean;         // Additional disabled state
  helperText?: string;        // Helper text below input (default: "Press Enter...")
}
```

### Features

1. **Auto-expanding textarea**
   - Starts at 1 row (44px min height)
   - Expands as user types (max 120px)
   - Automatically resets height when content changes

2. **Keyboard shortcuts**
   - `Enter`: Submit (if not empty/loading)
   - `Shift+Enter`: New line

3. **Send button**
   - Right-aligned blue button with arrow icon
   - Hover effect with gradient
   - Disabled when input is empty or loading
   - Smooth hover animation (arrow slides right)

4. **Helper text**
   - Shows keyboard shortcuts
   - Fades in on focus (via `peer-focus` Tailwind class)

5. **Accessibility**
   - Proper `aria-label` on send button
   - Disabled states clearly indicated
   - Keyboard navigable

## Integration

### Auto-select Mode

**Before**: Button that scrolled to top and focused main prompt input
**After**: Full-width composer directly under response card

#### Handler Implementation:
```typescript
const handleAutoSelectFollowUpSubmit = () => {
  const followUpText = autoSelectFollowUp.trim();
  if (!followUpText || isStreaming) return;
  
  // Enable follow-up mode
  setIsFollowUpMode(true);
  
  // Build context from previous prompt and response
  let contextPrompt = `Original prompt: ${prompt}\n\n`;
  if (response) {
    contextPrompt += `Previous response:\n${response}\n\n`;
  }
  contextPrompt += `Follow-up question: ${followUpText}`;
  
  // Set as new prompt and trigger submission
  setPrompt(contextPrompt);
  setAutoSelectFollowUp("");
  
  // Trigger auto-select mode submission
  setTimeout(() => {
    handleSingleAnswerSubmit();
  }, 100);
};
```

#### Usage:
```tsx
{!isStreaming && !error && response && (
  <FollowUpComposer
    value={autoSelectFollowUp}
    onChange={setAutoSelectFollowUp}
    onSubmit={handleAutoSelectFollowUpSubmit}
    isLoading={isStreaming}
    placeholder="Ask a follow-up question…"
  />
)}
```

### Compare Mode

**Before**: Inline implementation with duplicated markup
**After**: Same shared component with comparison-specific placeholder

#### Handler Implementation:
```typescript
const handleComparisonFollowUpSubmit = () => {
  const followUpText = comparisonFollowUp.trim();
  if (!followUpText || isStreaming) return;
  
  // Enable follow-up mode
  setIsFollowUpMode(true);
  
  // Build context from comparison summary
  let contextPrompt = `Original prompt: ${prompt}\n\n`;
  
  if (diffSummary) {
    contextPrompt += `Previous comparison summary:\n`;
    if (diffSummary.commonGround.length > 0) {
      contextPrompt += `Common Ground: ${diffSummary.commonGround.join("; ")}\n`;
    }
    if (diffSummary.keyDifferences.length > 0) {
      contextPrompt += `Key Differences: ${diffSummary.keyDifferences.map(d => 
        `${d.model}: ${d.points.join(", ")}`
      ).join("; ")}\n`;
    }
  }
  
  contextPrompt += `\nFollow-up question: ${followUpText}`;
  
  // Set as new prompt and trigger submission
  setPrompt(contextPrompt);
  setComparisonFollowUp("");
  
  setTimeout(() => {
    handleVerifyModeSubmit();
  }, 100);
};
```

#### Usage:
```tsx
<FollowUpComposer
  value={comparisonFollowUp}
  onChange={setComparisonFollowUp}
  onSubmit={handleComparisonFollowUpSubmit}
  isLoading={isStreaming}
  placeholder="Ask a follow-up about this comparison…"
/>
```

## State Management

### New State Variables:
```typescript
// Follow-up input state (shared between both modes)
const [comparisonFollowUp, setComparisonFollowUp] = useState("");
const [autoSelectFollowUp, setAutoSelectFollowUp] = useState("");
```

### Removed Functions:
- `handleContinueConversation()` - No longer needed (button removed)
- `handleComparisonFollowUp(e)` - Keyboard handling now in component

## Visual Consistency

### Layout:
```
┌─────────────────────────────────────────────────┐
│ Response Card / Comparison Summary              │
├─────────────────────────────────────────────────┤
│ [Follow-up Composer]                            │
│ ┌────────────────────────────────────────┐ ┌─┐ │
│ │ Ask a follow-up question...            │ │→│ │
│ └────────────────────────────────────────┘ └─┘ │
│ Press Enter to submit • Shift+Enter for new line│
└─────────────────────────────────────────────────┘
```

### Styling (Identical across both modes):
- **Container**: `px-6 pb-5 pt-3 border-t border-gray-200/60`
- **Textarea**: Full width, blue focus ring, auto-expanding
- **Button**: 11x11 (44x44px), blue background, gradient hover
- **Helper text**: Gray-400, small, fades in on focus

## Behavior Changes

### Auto-select Mode:

**Before**:
1. Click "Ask a follow-up" button
2. Scroll to top of page
3. Focus main prompt input
4. Type follow-up in main input
5. Submit

**After**:
1. Type directly in composer below response
2. Press Enter or click send button
3. Submit in place (no scrolling)

### Benefits:
- ✅ No jumping to top of page
- ✅ Context is visible while typing
- ✅ Faster workflow (fewer clicks)
- ✅ Consistent with Compare mode UX

### Compare Mode:
- No functional changes
- Same behavior, same placement
- Now uses shared component (no duplicate code)

## Context Building

### Auto-select Context:
```
Original prompt: [user's original prompt]

Previous response:
[full response text]

Follow-up question: [user's follow-up]
```

### Compare Context:
```
Original prompt: [user's original prompt]

Previous comparison summary:
Common Ground: [list]
Key Differences: [per-model list]

Follow-up question: [user's follow-up]
```

## Technical Notes

### Why setTimeout?
```typescript
setTimeout(() => {
  handleSingleAnswerSubmit();
}, 100);
```

The 100ms delay ensures:
1. React state updates complete (prompt, follow-up text)
2. UI can render the updated prompt before submission starts
3. Prevents race conditions with state updates

### Auto-expanding Textarea Logic:
```typescript
onInput={(e) => {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = 'auto';  // Reset to measure scrollHeight
  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
}}
```

This ensures smooth expansion without layout jumps.

### Focus State with peer:
The helper text uses Tailwind's `peer` utility to fade in when the textarea is focused:
```tsx
className="... peer"  // on textarea

className="... peer-focus:opacity-100"  // on helper text
```

## Testing Checklist

### Auto-select Mode:
- [ ] Composer appears after successful response
- [ ] Typing in composer updates state
- [ ] Enter key submits follow-up
- [ ] Shift+Enter creates new line
- [ ] Send button submits follow-up
- [ ] Button disabled when empty or loading
- [ ] Context includes original prompt and response
- [ ] No scroll-to-top behavior
- [ ] Helper text fades in on focus

### Compare Mode:
- [ ] Composer appears after comparison summary
- [ ] Same visual appearance as auto-select
- [ ] Same keyboard shortcuts work
- [ ] Context includes comparison summary
- [ ] Multiple follow-ups work correctly

### Shared Component:
- [ ] No visual differences between modes
- [ ] Textarea auto-expands correctly
- [ ] Max height enforced (120px)
- [ ] Loading state disables input and button
- [ ] Placeholder text renders correctly
- [ ] Helper text can be customized

## Code Cleanup

### Removed:
- 70+ lines of duplicated markup in Compare mode
- `handleContinueConversation()` function
- `handleComparisonFollowUp(e)` keyboard handler
- Old "Ask a follow-up" button in Auto-select

### Added:
- 90 lines for reusable `FollowUpComposer` component
- `autoSelectFollowUp` state
- `handleAutoSelectFollowUpSubmit()` handler
- `handleComparisonFollowUpSubmit()` handler (extracted logic)

### Net Result:
- **Less total code** (~40 lines saved)
- **Single source of truth** for follow-up UI
- **Consistent behavior** across both modes
