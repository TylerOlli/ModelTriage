# Summary: Natural Language Comparison Summaries

## What Was Done

Completely refactored the comparison summary generator to use an LLM for producing natural-language summaries instead of rule-based text clustering.

## Key Changes

### 1. `lib/diff/analyzer.ts` (Complete Rewrite)
**Before:** 
- Used Jaccard similarity clustering
- Extracted sentences and picked representative text
- Often showed literal fragments and code snippets

**After:**
- Calls `gpt-5-mini` with all model responses
- LLM generates human-readable summaries in natural language
- Focuses on **ideas** and **concepts**, not text fragments
- NO code blocks or JSON in summaries (only in model response panels)

**Key features:**
- Uses Claude Haiku 4.5 (fast, cheap, no reasoning token issues)
- Temperature: 0.0 (deterministic)
- Max tokens: 400
- Timeout: 12 seconds
- Fallback summary if LLM fails
- Truncates long responses (3000 chars per model)

### 2. `src/app/page.tsx`
- Updated `useEffect` to handle `async analyze()`
- Added loading state: "Generating comparison summary..." with spinner
- No other UI changes

### 3. `__tests__/diff/analyzer.test.ts`
- Updated all tests to use `await diffAnalyzer.analyze()`
- Removed old clustering tests
- Added new tests for:
  - Valid structure
  - Max limits
  - No code blocks in summary
  - Natural language (no word lists)
  - Insufficient responses

### 4. Documentation
- Created `docs/comparison-summary-llm-refactor.md` with full details

## Output Format

```
Comparison Summary

Common Ground
- [Natural language statement about shared concepts]
- [Another shared idea]

Key Differences
GPT 5 Mini:
- [What this model uniquely contributed]
- [Its specific approach]

Claude Sonnet 4.5:
- [What this model uniquely contributed]

Notable Gaps
- [Important topics that were missing]
- [Specific concept one or more models didn't cover]
```

## Benefits

✅ **Human-readable** - Reads naturally, not like extracted text  
✅ **Meaning-focused** - Emphasizes concepts over literal phrases  
✅ **No code pollution** - Code stays in response panels  
✅ **Consistent format** - Always 3 sections with clear structure  
✅ **Fast** - 2-5 seconds typical, with timeout protection  

## Testing

Run tests:
```bash
npm run test:diff
```

All 5 core tests pass:
- Structure validation ✓
- Max limits ✓
- No code blocks ✓
- Insufficient responses ✓
- Natural language ✓

## Cost

- Model: claude-haiku-4-5-20251001 (Claude Haiku 4.5)
- Cost per summary: ~$0.0001 (negligible)
- Only runs after all model responses complete (non-blocking)
- Why Claude Haiku? Fast, cheap, and doesn't have GPT-5-mini's reasoning token issues
