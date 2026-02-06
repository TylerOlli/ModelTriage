# Prompt-Aware IMAGE_GIST Routing Reason - Implementation

## Overview

Implemented a UI-only routing reason override that generates prompt-aware, IMAGE_GIST-derived explanations for image uploads. The override persists through stream completion and never reverts to the generic placeholder from meta.

---

## Problem

- `/api/stream` meta event includes `routing.reason`, but for image uploads it's a generic placeholder: "This is screenshot of code..."
- IMAGE_GIST provides information about what the image contains (language + purpose)
- The displayed reason should reference BOTH the image content AND the user's intent from the prompt
- The placeholder from meta should not override the IMAGE_GIST-derived reason

---

## Solution

### 1. Added UI-Only Override State

**File:** `src/app/page.tsx` (Line ~223)

```typescript
// UI-only override for routing reason (from IMAGE_GIST)
const [routingReasonOverride, setRoutingReasonOverride] = useState<string | null>(null);
```

**Why UI-only?**
- No backend changes required
- Persists across renders
- Always takes precedence over meta routing.reason

### 2. Reset Override on New Request

**Line ~482**

```typescript
// Reset state
setResponse("");
setError(null);
setRouting(null);
setRoutingReasonOverride(null);  // Clear override
setMetadata(null);
```

### 3. Generate Prompt-Aware Reason from IMAGE_GIST

**Line ~614-645**

```typescript
try {
  const gist = JSON.parse(jsonPart);
  console.log("[STREAM] parsed IMAGE_GIST:", gist);
  
  // Infer user intent from prompt
  const promptLower = prompt.toLowerCase();
  let userIntent = "analyze the code";
  if (promptLower.match(/improve|optimize|refactor|enhance|better/)) {
    userIntent = "suggest improvements";
  } else if (promptLower.match(/explain|describe|what does|how does|understand/)) {
    userIntent = "explain what it does";
  } else if (promptLower.match(/fix|debug|error|issue|problem|bug|wrong/)) {
    userIntent = "identify issues and fixes";
  }
  
  // Build prompt-aware routing reason from gist
  const modelDisplayName = "Gemini 2.5 Flash";
  let newReason = "";
  
  if (gist.certainty === "high" && gist.language && gist.language !== "unknown" && gist.purpose && gist.purpose !== "unknown") {
    newReason = `This screenshot shows ${gist.language} code that ${gist.purpose}, so ${modelDisplayName} is a strong fit to accurately read code from images and ${userIntent}.`;
  } else if (gist.language && gist.language !== "unknown") {
    newReason = `This screenshot shows ${gist.language} code, so ${modelDisplayName} is a strong fit to accurately read code from images and ${userIntent}.`;
  } else {
    newReason = `This screenshot contains code, so ${modelDisplayName} is a strong fit to accurately read code from images and ${userIntent}.`;
  }
  
  console.log("[STREAM] updated routing.reason:", newReason);
  
  // Set UI-only override (persists through stream completion)
  setRoutingReasonOverride(newReason);
  
  // ... rest of code
}
```

### 4. Updated UI to Prefer Override

**Line ~1318**

```typescript
<p className="text-sm text-indigo-700">
  {routingReasonOverride ?? routing.reason ?? "Analyzing your request to select the best model..."}
</p>
```

**Precedence:**
1. `routingReasonOverride` (from IMAGE_GIST) - **highest priority**
2. `routing.reason` (from meta) - fallback
3. `"Analyzing..."` - loading state

---

## User Intent Detection

### Heuristics

| Prompt Keywords | Inferred Intent | Example |
|----------------|-----------------|---------|
| improve, optimize, refactor, enhance, better | "suggest improvements" | "Can you improve this code?" |
| explain, describe, what does, how does, understand | "explain what it does" | "Explain what this function does" |
| fix, debug, error, issue, problem, bug, wrong | "identify issues and fixes" | "Fix the bug in this code" |
| *(default)* | "analyze the code" | "What is this?" |

---

## Example Outputs

### Scenario 1: "Improve this function" + JavaScript clock code

**IMAGE_GIST:**
```json
{
  "kind": "code_screenshot",
  "language": "JavaScript",
  "purpose": "displays current time in HH:MM:SS format",
  "certainty": "high"
}
```

**User Prompt:** "Improve this function"

**Generated Reason:**
```
This screenshot shows JavaScript code that displays current time in HH:MM:SS format, so Gemini 2.5 Flash is a strong fit to accurately read code from images and suggest improvements.
```

