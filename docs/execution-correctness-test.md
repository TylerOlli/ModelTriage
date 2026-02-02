# Execution Correctness Test Plan

## Purpose

Verify concurrent run prevention, error isolation, and comparison summary correctness.

## Prerequisites

- Dev server running: `npm run dev`
- Browser at `http://localhost:3000`
- Browser console open

---

## Test Suite 1: Concurrent Run Prevention

### Test 1.1: Rapid Button Clicks

**Steps:**
1. Enter prompt: "Hello world"
2. Click Submit button 10 times rapidly (as fast as possible)
3. Observe console

**Expected:**
- ✅ Only 1 stream starts
- ✅ Console shows ~9 warnings: "Run already in progress, ignoring duplicate submit"
- ✅ Button becomes disabled after first click
- ✅ No overlapping streams
- ✅ UI remains stable
- ✅ Single response appears

**Why It Works:**
- Button disabled (Layer 1)
- Code guard catches any that slip through (Layer 2)

### Test 1.2: Submit via Enter Key Repeatedly

**Steps:**
1. Enter prompt: "Test"
2. Press Enter 5 times rapidly
3. Observe console

**Expected:**
- ✅ Only 1 stream starts
- ✅ Console warnings for duplicate attempts
- ✅ No state corruption

### Test 1.3: Cancel Then Rapid Submit

**Steps:**
1. Submit prompt
2. Click Cancel
3. Immediately click Submit 3 times rapidly

**Expected:**
- ✅ First stream cancels
- ✅ Only 1 new stream starts
- ✅ Console may show warnings if clicks during state transition
- ✅ No interference between streams

### Test 1.4: Submit During Previous Stream Cleanup

**Steps:**
1. Submit short prompt (completes quickly)
2. As soon as response finishes, click Submit repeatedly
3. Watch for any overlap

**Expected:**
- ✅ First stream completes fully
- ✅ Only 1 second stream starts
- ✅ No overlap in responses

---

## Test Suite 2: Error Isolation (Single Panel)

### Test 2.1: Simulate Panel Error in Verify Mode

**Setup:** Temporarily modify API to return error for one model

**Steps:**
1. Enable Verify Mode, select 2 models
2. Submit prompt
3. Observe panels

**Expected:**
- ✅ Panel with error shows:
  - Error card (red background, border)
  - ❌ icon
  - Clear error message
- ✅ Other panel continues normally
- ✅ Successful panel shows full response + metadata
- ✅ Comparison uses only successful panel (message shown)

### Test 2.2: Error with Partial Response

**Setup:** Error occurs mid-stream after some content

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit prompt that triggers mid-stream error

**Expected:**
- ✅ Errored panel shows:
  - Partial response text (preserved)
  - Error card below (red, prominent)
- ✅ Other panel unaffected
- ✅ Both sections visible in errored panel

---

## Test Suite 3: Error Isolation (Multiple Panels)

### Test 3.1: Two Models, One Errors

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit prompt
3. Simulate Panel 1 error

**Expected:**
- ❌ Panel 1: Error card
- ✅ Panel 2: Full response + metadata
- ℹ Message: "Comparison requires at least 2 successful responses. Only 1 panel completed successfully."
- ❌ No comparison summary

**Visual:**
```
┌─────────────┐  ┌─────────────┐
│ Panel 1     │  │ Panel 2     │
│ ❌ Error    │  │ ✓ Complete  │
└─────────────┘  └─────────────┘

ℹ Comparison requires at least 2 successful responses.
  Only 1 panel completed successfully.
```

### Test 3.2: Three Models, One Errors

**Steps:**
1. Enable Verify Mode, 3 models
2. Submit prompt
3. Simulate Panel 2 error

**Expected:**
- ✅ Panel 1: Complete
- ❌ Panel 2: Error card
- ✅ Panel 3: Complete
- ✅ Comparison summary shown
- ✅ Summary uses only Panels 1 & 3

**Visual:**
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Panel 1     │  │ Panel 2     │  │ Panel 3     │
│ ✓ Complete  │  │ ❌ Error    │  │ ✓ Complete  │
└─────────────┘  └─────────────┘  └─────────────┘

Comparison Summary
✓ Agreement
  - Both models agree on X
  - Both models mention Y
