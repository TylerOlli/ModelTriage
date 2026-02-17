# "Why this model?" - Premium Fit Scoring Feature

## Overview

The "Why this model?" feature provides confidence-forward transparency into model routing decisions through a premium fit scoring system. Instead of showing "task difficulty" or "requirements", it shows how well the chosen model fits the specific request characteristics.

## Key Design Principles

✅ **Confidence-forward**: All displayed scores are 7-10 (looks premium)  
✅ **Evidence-based**: Scores justify the selection, not evaluate the task  
✅ **Minimal dimensions**: Only show 3-5 relevant dimensions per decision  
✅ **Clean UI**: No charts, no badges, tight spacing  
✅ **Hidden by default**: Preserves simplicity of main UI  

## Scoring Semantics

### Concept: Fit Scores (not difficulty scores)

Each dimension represents **how strongly that dimension supports the chosen model**:
- High score (9-10): This dimension strongly favors this model
- Good score (8-9): This dimension is well-aligned with this model  
- Acceptable score (7-8): This dimension is adequately matched

### Display Score Mapping

```
Raw Score (0-10) → Display Score (7-10)
display = 7 + (raw * 0.3)
```

This ensures all displayed scores look confident and professional.

### Core Dimensions

**Always considered (included if >= 7 raw)**:
- `reasoningFit`: How well the model handles this reasoning complexity
- `outputMatch`: How well the model produces the required output format
- `costEfficiency`: How cost-effective this model is for this task
- `speedFit`: How well the model's speed matches the need

**Optional (only when explicitly relevant)**:
- `recencyFit`: Only shown when prompt asks for latest/current/recent information

### Overall Fit

Computed as weighted average of included dimensions:
```typescript
reasoningFit: 0.30
outputMatch: 0.25
costEfficiency: 0.20
speedFit: 0.15
recencyFit: 0.10
```

## Backend Implementation

### Types (`lib/llm/score-breakdown.ts`)

```typescript
export interface FitDimension {
  key: string;
  label: string;
  raw: number;        // 0-10 (internal)
  display: number;    // 7-10 (shown to user)
  note: string;       // 4-50 chars
}

export interface OverallFit {
  raw: number;
  display: number;
}

export interface FitBreakdown {
  shortWhy: string;           // One sentence (10-150 chars)
  overallFit: OverallFit;
  fitBreakdown: FitDimension[];  // 1-5 dimensions
}
```

### Router Integration (`lib/llm/intent-router.ts`)

The `generateFitBreakdown()` method:
1. Analyzes intent, category, and prompt characteristics
2. Computes raw scores (0-10) for each dimension
3. Only includes dimensions with raw score >= 7
4. Maps raw scores to display scores (7-10)
5. Generates brief notes (4-8 words)
6. Calculates weighted overall fit
7. Returns FitBreakdown with shortWhy, overallFit, and dimensions

## UI Implementation

### Layout

```
[Why this model?] ← Blue link (collapsed by default)

(When expanded:)
┌─────────────────────────────────────┐
│ Overall fit              9.3         │
├─────────────────────────────────────┤
│ Model excels at systematic reasoning │
│                                      │
│ Reasoning Fit           9.7          │
│ Strong multi-step reasoning          │
│                                      │
│ Output Match            9.4          │
│ Excellent format control             │
│                                      │
│ Cost Efficiency         9.1          │
│ Good cost-quality balance            │
│                                      │
│ Speed Fit               8.8          │
│ Fast response time                   │
├─────────────────────────────────────┤
│ Fit scores range from 7–10.         │
│ Higher means stronger alignment.     │
└─────────────────────────────────────┘
```

### Key Features

- **Two-column layout**: Label + note on left, score on right
- **Large overall fit**: 2xl font size, prominent placement
- **Tight spacing**: Compact, mobile-friendly
- **Muted helper text**: Small footer explaining 7-10 range
- **Smooth animation**: 300ms height + opacity transition
- **No visual noise**: No charts, no colored badges, clean typography

## Testing

### Schema Tests (`__tests__/llm/score-breakdown.test.ts`)

9 tests covering:
- Valid fit breakdown structure
- Display score always >= 7
- mapToDisplayScore function (0-10 → 7-10)
- calculateOverallFit weighted average
- Note length validation (4-50 chars)
- Safe validation helpers
- Default fit breakdown generation
- Dimension metadata completeness

**Result**: All 9 tests pass ✓

### Integration Tests

Verifies:
- Fit breakdown present in all routing decisions
- Overall fit scores are 7-10
- 3-5 dimensions per breakdown
- Display scores never < 7

**Result**: All tests pass ✓

## Example Output

**Quick coding task** ("Write a hello world function"):
```
Overall fit: 9.6

Claude Sonnet 4.5 delivers fast, accurate code generation.

Reasoning Fit       9.7
Well-suited reasoning depth

Output Match        9.9
Strong output structure

Cost Efficiency     9.9
Highly cost-effective choice

Speed Fit           10.0
Optimized for speed
```

**Complex analysis** ("Analyze microservices vs monolithic"):
```
Overall fit: 9.5

GPT-5.2 has strong multi-step reasoning for complex tasks.

Reasoning Fit       10.0
Exceptional reasoning capabilities

Output Match        9.7
Strong output structure

Cost Efficiency     9.1
Good cost efficiency

Speed Fit           9.1
Good response speed
```

## Migration from Old System

### Breaking Changes

- `ScoreBreakdown` → `FitBreakdown`
- `scoreBreakdown` field → `fitBreakdown` field
- Old dimensions removed:
  - reasoningComplexity, outputStructure, tokenVolume,
    costSensitivity, latencySensitivity, recencyRequirement
- New dimensions added:
  - reasoningFit, outputMatch, costEfficiency,
    speedFit, recencyFit

### API Changes

**Old payload**:
```json
{
  "scoreBreakdown": {
    "reasoningComplexity": { "score": 8, "rationale": "..." },
    ...
  }
}
```

**New payload**:
```json
{
  "fitBreakdown": {
    "shortWhy": "Model excels at this task",
    "overallFit": { "raw": 9, "display": 9.7 },
    "fitBreakdown": [
      {
        "key": "reasoningFit",
        "label": "Reasoning Fit", 
        "raw": 9.5,
        "display": 9.9,
        "note": "Strong reasoning"
      }
    ]
  }
}
```

## Files Modified

1. `lib/llm/score-breakdown.ts` - Complete refactor
2. `lib/llm/intent-router.ts` - New fit scoring logic
3. `lib/session-types.ts` - Updated types
4. `src/app/api/stream/route.ts` - fitBreakdown in payload
5. `src/app/page.tsx` - Premium UI component
6. `__tests__/llm/score-breakdown.test.ts` - New tests
7. `__tests__/llm/score-breakdown-integration.test.ts` - Updated

## Slogan Alignment

**"Right model, every time"**

The fit scoring system reinforces this by:
- Showing high confidence (7-10 range)
- Presenting evidence (dimension scores)
- Justifying the selection (shortWhy + notes)
- Never showing low/uncertain numbers

Users see **why the chosen model is right**, not **why the task is hard**.
