# Attachment-Aware Model Routing

Smart model defaults based on attachment type to avoid over-using expensive models.

## Problem

Before this fix:
- All requests defaulted to generic routing (often choosing Claude Opus unnecessarily)
- Screenshots didn't automatically route to vision-optimized models
- Code files didn't leverage code-specialized models
- Deep reasoning models (Opus, GPT-5.2) were selected too often

## Solution

**Attachment-aware routing with clear escalation rules:**
- **Screenshots → Gemini 2.5 Pro** (vision-first)
- **Code/text files → Claude Sonnet 4.5** (coding workhorse)
- **Deep reasoning** only on complexity signals
- **Fast models** for lightweight requests

---

## Architecture

### 1. Model Capabilities Configuration

**File:** `lib/attachments/vision-support.ts`

```typescript
export const MODEL_CAPABILITIES: Record<ModelId, ModelCapability> = {
  "gpt-5-mini": {
    vision: false,
    tier: "fast",
    strengths: ["coding", "writing"],
    costTier: "low",
  },
  "gpt-5.2": {
    vision: true,
    tier: "deep",
    strengths: ["reasoning", "coding", "vision"],
    costTier: "high",
  },
  "claude-sonnet-4-5-20250929": {
    vision: true,
    tier: "balanced",
    strengths: ["coding", "writing", "vision"],
    costTier: "medium",
  },
  "gemini-2.5-pro": {
    vision: true,
    tier: "balanced",
    strengths: ["vision", "coding", "reasoning"],
    costTier: "medium",
  },
  // ... more models
};
```

### 2. Model Defaults

```typescript
export const MODEL_DEFAULTS = {
  visionPrimary: "gemini-2.5-pro",         // Best for screenshots
  visionFast: "gemini-2.5-flash",          // Quick image analysis
  codePrimary: "claude-sonnet-4-5-20250929", // Best for code/text
  codeFast: "gpt-5-mini",                  // Quick code questions
  deepReasoningA: "gpt-5.2",               // Deep reasoning primary
  deepReasoningB: "claude-opus-4-5-20251101", // Deep reasoning secondary
};
```

### 3. Complexity Detection

**File:** `lib/attachments/complexity-detector.ts`

**Deep reasoning triggers:**
- Total text > 12,000 chars
- Prompt includes: "design", "architecture", "multi-file", "refactor across", "performance", "security", "migrate", "implement end-to-end"
- Multi-file scenarios with > 6,000 chars

**Lightweight detection:**
- Prompt < 200 chars + single image + no text files
- Prompt < 200 chars + text < 4,000 chars + no images

---

## Routing Logic

### Priority 1: Image Attachments

**Hard rule:** `hasImages === true` → **Vision models ONLY**

```typescript
if (context.hasImages) {
  const isLightweight = promptChars < 200 && imageCount === 1 && textFileCount === 0;
  
  // Choose model
  if (isLightweight) {
    return "gemini-2.5-flash"; // Fast vision
  } else {
    return "gemini-2.5-pro";   // Standard vision
  }
}
```

**Example:** "Describe this screenshot" + image.png → `gemini-2.5-pro`

### Priority 2: Code/Text Files

**Rule:** `hasTextFiles === true` OR prompt looks like code

```typescript
if (context.hasTextFiles || isCodeRelated(prompt, textFileTypes)) {
  if (requiresDeepReasoning(prompt, totalTextChars, hasTextFiles)) {
    return "gpt-5.2"; // Deep reasoning
  }
  
  const isLightweight = promptChars < 200 && totalTextChars < 4000;
  
  if (isLightweight) {
    return "gpt-5-mini";      // Fast code
  } else {
    return "claude-sonnet-4-5-20250929"; // Standard code
  }
}
```

**Examples:**
- "Fix this bug" + error.log → `claude-sonnet-4-5-20250929`
- "Refactor across 3 files" + code files → `gpt-5.2` (escalated)
- "What does this do?" + small snippet → `gpt-5-mini` (lightweight)

### Priority 3: No Attachments

Falls back to traditional intent-based routing (unchanged).

---

## Escalation Rules

### When to Use Deep Reasoning Models

