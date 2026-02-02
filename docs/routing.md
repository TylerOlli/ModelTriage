# Model Routing

## Overview

ModelTriage uses rules-based routing to automatically select the most appropriate model for each prompt. The routing logic is transparent, providing users with a clear explanation of why each model was chosen.

## Routing Strategy

### Phase 1: Rules-Based Routing

The current implementation uses pattern matching and prompt analysis to select models. Routing decisions are made based on:

1. **Content type** (code, analytical, creative)
2. **Prompt length** (short, medium, long)
3. **Explicit user preference** (if model specified)

## Available Models

Current mock models representing different optimization profiles:

- `mock-fast-1` - Optimized for quick responses
- `mock-balanced-1` - General-purpose balanced model
- `mock-quality-1` - Enhanced reasoning and complex tasks
- `mock-code-1` - Specialized for code generation

**Note:** All models currently use `MockProvider` for development. Real provider implementations (OpenAI, Anthropic) will be added later.

## Routing Rules

Rules are evaluated in priority order:

### 1. User-Requested Model (Highest Priority)
- **Trigger:** `model` parameter specified in request
- **Selected Model:** User-specified model
- **Reason:** "User requested specific model"
- **Confidence:** High

### 2. Analytical Tasks
- **Trigger:** Keywords like "analyze", "compare", "evaluate", "pros and cons", etc.
- **Selected Model:** `mock-quality-1`
- **Reason:** "Optimized for analysis and reasoning"
- **Confidence:** High
- **Note:** Takes priority over code-related keywords (e.g., "Compare React and Vue")

### 3. Code-Related Content
- **Trigger:** Keywords like "code", "function", "debug", "implement", etc.
- **Selected Model:** `mock-code-1`
- **Reason:** "Optimized for code generation and technical content"
- **Confidence:** High

### 4. Creative Writing
- **Trigger:** Keywords like "write a story", "creative", "narrative", "poem", etc.
- **Selected Model:** `mock-quality-1`
- **Reason:** "Enhanced for creative and narrative tasks"
- **Confidence:** High

### 5. Long Prompts
- **Trigger:** Prompt length > 1000 characters
- **Selected Model:** `mock-quality-1`
- **Reason:** "Enhanced reasoning for detailed prompt"
- **Confidence:** High

### 6. Short Prompts
- **Trigger:** Prompt length < 50 characters
- **Selected Model:** `mock-fast-1`
- **Reason:** "Quick response for short prompt"
- **Confidence:** Medium

### 7. Fallback (Default)
- **Trigger:** No specific pattern matched
- **Selected Model:** `mock-balanced-1`
- **Reason:** "General-purpose model for balanced performance"
- **Confidence:** Low

## Routing Decision Structure

Each routing decision includes:

```typescript
{
  model: string;        // Selected model identifier
  reason: string;       // Human-readable explanation
  confidence: string;   // "high" | "medium" | "low"
}
```

## API Integration

The routing decision is sent as the first SSE event:

```javascript
data: {
  "type": "routing",
  "routing": {
    "model": "mock-code-1",
    "reason": "Optimized for code generation and technical content",
    "confidence": "high"
  }
}
```

## UI Display

The routing information is displayed in an indigo-colored info box above the response:

- **Model name** - Displayed prominently
- **Reason** - Clear explanation of selection criteria
- **Icon** - 🎯 target icon for visual recognition

## Examples

### Analytical Prompt
**Input:** "Compare React and Vue"

**Routing:**
- Model: `mock-quality-1`
- Reason: "Optimized for analysis and reasoning"
- Confidence: High
- Note: Analytical intent takes priority even with code keywords

### Code Prompt
**Input:** "Write a function to sort an array"

**Routing:**
- Model: `mock-code-1`
- Reason: "Optimized for code generation and technical content"
- Confidence: High

### Short Prompt
**Input:** "Hello"

**Routing:**
- Model: `mock-fast-1`
- Reason: "Quick response for short prompt"
- Confidence: Medium

### Generic Prompt
**Input:** "Tell me something interesting"

**Routing:**
- Model: `mock-balanced-1`
- Reason: "General-purpose model for balanced performance"
- Confidence: Low

## Testing

Run routing tests:
```bash
npm run test:routing
```

Tests verify:
- Code-related routing
- Analytical routing
- Creative routing
- Length-based routing
- Fallback routing
- User override
- Decision structure

## Implementation Files

- `lib/routing/types.ts` - Type definitions
- `lib/routing/router.ts` - Routing logic
- `__tests__/routing/router.test.ts` - Unit tests
- `src/app/api/stream/route.ts` - API integration
- `src/app/page.tsx` - UI display

## Future Enhancements

Not yet implemented (post-MVP):

- Learning from user feedback
- Context-aware routing (conversation history)
- Performance-based optimization
- Cost-aware routing
- Custom routing rules per user
- A/B testing different routing strategies

## Compliance

This implementation follows `.specify/conventions.md`:

✅ Phase 1 routing is rules-based only
✅ Routing is explainable with human-readable reasons
✅ Clear fallback model when classification fails
✅ No learning or personalization in MVP
✅ Transparent model selection displayed to user
