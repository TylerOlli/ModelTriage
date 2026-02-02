# Streaming Controls & Cancel Behavior Test Plan

## Purpose

Verify that control locking during streaming and cancel behavior work correctly, preventing stuck states and providing clear user feedback.

## Prerequisites

- Dev server running: `npm run dev`
- Browser at `http://localhost:3000`
- Browser console open to check for errors

---

## Test Suite 1: Control Locking

### Test 1.1: Verify Mode Toggle Locks During Streaming

**Steps:**
1. Start with Verify Mode OFF
2. Enter prompt: "Hello world"
3. Click Submit
4. Immediately try to click Verify Mode toggle

**Expected:**
- ✅ Toggle is visually disabled (50% opacity)
- ✅ Clicking toggle does nothing
- ✅ After stream completes, toggle becomes clickable

### Test 1.2: Model Count Locks During Streaming

**Steps:**
1. Enable Verify Mode
2. Select 2 models
3. Enter prompt: "Test"
4. Click Submit
5. Immediately try to click "3" button

**Expected:**
- ✅ Model count buttons are disabled (50% opacity)
- ✅ Clicking buttons does nothing
- ✅ After streams complete, buttons become clickable

### Test 1.3: Submit Button Disabled During Streaming

**Steps:**
1. Enter prompt: "Test"
2. Click Submit
3. Observe Submit button

**Expected:**
- ✅ Button shows "Streaming..."
- ✅ Button is gray/disabled
- ✅ Clicking again does nothing
- ✅ After completion, button shows "Submit" and is blue

### Test 1.4: Prompt Textarea Disabled During Streaming

**Steps:**
1. Enter prompt: "Test"
2. Click Submit
3. Try to edit the prompt

**Expected:**
- ✅ Textarea is disabled
- ✅ Cannot type or edit
- ✅ After completion, textarea is editable again

---

## Test Suite 2: Cancel in Single-Answer Mode

### Test 2.1: Cancel Immediately After Submit

**Steps:**
1. Verify Mode OFF
2. Enter prompt: "Explain quantum computing"
3. Click Submit
4. Immediately click Cancel

**Expected:**
- ✅ Streaming stops
- ✅ Error message: "Stream cancelled"
- ✅ Any partial response text is preserved
- ✅ Submit button unlocks
- ✅ Verify Mode toggle unlocks
- ✅ Prompt textarea is editable
- ✅ Clear button appears

### Test 2.2: Cancel Mid-Stream

**Steps:**
1. Verify Mode OFF
2. Enter prompt: "Write a long essay"
3. Click Submit
4. Wait ~2 seconds
5. Click Cancel

**Expected:**
- ✅ Streaming stops
- ✅ Error: "Stream cancelled"
- ✅ Partial response visible (more text than Test 2.1)
- ✅ All controls unlock

### Test 2.3: Submit Again After Cancel

**Steps:**
1. Follow Test 2.1 or 2.2 to cancel
2. Click Clear
3. Enter new prompt: "Hello"
4. Click Submit

**Expected:**
- ✅ New stream starts successfully
- ✅ No errors in console
- ✅ Response displays correctly

---

## Test Suite 3: Cancel in Verify Mode

### Test 3.1: Cancel Before Any Panel Completes

**Steps:**
1. Enable Verify Mode
2. Select 2 models
3. Enter prompt: "Long task"
4. Click Submit
5. Immediately click Cancel (within 1 second)

**Expected:**
- ✅ Both panels show error: "Cancelled by user"
- ✅ Partial text visible in both panels
- ✅ No metadata in either panel
- ✅ All controls unlock
- ✅ Verify Mode toggle unlocks
- ✅ Model count selector unlocks

### Test 3.2: Cancel After One Panel Completes

**Steps:**
1. Enable Verify Mode
2. Select 2 models
3. Enter prompt: "Test"
4. Click Submit
5. Wait for one panel's metadata to appear
6. Click Cancel

**Expected:**
- ✅ Completed panel shows full response and metadata
- ✅ Incomplete panel shows "Cancelled by user"
- ✅ Completed panel does NOT show cancelled error
- ✅ All controls unlock

### Test 3.3: Cancel with 3 Models

**Steps:**
1. Enable Verify Mode
2. Select 3 models
3. Enter prompt: "Compare"
4. Click Submit
5. Click Cancel after ~1 second

**Expected:**
- ✅ At least one panel shows "Cancelled by user"
- ✅ Any completed panels show full results
- ✅ Mixed state: some cancelled, some completed
- ✅ All controls unlock

---

## Test Suite 4: Stuck State Prevention

### Test 4.1: Multiple Cancel Clicks

**Steps:**
1. Enter prompt: "Test"
2. Click Submit
3. Click Cancel 5 times rapidly

**Expected:**
- ✅ No errors in browser console
- ✅ UI remains responsive
- ✅ Controls unlock after first cancel
- ✅ Additional clicks are safe (no-op)

### Test 4.2: Cancel During Error

**Steps:**
1. Stop dev server: `Ctrl+C` in terminal
2. Enter prompt: "Test"
3. Click Submit
4. Immediately click Cancel