**GPT-5.2 (Primary):**
- Total text > 12,000 chars
- Architecture/design decisions
- Multi-file refactoring
- Performance optimization
- Security analysis
- End-to-end implementation

**Claude Opus 4.5 (Secondary):**
- Only in Verify mode for comparison
- Never as default auto-selection
- User can manually select in Advanced mode

### When to Use Fast Models

**Gemini 2.5 Flash:**
- Single screenshot
- Short prompt (< 200 chars)
- No other attachments

**GPT-5-mini:**
- Quick code questions
- Short prompts (< 200 chars)
- Small text files (< 4,000 chars)

---

## Verify Mode Smart Defaults

**File:** `lib/attachments/vision-support.ts`

```typescript
export function getVerifyModeDefaults(hasImages: boolean): ModelId[] {
  if (hasImages) {
    // Vision: Gemini Pro + deep reasoning for second opinion
    return ["gemini-2.5-pro", "gpt-5.2"];
  } else {
    // Code/text: Sonnet + GPT-5.2
    return ["claude-sonnet-4-5-20250929", "gpt-5.2"];
  }
}
```

**User can still override** by manually selecting different models.

---

## User-Friendly Routing Reasons

**No internal categories exposed.** Instead, clear explanations:

**Vision:**
- Lightweight: "Best fit for quick screenshot analysis and code extraction."
- Standard: "Best fit for analyzing screenshots and extracting code accurately with detailed explanations."

**Code/Text:**
- Lightweight: "Best fit for quick code questions and small changes."
- Standard: "Best fit for TypeScript/JavaScript code changes, debugging, and thorough explanations."
- Complex: "Best fit for complex code analysis, multi-file refactoring, and architectural decisions."

---

## Implementation Details

### Attachment Context

**Built in API route** (`src/app/api/stream/route.ts`):

```typescript
const attachmentContext = {
  hasImages: boolean,
  hasTextFiles: boolean,
  textFileTypes: string[],    // [".ts", ".js", ".log"]
  totalTextChars: number,
  promptChars: number,
  imageCount: number,
  textFileCount: number,
};
```

**Passed to router:**

```typescript
const decision = await intentRouter.route(
  prompt,
  generateCustomReason,
  attachmentContext // Optional
);
```

### Router Integration

**File:** `lib/llm/intent-router.ts`

```typescript
async route(
  prompt: string,
  generateCustomReason = false,
  attachmentContext?: AttachmentContext
): Promise<RoutingDecision> {
  // PRIORITY: Attachment-aware routing
  if (attachmentContext) {
    const decision = this.routeByAttachment(prompt, attachmentContext);
    if (decision) return decision;
  }
  
  // FALLBACK: Traditional intent-based routing
  // ...
}
```

---

## Examples

### Example 1: Screenshot of JavaScript Code

**Request:**
- Prompt: "What does this code do?"
- Attachment: screenshot.png (JavaScript code visible)

**Routing:**
```
hasImages: true
→ visionPrimary
→ gemini-2.5-pro
→ Reason: "Best fit for analyzing screenshots and extracting code accurately."
```

### Example 2: Small TypeScript File

**Request:**
- Prompt: "Fix the type error"
- Attachment: component.tsx (800 chars)

**Routing:**
```
hasTextFiles: true
totalTextChars: 800
promptChars: 18
isLightweight: true
→ codeFast
→ gpt-5-mini
→ Reason: "Best fit for quick code questions and small changes."
```

### Example 3: Multi-File Refactoring

**Request:**
- Prompt: "Refactor this architecture across these 3 files for better performance"
- Attachments: api.ts, db.ts, cache.ts (total 15,000 chars)

**Routing:**
```
hasTextFiles: true
totalTextChars: 15000
requiresDeepReasoning: true (> 12000 chars + "performance" keyword)
→ deepReasoningA
→ gpt-5.2
→ Reason: "Best fit for complex code analysis, multi-file refactoring, and architectural decisions."
```

### Example 4: Large Log File

**Request:**
- Prompt: "Debug this error"
- Attachment: error.log (5,000 chars)

