# Safe Mode Switching Implementation

## Overview
Implemented safe mode switching between Auto-select LLM and Compare models with inline confirmation and result restoration.

## Features

### 1. Mode Switch Guard
- Detects when user tries to switch modes while results are present
- Shows inline confirmation bar (not a modal) with warning message
- No confirmation needed if there are no results

### 2. Result Preservation
- Auto-select results stored: `response`, `metadata`, `routing`, `error`
- Compare results stored: `modelPanels`, `diffSummary`
- Data preserved in component state (session-only, no localStorage)

### 3. Inline Confirmation Bar
- Appears below mode selector when switch is attempted
- Orange warning styling for visibility
- Two actions: "Cancel" and "Switch mode"
- Animated entrance with fade-in and slide-in
- Explains that results will be cleared but can be restored

### 4. Restore Action
- Appears after mode switch if previous results exist
- Full-width button with restore icon
- Separate buttons for auto-select and compare modes
- Clicking restores the exact previous state
- Dismissed after restoration

### 5. Smooth Transitions
- Existing fade-in animations preserved on response containers
- `animate-in fade-in duration-300` for responses
- Staggered animation for compare mode cards (60ms delay)
- Natural fade-out when results are cleared

## State Management

### New State Variables
```typescript
showModeSwitchConfirm: boolean     // Show confirmation bar
pendingMode: boolean | null        // Queued mode switch
lastAutoSelectResult: {...}        // Stored auto-select data
lastCompareResult: {...}           // Stored compare data
```

### Key Functions
- `handleModeSwitch(newMode)` - Initiates mode switch with guard
- `confirmModeSwitch()` - Stores results and switches mode
- `cancelModeSwitch()` - Dismisses confirmation
- `restoreLastResults()` - Restores previous mode's results

## UX Flow

1. User clicks mode selector button
2. If results exist → show confirmation bar
3. If no results → switch immediately
4. User confirms → store results, clear UI, switch mode
5. After switch → show restore button
6. User clicks restore → previous results reappear
7. Restore button disappears after restoration

## Technical Notes

- No localStorage persistence (session-only)
- Mode switching disabled during streaming
- Confirmation auto-dismisses on cancel
- Restore buttons only show when there are no current results
- Animations respect `prefers-reduced-motion`