**Expected:**
- ✅ No stuck state
- ✅ Controls unlock
- ✅ Error message displayed
- ✅ Can retry after restarting server

### Test 4.3: Page Refresh During Streaming

**Steps:**
1. Enter prompt: "Long prompt"
2. Click Submit
3. Immediately refresh page (F5)

**Expected:**
- ✅ Page loads fresh
- ✅ Verify Mode/model count restored from localStorage
- ✅ Prompt NOT restored (cleared by Clear button if tested earlier)
- ✅ No streaming state
- ✅ All controls unlocked

---

## Test Suite 5: Visual Feedback

### Test 5.1: Disabled Control Appearance

**Steps:**
1. Enter prompt: "Test"
2. Click Submit
3. Observe all controls

**Expected Visual States:**
- ✅ Verify Mode toggle: 50% opacity, gray
- ✅ Model count buttons: 50% opacity
- ✅ Submit button: Gray, text "Streaming..."
- ✅ Prompt textarea: Gray background
- ✅ Cancel button: Visible, red, clickable

### Test 5.2: Cancelled Panel Appearance (Verify Mode)

**Steps:**
1. Enable Verify Mode, 2 models
2. Submit and immediately cancel

**Expected Panel Appearance:**
```
┌─────────────────────────────┐
│ 🎯 Model: mock-code-1       │
│ Response: [partial text]    │
│                             │
│ ❌ Error                    │
│ Cancelled by user           │
└─────────────────────────────┘
```

- ✅ Error section visible
- ✅ "Cancelled by user" text
- ✅ Partial response preserved above
- ✅ No metadata section

---

## Test Suite 6: Edge Cases

### Test 6.1: Cancel on Empty Panel

**Steps:**
1. Enable Verify Mode
2. Enter prompt: "Test"
3. Click Submit
4. Click Cancel before ANY text appears

**Expected:**
- ✅ Panels show "Cancelled by user"
- ✅ No partial text (none streamed yet)
- ✅ Controls unlock

### Test 6.2: Rapid Submit-Cancel-Submit

**Steps:**
1. Enter prompt: "Test"
2. Click Submit
3. Click Cancel immediately
4. Click Submit again immediately

**Expected:**
- ✅ First stream cancelled
- ✅ Second stream starts
- ✅ No interference between streams
- ✅ No console errors

### Test 6.3: Switch Mode After Cancel

**Steps:**
1. Verify Mode OFF
2. Submit and cancel
3. Enable Verify Mode
4. Submit again

**Expected:**
- ✅ Verify Mode activates correctly
- ✅ Multiple panels appear
- ✅ No issues from previous cancel

---

## Test Suite 7: Persistence After Cancel

### Test 7.1: Settings Persist After Cancel

**Steps:**
1. Enable Verify Mode
2. Select 3 models
3. Submit and cancel
4. Refresh page

**Expected:**
- ✅ Verify Mode still ON
- ✅ Model count still 3
- ✅ Prompt is empty (if cleared)

### Test 7.2: Clear Works After Cancel

**Steps:**
1. Submit and cancel
2. Partial output visible
3. Click Clear

**Expected:**
- ✅ Partial output removed
- ✅ Error message removed
- ✅ Prompt cleared
- ✅ "How it works" blurb appears

---

## Manual Verification Checklist

During streaming, verify these controls are disabled:

- [ ] Verify Mode toggle (50% opacity, cursor not-allowed)
- [ ] Model count selector buttons (50% opacity)
- [ ] Submit button (gray, "Streaming...")
- [ ] Prompt textarea (gray, disabled)

After cancel, verify these controls unlock:

- [ ] Verify Mode toggle (full opacity, clickable)
- [ ] Model count selector (full opacity, clickable)
- [ ] Submit button (blue, "Submit")
- [ ] Prompt textarea (white, editable)
- [ ] Clear button (appears)

In Verify Mode, after cancel:

- [ ] Incomplete panels show "Cancelled by user"
- [ ] Completed panels show full results
- [ ] Partial text preserved in all panels
- [ ] No stuck state

---

## Success Criteria

✅ All controls lock during streaming
✅ All controls unlock after cancel
✅ Cancel stops all active streams
✅ Partial output preserved
✅ Incomplete panels marked "Cancelled by user"
✅ Completed panels unaffected
✅ No stuck states possible
✅ Multiple cancels are safe
✅ UI remains responsive
✅ No console errors

## Common Issues to Watch For

❌ Controls remain locked after cancel
❌ Cancel doesn't stop stream
❌ Partial output lost
❌ Completed panels marked as cancelled
❌ Console errors on multiple cancels
❌ UI becomes unresponsive

## Running the Tests

```bash
# Start dev server
npm run dev

# Open browser
open http://localhost:3000

# Follow test steps manually
# Check browser console for errors
```

## Automated Testing (Future)

While these are currently manual tests, key behaviors to automate:

- Control locking/unlocking
- Cancel state transitions
- Error handling
- Stuck state prevention
- Verify Mode panel states

## File References

- Implementation: `src/app/page.tsx`
- Documentation: `docs/streaming-controls.md`
- This test plan: `docs/streaming-controls-test.md`
