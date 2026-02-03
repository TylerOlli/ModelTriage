# Comparison Summary Redesign

## Summary

Redesigned the diff analyzer from word-based token extraction to meaning-based semantic comparison, producing user-friendly summaries with complete ideas instead of raw word lists.

## Files Changed

1. **`lib/diff/types.ts`** - Updated types to support new three-section structure
2. **`lib/diff/analyzer.ts`** - Complete rewrite with semantic clustering
3. **`src/app/page.tsx`** - Updated UI to display new summary format
4. **`__tests__/diff/analyzer.test.ts`** - Added comprehensive unit tests
5. **`package.json`** - Added `test:diff` script

## Approach

**Pipeline:** Extract sentences → Normalize text → Cluster by similarity (Jaccard) → Rank clusters → Generate bullets with citations

**Key improvements:**
- Sentence-level extraction (not words) with minimum 20-char claims
- Jaccard similarity clustering (30% threshold) groups similar ideas
- Per-section max limits enforced (5/3/4 bullets)
- Model attribution in parentheses for traceability
- Proper capitalization and formatting for readability

**Output structure:**
- **Common Ground** (2-5 bullets): Ideas mentioned by most/all models
- **Key Differences** (per model, 1-3 bullets): Unique contributions per model
- **Notable Gaps** (1-4 bullets): Missing aspects or length variance

## Tests Verified

✅ No token/word lists  
✅ No duplicates  
✅ Max bullets respected  
✅ Stable format (3 sections)  
✅ Proper capitalization  
✅ Semantic clustering  
✅ Length variance detection  
✅ Model name formatting