```

### Test 3.3: Three Models, Two Error

**Steps:**
1. Enable Verify Mode, 3 models
2. Submit prompt
3. Simulate Panels 1 & 3 error

**Expected:**
- ❌ Panel 1: Error card
- ✅ Panel 2: Complete
- ❌ Panel 3: Error card
- ℹ Message: "Only 1 panel completed successfully"
- ❌ No comparison summary

### Test 3.4: All Panels Error

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit prompt
3. Simulate all panels error

**Expected:**
- ❌ Panel 1: Error card
- ❌ Panel 2: Error card
- ℹ Message: "No panels completed successfully"
- ❌ No comparison summary
- ✅ UI remains functional (can Clear and retry)

---

## Test Suite 4: Comparison Summary Correctness

### Test 4.1: All Successful - Shows Summary

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit prompt
3. Wait for completion

**Expected:**
- ✅ Both panels complete
- ✅ Comparison summary shown
- ✅ Summary analyzes both responses

### Test 4.2: One Error - No Summary, Clear Message

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit with one error

**Expected:**
- ❌ No comparison summary
- ✅ Clear message: "Only 1 panel completed successfully"
- ✅ No confusing partial comparison

### Test 4.3: Three Models, One Error - Summary Uses Two

**Steps:**
1. Enable Verify Mode, 3 models
2. Submit with Panel 2 error

**Expected:**
- ✅ Comparison summary shown
- ✅ Uses Panels 1 & 3 only
- ✅ Summary is accurate (doesn't include errored panel)

### Test 4.4: Cancelled Panel Not in Summary

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit
3. Cancel immediately

**Expected:**
- Both panels show "Cancelled by user"
- ℹ Message: "No panels completed successfully"
- ❌ No comparison summary

---

## Test Suite 5: Visual Verification

### Test 5.1: Error Card Appearance

**Check error card styling:**
- [ ] Red background (`bg-red-50`)
- [ ] Red border (`border-red-200`)
- [ ] ❌ icon visible
- [ ] "Error" heading
- [ ] Clear error message
- [ ] Rounded corners
- [ ] Proper padding

### Test 5.2: Error + Partial Response Layout

**Check layout when both present:**
- [ ] Partial response text shows first
- [ ] Error card shows below (with margin)
- [ ] Both are readable
- [ ] No overlap
- [ ] Proper spacing

### Test 5.3: Info Message Appearance

**Check info message styling:**
- [ ] Blue background (`bg-blue-50`)
- [ ] Blue border (`border-blue-200`)
- [ ] ℹ icon visible
- [ ] Clear explanatory text
- [ ] Proper placement after panels

---

## Test Suite 6: State Management

### Test 6.1: Guard Resets After Error

**Steps:**
1. Submit prompt
2. Force an error (stop server)
3. Restart server
4. Submit again

**Expected:**
- ✅ Error state clears
- ✅ Guard allows new submission
- ✅ New stream works normally

### Test 6.2: Guard Resets After Cancel

**Steps:**
1. Submit prompt
2. Cancel
3. Submit again immediately

**Expected:**
- ✅ Cancel completes
- ✅ Controls unlock
- ✅ Guard allows new submission
- ✅ No interference

### Test 6.3: No Stuck States

**Try to break it:**
1. Submit → Cancel → Submit → Cancel rapidly
2. Submit → Error → Submit
3. Submit → Close browser tab → Reopen

**Expected:**
- ✅ No stuck "Streaming..." state
- ✅ Controls always unlock
- ✅ Can always retry
- ✅ No console errors

---

## Test Suite 7: Edge Cases

### Test 7.1: Empty Prompt Rapid Clicks

**Steps:**
1. Leave prompt empty
2. Click Submit 10 times

**Expected:**
- ✅ No streams start
- ✅ No console warnings
- ✅ Guard doesn't even run (early return)

### Test 7.2: Over-Limit Prompt Rapid Clicks

**Steps:**
1. Enter 5000-character prompt (over limit)
2. Click Submit 5 times

**Expected:**
- ✅ No streams start
- ✅ Error: "Prompt exceeds maximum length"
- ✅ No guard warnings (validation blocks earlier)

### Test 7.3: Diff Analyzer Error

**Setup:** Break diff analyzer temporarily

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit prompt
3. Observe error handling

**Expected:**
- ✅ Panels still show responses
- ⚠ Diff error message: "Could not generate diff summary"
- ✅ Doesn't crash UI
- ✅ Can still Clear and retry

### Test 7.4: Panel Errors During Cancel

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit
3. Simulate error in Panel 1
4. Immediately click Cancel

**Expected:**
- ✅ Panel 1 shows error (before cancel)
- ✅ Panel 2 shows "Cancelled by user"
- ✅ Controls unlock
- ✅ No crashes

---

## Success Criteria

### Concurrent Prevention
- ✅ Only one run can be active
- ✅ Rapid clicks handled gracefully
- ✅ Console warnings for debugging
- ✅ No state corruption

### Error Isolation
- ✅ Panel errors don't affect other panels
- ✅ Error cards prominently displayed
- ✅ Partial output always preserved
- ✅ Clear error messages

### Comparison Summary
- ✅ Only uses successful panels
- ✅ Requires at least 2 successful
- ✅ Clear message when insufficient panels
- ✅ Accurate comparisons

### State Management
- ✅ Guards reset properly
- ✅ No stuck states possible
- ✅ Clean transitions
- ✅ Always recoverable

## Common Issues to Watch For

❌ Multiple concurrent streams
❌ One panel error crashes others
❌ Comparison includes errored panels
❌ No explanation when comparison missing
❌ Stuck "Streaming..." state
❌ Partial output lost on error
❌ Guard doesn't reset after cancel

## Running the Tests

```bash
# Start dev server
npm run dev

# Open browser
open http://localhost:3000

# Follow test steps manually
# Check console for warnings/errors
```

## Debugging Tips

**If concurrent runs occur:**
- Check console for guard warnings
- Verify button disabled state
- Check `isStreaming` state in React DevTools

**If panel errors affect others:**
- Check if error has `modelId` field
- Verify SSE event structure
- Check state update isolation

**If comparison uses errored panels:**
- Check filter logic in diff summary generation
- Verify panel completion criteria
- Check console for diff analyzer input

## File References

- Implementation: `src/app/page.tsx`
- Documentation: `docs/execution-correctness.md`
- This test plan: `docs/execution-correctness-test.md`
