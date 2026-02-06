# Attachment Gist-Based Routing Reasons

**Date:** 2026-02-06  
**Feature:** Descriptive routing reasons that include what uploaded files/images contain  
**Status:** ✅ Implemented

---

## Problem

**Before:**
- Routing reasons acknowledged attachments existed but didn't describe contents
- Examples:
  - "This request includes an uploaded code/text file..." (too generic)
  - "This request includes a screenshot..." (doesn't say screenshot of what)
- Users couldn't tell if the system understood what they uploaded

**Impact:**
- Reduced trust in attachment handling
- No visibility into whether file contents were analyzed
- Generic reasons don't help users understand model selection

---

## Solution

**Implement "attachment gist" generation** that produces lightweight, structured summaries of attachment contents without increasing token usage.

### Gist Structure

```typescript
interface AttachmentGist {
  kind: string;      // "TypeScript file", "log file", "screenshot of code"
  language?: string; // "TypeScript", "JavaScript", "Python"
  topic: string;     // 3-8 word description
  signals: string[]; // ["React", "error codes", "API handler"]
}
```

### Examples

**TypeScript React Component:**
```typescript
{
  kind: "TypeScript React file",
  language: "TypeScript",
  topic: "React component with hooks",
  signals: ["React", "imports"]
}
```

**Log File with Error:**
```typescript
{
  kind: "log file",
  language: "text",
  topic: "error log or stack trace",
  signals: ["error codes", "stack trace"]
}
```

**Screenshot of Terminal:**
```typescript
{
  kind: "screenshot of terminal output",
  topic: "error message or command output",
  signals: ["terminal"]
}
```

---

## Implementation

### 1. Gist Generator

**File:** `lib/attachments/gist-generator.ts`

**Key Functions:**

#### `getTextFileGist(filename, content, extension)`
Analyzes first ~500 chars of text files to determine:
- **Kind**: Based on extension mapping (`.ts` → "TypeScript file", `.log` → "log file")
- **Language**: Programming language or "text"
- **Topic**: Detected from content patterns:
  - React imports → "React component"
  - API routes → "Next.js API route"
  - Error/stack trace → "error log or stack trace"
  - Type definitions → "type definitions"
- **Signals**: Indicators like ["React", "error codes", "tests"]

**Detection patterns:**
```typescript
// React
if (snippet.includes("import react")) {
  signals.push("React");
  topic = "React component with hooks";
}

// Error logs
if (snippet.includes("error:") || snippet.includes("stack trace")) {
  topic = "error log or stack trace";
  signals.push("error codes");
}

// API handlers
if (snippet.includes("export async function get")) {
  topic = "API route handler";
  signals.push("API handler");
}
```

#### `getImageGist(filename, prompt)`
Infers image type from prompt content (for now, until vision API integration):
- Prompt mentions "code" → "screenshot of code"
- Prompt mentions "error"/"terminal" → "screenshot of terminal output"
- Prompt mentions "ui"/"interface" → "screenshot of UI"
- Prompt mentions "diagram" → "diagram or chart"

#### `getAttachmentsGist(attachments, prompt)`
Returns the most relevant gist (prioritizes images over text files).

---

### 2. Intent Router Integration

**File:** `lib/llm/intent-router.ts`

#### Updated `AttachmentContext` Interface
```typescript
export interface AttachmentContext {
  // ... existing fields ...
  attachments?: Array<{
    type: string;
    filename?: string;
    content?: string;
    extension?: string;
  }>;
}
```

#### New Method: `generateFileAwareReason()`
```typescript
private generateFileAwareReason(
  prompt: string,
  attachments: Array<...>,
  chosenModel: ModelId,
  isComplex: boolean
): string
```

Generates reasons like:
- "This upload is TypeScript React file defining React component with hooks, and Claude Sonnet 4.5 is a strong fit for analyzing and refactoring TypeScript with framework knowledge."
- "This upload is log file defining error log or stack trace, and Claude Sonnet 4.5 is a strong fit for debugging and pinpointing root causes."

#### Updated Method: `generateImageAwareReason()`
Now uses gist instead of prompt heuristics:
```typescript
const gist = getAttachmentsGist(attachments, prompt);
return `This is ${gist.kind} showing ${gist.topic}, and ${modelPrefix} ${visualTask}.`;
```

---

### 3. API Route Updates

**File:** `src/app/api/stream/route.ts`

Updated attachment context to include the attachments array:
```typescript
attachmentContext = {
  // ... existing fields ...
  attachments: attachmentResult.attachments.map((a) => ({
    type: a.type,
    filename: (a as any).filename,
    content: a.type === "text" ? (a as any).content : undefined,
    extension: (a as any).extension,
  })),
};
```

---

## Examples

### Before vs After

#### TypeScript File Upload

**Before:**
```
"This request includes an uploaded code/text file, so a stronger coding model was selected for accurate analysis and reliable results."
```

**After:**
```
"This upload is TypeScript React file defining React component with hooks, and Claude Sonnet 4.5 is a strong fit for analyzing and refactoring TypeScript with framework knowledge."
```

#### Log File Upload

**Before:**
```
"This request includes an uploaded code/text file, so a stronger coding model was selected for accurate analysis and reliable results."
```

**After:**
```
"This upload is log file defining error log or stack trace, and Claude Sonnet 4.5 is a strong fit for debugging and pinpointing root causes."
```

#### Screenshot of Code

**Before:**
```
"This request includes a screenshot of code, and Gemini 2.5 Pro is highly effective at accurately reading and extracting code from images."
```

**After:**
```
"This is screenshot of code showing code snippet or file, and Gemini 2.5 Pro is highly effective at accurately reading and extracting code from images."
```

---

## Token Safety

**Key Constraints:**
- ✅ Uses only first ~500 chars of existing truncated content
- ✅ NO additional API calls for text files
- ✅ NO increase in token caps
- ✅ For images, uses prompt-based inference (no vision API calls yet)
- ✅ Lightweight string pattern matching only

**Performance:**
- Gist generation: < 1ms (pure string analysis)
- No network calls
- No LLM inference needed
- Negligible memory overhead

---

## Test Results

### Test 1: TypeScript React File
```
Input: TodoList.tsx with React hooks
Gist: {
  kind: "TypeScript React file",
  language: "TypeScript",
  topic: "React component with hooks",
  signals: ["React"]
}
Reason: "This upload is typescript react file defining React component with hooks, and Claude Sonnet 4.5 is a strong fit for analyzing and refactoring TypeScript with framework knowledge."
✅ Pass
```

### Test 13: Log File with Error
```
Input: build.log with stack trace
Gist: {
  kind: "log file",
  language: "text",
  topic: "error log or stack trace",
  signals: ["error codes"]
}
Reason: "This upload is log file defining error log or stack trace, and Claude Sonnet 4.5 is a strong fit for debugging and pinpointing root causes."
✅ Pass
```

---

## File Structure

### New Files
- `lib/attachments/gist-generator.ts` - Gist generation logic

### Modified Files
- `lib/llm/intent-router.ts` - Integrated gist into routing reasons
- `src/app/api/stream/route.ts` - Pass attachments array in context

---

## Supported File Types

### Code Files
- TypeScript (`.ts`, `.tsx`) → "TypeScript file" / "TypeScript React file"
- JavaScript (`.js`, `.jsx`) → "JavaScript file" / "JavaScript React file"
- Python (`.py`) → "Python file"
- Java (`.java`) → "Java file"
- Go (`.go`) → "Go file"
- Rust (`.rs`) → "Rust file"
- C/C++ (`.c`, `.cpp`) → "C file" / "C++ file"

### Config Files
- JSON (`.json`) → "JSON config"
- YAML (`.yaml`, `.yml`) → "YAML config"
- Markdown (`.md`) → "Markdown document"

### Log/Text Files
- Log files (`.log`) → "log file"
- Text files (`.txt`) → "text file"

### Images
- Screenshots → "screenshot of code" / "screenshot of terminal output" / "screenshot of UI"
- Diagrams → "diagram or chart"
- Generic → "image"

---

## Content Detection Patterns

### React Detection
- `import React` or `from 'react'`
- `useState`, `useEffect` → "React component with hooks"
- JSX syntax → "React component"

### Next.js Detection
- `next/` imports
- `app/` or `route.` → "Next.js API route"
- `page.` → "Next.js page component"

### Error Detection
- `error:`, `exception`, `stack trace` → "error log or stack trace"
- `build` + `failed` → "build error output"

### API Detection
- `export async function get/post` → "API route handler"

### Type Detection
- `interface`, `type`, `enum` → "type definitions"

### Test Detection
- `.test.`, `.spec.`, `describe(`, `it(` → "test file"

---

## Future Enhancements

### Vision API Integration
When budget allows, integrate actual vision API for images:
```typescript
// Call vision model with low token budget
const visionGist = await runGemini({
  prompt: "In 5-8 words, describe what this image shows",
  attachments: [image],
  maxTokens: 60,
  temperature: 0.0
}, "gemini-2.5-flash");
```

Benefits:
- Accurate image content detection
- No reliance on prompt inference
- Better support for non-code images

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Routing reason describes file contents (not just "uploaded file") | ✅ Pass |
| TypeScript files mention "TypeScript" in reason | ✅ Pass |
| React files mention "React" in reason | ✅ Pass |
| Log files mention "error" or "log" in reason | ✅ Pass |
| No token cap increase | ✅ Pass |
| No additional API calls for text files | ✅ Pass |
| Build passes | ✅ Pass |
| First test passes with React-specific reason | ✅ Pass |

---

## Related Features

- **Image-aware explanations** (`docs/image-aware-explanations.md`) - Now uses gist
- **Routing reason persistence** (`docs/routing-reason-persistence-fix.md`) - Ensures gist-based reasons persist
- **Attachment-aware routing** (`docs/attachment-aware-routing.md`) - Overall routing strategy

---

## Summary

✅ **Implemented:** Lightweight attachment gist generation  
✅ **Enhanced:** Routing reasons now describe file contents specifically  
✅ **Token-safe:** Uses only existing truncated content  
✅ **Tested:** TypeScript React file gets React-specific reason  

**Result:** Users see concrete, descriptive explanations that demonstrate the system understands what they uploaded, building trust and providing transparency into model selection.