**Routing:**
```
hasTextFiles: true
isCodeRelated: true ("debug", "error" keywords)
totalTextChars: 5000
requiresDeepReasoning: false
isLightweight: false
→ codePrimary
→ claude-sonnet-4-5-20250929
→ Reason: "Best fit for TypeScript/JavaScript code changes, debugging, and thorough explanations."
```

---

## Cost Optimization

### Before Attachment-Aware Routing

- Generic routing often chose Claude Opus unnecessarily
- Cost: **High** ($15 per 1M tokens)

### After Attachment-Aware Routing

**Screenshots:**
- Route to Gemini 2.5 Pro: **Medium** ($1.25 per 1M tokens)
- 92% cost reduction for vision tasks

**Code files:**
- Route to Claude Sonnet: **Medium** ($3 per 1M tokens)
- 80% cost reduction vs Opus

**Lightweight:**
- Route to fast models: **Low** ($0.15-0.60 per 1M tokens)
- 90-95% cost reduction

**Deep reasoning:**
- Only when needed: GPT-5.2 or Opus
- Triggered by complexity signals, not by default

---

## Validation

### Vision Capability Check

**Still enforced** (from previous fix):

```typescript
if (attachmentResult.hasImages) {
  const hasVisionModel = anyModelSupportsVision(modelsToRun);
  
  if (!hasVisionModel) {
    // ERROR: Must use vision model
  }
}
```

This ensures chosen model can actually handle images.

### Model Capability Validation

```typescript
export function supportsVision(modelId: string): boolean {
  const capability = MODEL_CAPABILITIES[modelId as ModelId];
  return capability?.vision ?? false;
}
```

---

## Testing

### Test Cases

1. **Image attachment → Vision model**
   - hasImages: true → gemini-2.5-pro

2. **Code file → Code model**
   - hasTextFiles: true, textFileTypes: [".ts"] → claude-sonnet-4-5-20250929

3. **Complex request → Deep reasoning**
   - totalTextChars: 15000 → gpt-5.2

4. **Lightweight request → Fast model**
   - promptChars: 150, imageCount: 1 → gemini-2.5-flash

5. **No attachments → Traditional routing**
   - No attachmentContext → intent-based

### Manual Testing

**Upload a screenshot of code:**
```
Expected: gemini-2.5-pro
Check logs: "Attachment-aware routing decision"
```

**Upload a TypeScript file:**
```
Expected: claude-sonnet-4-5-20250929 (or gpt-5-mini if lightweight)
Check logs: "hasTextFiles: true", "isCodeRelated: true"
```

**Upload large files with "architecture" in prompt:**
```
Expected: gpt-5.2
Check logs: "requiresDeepReasoning: true"
```

---

## Backward Compatibility

✅ **No breaking changes:**
- Requests without attachments use traditional routing (unchanged)
- Verify mode manual selection works as before
- All existing model capabilities preserved

✅ **Opt-in behavior:**
- Attachment-aware routing only activates when attachments present
- Falls back gracefully if context unavailable

---

## Future Enhancements

1. **Dynamic tier selection** based on user preferences
2. **Cost budget controls** per request
3. **Model performance tracking** for routing optimization
4. **Custom model rankings** per organization
5. **A/B testing** different routing strategies

---

## Files Changed

**New Files:**
- `lib/attachments/complexity-detector.ts` - Complexity detection logic

**Modified Files:**
- `lib/attachments/vision-support.ts` - Added MODEL_CAPABILITIES, MODEL_DEFAULTS, helper functions
- `lib/llm/intent-router.ts` - Added attachment-aware routing path
- `src/app/api/stream/route.ts` - Build and pass attachment context to router

**No Frontend Changes:**
- Frontend continues to work as-is
- Verify mode defaults can be updated separately if needed

---

## Summary

**Attachment-aware routing ensures:**
1. ✅ Screenshots route to Gemini (vision-optimized)
2. ✅ Code files route to Claude Sonnet (coding workhorse)
3. ✅ Deep reasoning only on complexity signals
4. ✅ Fast models for lightweight requests
5. ✅ Clear, user-friendly routing reasons
6. ✅ Significant cost optimization (80-95% reduction for common tasks)

**Result:** Smarter defaults that match workload to model capabilities while avoiding expensive models unless truly needed.
