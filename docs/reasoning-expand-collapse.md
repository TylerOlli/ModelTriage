# Reasoning Text Expand/Collapse Feature

## Overview

The routing reasoning text in both Auto-select and Compare modes now supports expand/collapse functionality to handle long reasoning messages while maintaining a compact UI.

## Implementation

### State Management

Two new state variables track expansion state:
- `isReasoningExpanded`: Boolean for Auto-select mode reasoning
- `expandedModelReasonings`: Record mapping modelId → boolean for Compare mode

### UI Behavior

#### Default (Collapsed) State
- Reasoning text is clamped to 1 line with ellipsis (`line-clamp-1`)
- Shows "Show" button on the right side
- Header remains compact regardless of reasoning length

#### Expanded State
- Full reasoning text displayed in a detail panel below the header
- Panel styling:
  - Subtle tinted background (`bg-slate-50/50`)
  - Rounded corners with border
  - Max height of 160px (`max-h-40`) with scroll for very long text
  - Smaller text with comfortable line-height
  - Preserves whitespace and line breaks (`whitespace-pre-wrap`)
- Shows "Hide" button to collapse

#### Interaction
- Click reasoning text to toggle expansion
- Click "Show"/"Hide" button to toggle expansion
- Accessible with `aria-expanded` and `aria-controls` attributes

### Auto-select Mode

Located in the execution header of the response card:

```tsx
{routing && routing.mode === "auto" && (
  <div className="px-6 pt-4 pb-3 bg-white/40 backdrop-blur-sm relative">
    {/* Header with clickable reasoning */}
    <div className="flex items-start gap-2">
      <button onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}>
        {routing.reason || "Analyzing your request..."}
      </button>
      <button onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}>
        {isReasoningExpanded ? "Hide" : "Show"}
      </button>
    </div>
    
    {/* Expanded details panel */}
    {isReasoningExpanded && (
      <div id="reasoning-details" className="px-6 pb-4 pt-2">
        <div className="bg-slate-50/50 rounded-md border px-3 py-2.5 max-h-40 overflow-y-auto">
          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
            {routing.reason}
          </p>
        </div>
      </div>
    )}
  </div>
)}
```

### Compare Mode

Each model card has independent expand/collapse state:

```tsx
{panel.routing && (
  <div className="flex items-start gap-2">
    <button 
      onClick={() => setExpandedModelReasonings(prev => ({
        ...prev,
        [modelId]: !prev[modelId]
      }))}
      aria-expanded={expandedModelReasonings[modelId] || false}
      aria-controls={`reasoning-details-${modelId}`}
    >
      {panel.routing.reason}
    </button>
    <button onClick={() => /* toggle */}>
      {expandedModelReasonings[modelId] ? "Hide" : "Show"}
    </button>
  </div>
)}

{/* Expanded details panel with unique ID per model */}
{panel.routing && expandedModelReasonings[modelId] && (
  <div id={`reasoning-details-${modelId}`}>
    {/* Same styling as auto-select */}
  </div>
)}
```

### Reset Behavior

Expansion state is reset in the following scenarios:

1. **New submission**: Both `handleSingleAnswerSubmit` and `handleVerifyModeSubmit` reset expansion state
2. **Clear All**: `handleClear` resets both state variables to initial values
3. **Mode switch**: State naturally resets as components unmount/remount

## Styling

### Collapsed State
- Text: `text-xs text-gray-500 leading-relaxed line-clamp-1`
- Button: `text-[10px] font-medium text-blue-600 hover:text-blue-700 uppercase tracking-wide`
- Interactive hover: `hover:text-gray-700 transition-colors cursor-pointer`

### Expanded Panel
- Container: `px-6 pb-4 pt-2`
- Panel: `bg-slate-50/50 rounded-md border border-gray-200/50 px-3 py-2.5 max-h-40 overflow-y-auto`
- Text: `text-xs text-gray-700 leading-relaxed whitespace-pre-wrap`

## Accessibility

- Buttons have `aria-expanded` attribute reflecting current state
- Buttons have `aria-controls` pointing to the details panel ID
- "Hide"/"Show" buttons have descriptive `aria-label` attributes
- Keyboard navigable (native button elements)

## User Experience

### Benefits
1. **Compact default**: Headers stay small, scannable
2. **Full context available**: Users can read complete reasoning when needed
3. **Consistent pattern**: Same behavior in both Auto-select and Compare modes
4. **Independent control**: In Compare mode, each model card expands independently
5. **Smooth interaction**: Hover states and transitions provide visual feedback

### Edge Cases Handled
- Very long reasoning text: Scrollable with max-height constraint
- Multi-line reasoning: Preserved with `whitespace-pre-wrap`
- No reasoning available: Graceful fallback to default message
- Rapid mode switching: State properly resets
- Multiple models: Each model maintains its own expansion state

## Testing Checklist

- [ ] Click reasoning text to expand/collapse (Auto-select)
- [ ] Click "Show"/"Hide" button (Auto-select)
- [ ] Verify expanded panel shows full text with scroll if needed
- [ ] Test with short and long reasoning text
- [ ] Switch to Compare mode and test each model card independently
- [ ] Verify state resets on new submission
- [ ] Verify state resets on Clear All
- [ ] Check accessibility with keyboard navigation
- [ ] Verify mobile responsiveness