### Scenario 2: "Explain this" + Python script

**IMAGE_GIST:**
```json
{
  "kind": "code_screenshot",
  "language": "Python",
  "purpose": "processes CSV files",
  "certainty": "high"
}
```

**User Prompt:** "Explain what this does"

**Generated Reason:**
```
This screenshot shows Python code that processes CSV files, so Gemini 2.5 Flash is a strong fit to accurately read code from images and explain what it does.
```

### Scenario 3: "Fix the error" + Generic code

**IMAGE_GIST:**
```json
{
  "kind": "code_screenshot",
  "language": "TypeScript",
  "purpose": "unknown",
  "certainty": "low"
}
```

**User Prompt:** "Fix the error in this code"

**Generated Reason:**
```
This screenshot shows TypeScript code, so Gemini 2.5 Flash is a strong fit to accurately read code from images and identify issues and fixes.
```

---

## Complete Flow

### 1. User Uploads Image with Prompt
```
Image: Screenshot of JavaScript clock function
Prompt: "Can you optimize this code?"
```

### 2. Meta Event Arrives (Generic Placeholder)
```
Browser Console:
[STREAM] meta routing reason: This is screenshot of code showing code snippet or file

State:
routing.reason = "This is screenshot of code showing code snippet or file"
routingReasonOverride = null

UI Display:
"This is screenshot of code showing code snippet or file"
```

### 3. IMAGE_GIST Chunks Arrive
```
Browser Console:
[STREAM] chunk delta head: IMAGE_GIST: {"kind":"code_screenshot","language":"JavaScript",...
[STREAM] chunk delta head: ...,"purpose":"displays current time","certainty":"high"}\n\n
```

### 4. IMAGE_GIST Parsed & Override Set
```
Browser Console:
[STREAM] parsed IMAGE_GIST: { kind: "code_screenshot", language: "JavaScript", purpose: "displays current time", certainty: "high" }
[STREAM] updated routing.reason: This screenshot shows JavaScript code that displays current time, so Gemini 2.5 Flash is a strong fit to accurately read code from images and suggest improvements.

State:
routing.reason = "This is screenshot of code..." (unchanged by meta protection)
routingReasonOverride = "This screenshot shows JavaScript code that displays current time, so Gemini 2.5 Flash is a strong fit to accurately read code from images and suggest improvements." ✨

UI Display:
"This screenshot shows JavaScript code that displays current time, so Gemini 2.5 Flash is a strong fit to accurately read code from images and suggest improvements." ✨
```

### 5. Stream Continues & Completes
```
Browser Console:
[STREAM] chunk delta head: The JavaScript code in the image...
(more chunks...)

State:
routingReasonOverride = "This screenshot shows..." (persists!)

UI Display:
"This screenshot shows JavaScript code that displays current time, so Gemini 2.5 Flash is a strong fit to accurately read code from images and suggest improvements." ✅ (never reverts!)
```

---

## Key Benefits

### 1. Prompt-Aware
- Reason mentions the user's inferred intent
- Different prompts generate different reasons for the same image

### 2. Gist-Aware
- Reason mentions what the code actually does (from IMAGE_GIST)
- More specific when certainty is high

### 3. Persistent
- Override state persists through entire stream
- Never reverts to placeholder
- Survives meta event overwrites

### 4. UI-Only
- No backend changes
- No API modifications
- Simple state management

---

## Test Results

```
✅ Build: Successful
✅ No lint errors
✅ UI-only implementation (no backend changes)
✅ Override persists through stream completion
```

---

## Files Changed

- **`src/app/page.tsx`** - 4 changes (~20 lines)
  1. Added `routingReasonOverride` state (1 line)
  2. Reset override on submit (1 line)
  3. Generate prompt-aware reason from IMAGE_GIST (~15 lines)
  4. Update UI to use override (1 line, removed 5 lines of console.log)

---

## Acceptance Criteria

✅ **Placeholder from meta doesn't win** - Override always takes precedence  
✅ **Reason references image content** - Uses gist.language + gist.purpose  
✅ **Reason references user intent** - Infers from prompt keywords  
✅ **Reason persists after streaming** - Override state never cleared  
✅ **One sentence format** - No internal categories mentioned  
✅ **Minimal changes** - Localized to page.tsx only  

---

**Status:** ✅ Complete  
**Type:** UI-only prompt-aware routing reason  
**Changes:** Localized to `src/app/page.tsx`  
**Impact:** Image uploads show descriptive, prompt-aware reasons  
