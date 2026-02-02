# UI Integration Test Checklist

## Prerequisites
- Dev server running: `npm run dev`
- Navigate to: http://localhost:3000

## Test Cases

### 1. Initial Page Load
- [ ] Page loads without errors
- [ ] Header displays "ModelTriage"
- [ ] Prompt textarea is visible and enabled
- [ ] Submit button is visible
- [ ] Character counter shows "0 / 4,000 characters"
- [ ] Instructions section is visible

### 2. Prompt Input
- [ ] Can type in the textarea
- [ ] Character counter updates as you type
- [ ] Submit button is disabled when textarea is empty
- [ ] Submit button is enabled when there's text

### 3. Character Limit Validation
- [ ] Counter turns red when > 4,000 characters
- [ ] Submit button is disabled when over limit
- [ ] Textarea border turns red when over limit

### 4. Streaming Response
**Test prompt:** "Hello, how are you?"

- [ ] Click Submit button
- [ ] Submit button changes to "Streaming..."
- [ ] Textarea becomes disabled during streaming
- [ ] "Starting stream..." loading state appears briefly
- [ ] Response section appears
- [ ] Text streams in progressively (not all at once)
- [ ] "Streaming..." indicator shows in response header
- [ ] Response completes successfully

### 5. Metadata Display
After streaming completes:
- [ ] Metadata section appears below response
- [ ] Shows Model: mock-model-1
- [ ] Shows Provider: mock
- [ ] Shows Latency: [number]ms
- [ ] Shows Tokens: [number]

### 6. Multiple Submissions
- [ ] Can submit a second prompt
- [ ] Previous response is cleared
- [ ] New response streams correctly

### 7. Cancel Functionality
**Test prompt:** "Write a long response"

- [ ] Click Submit
- [ ] Cancel button appears during streaming
- [ ] Click Cancel
- [ ] Streaming stops
- [ ] Partial output is preserved
- [ ] Error message: "Stream cancelled"

### 8. Error Handling
**Test with empty prompt:**
- [ ] Submit button is disabled (cannot submit)

**Test with prompt > 4,000 characters:**
- [ ] Error message appears before submission
- [ ] Submit button is disabled

**Test API error (if dev server is stopped):**
- [ ] Error section appears with red background
- [ ] Error message is displayed
- [ ] Partial response (if any) is preserved

### 9. Visual/UX
- [ ] Responsive layout (try resizing browser)
- [ ] Proper spacing and padding
- [ ] Colors are consistent
- [ ] Loading spinner animates smoothly
- [ ] Text is readable
- [ ] Focus states work on inputs

### 10. Accessibility
- [ ] Textarea has a label
- [ ] Character counter is associated with textarea (aria-describedby)
- [ ] Can submit form with Enter (if desired) or button click
- [ ] Error messages are clearly visible

## Expected Behavior Summary

### Single-Answer Mode (Default)
✅ One model execution per submission
✅ No model selection required
✅ Streaming starts immediately
✅ Partial output preserved on disconnect
✅ Metadata shown after completion

### Not Yet Implemented
❌ Verify Mode (will be added later)
❌ Model routing explanation (will be added later)
❌ Rate limiting UI (will be added later)
❌ Feedback/rating (will be added later)

## Success Criteria
All checkboxes in sections 1-8 should pass for the integration to be considered successful.
