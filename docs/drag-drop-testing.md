# Visual Testing Guide for Drag-and-Drop Feature

## Quick Test Steps

### Test 1: Basic Drag-Over Visual Feedback
1. Open http://localhost:3000 in your browser
2. Create or locate a test file (e.g., test.txt with some content)
3. Drag the file over the prompt input area
4. **Expected**: 
   - The textarea should show a blue border and subtle ring
   - An overlay should appear with:
     - 📎 paperclip icon
     - "Drop files to attach" text
     - Semi-transparent blue background
     - Dashed border

### Test 2: Drop a Single File
1. With the file still dragged over the prompt area
2. Release the mouse (drop the file)
3. **Expected**:
   - Blue overlay disappears immediately
   - A file chip appears below the prompt input
   - Chip shows: icon (📄), filename, size, and X button
   - Counter shows "1/3" next to "Attach Files" button

### Test 3: Drop Multiple Files
1. Select 2 text files (e.g., test1.txt and test2.txt)
2. Drag both over the prompt area
3. Drop them
4. **Expected**:
   - Both files appear as chips
   - Counter shows "2/3"

### Test 4: Drop an Image File
1. Drag a PNG, JPEG, or WebP image over the prompt area
2. Drop it
3. **Expected**:
   - File chip shows 🖼️ icon instead of 📄
   - Filename and size displayed correctly

### Test 5: File Count Limit
1. Attach 3 files (via drag-drop or button)
2. Try to drag another file over the prompt
3. **Expected**:
   - No blue highlight or overlay appears
   - File cannot be dropped

### Test 6: Unsupported File Type
1. Create or find a file with unsupported extension (e.g., .pdf, .exe)
2. Drag and drop it
3. **Expected**:
   - Alert dialog appears with error message
   - Lists the unsupported filename
   - Shows list of supported file types
   - No chip is added

### Test 7: Mixed Valid/Invalid Files
1. Select 1 valid file (.txt) and 1 invalid file (.pdf)
2. Drag and drop both
3. **Expected**:
   - Alert shows for the invalid file
   - Valid file is attached (chip appears)
   - Invalid file is rejected

### Test 8: Remove File
1. Drop a file
2. Click the X button on the file chip
3. **Expected**:
   - Chip disappears
   - Counter updates (e.g., 0/3)
   - Can now drag new files again

### Test 9: Drag-Over State Cancellation
1. Drag a file over the prompt area
2. Without dropping, drag the file away from the prompt area
3. **Expected**:
   - Blue highlight disappears
   - Overlay disappears
   - Prompt returns to normal state

### Test 10: Works with Auto-Select Mode
1. Ensure "Auto-select LLM" mode is active (default)
2. Drag and drop a file
3. Enter a prompt
4. Submit
5. **Expected**:
   - File is included in the request
   - Response acknowledges the file content

### Test 11: Works with Compare Mode
1. Switch to "Compare models" mode
2. Select 2+ models (e.g., GPT-5 Mini, Claude Sonnet 4.5)
3. Drag and drop a file
4. Enter a prompt
5. Submit
6. **Expected**:
   - File is included for all selected models
   - Each model panel shows response based on file content

### Test 12: Disabled During Streaming
1. Start a request (submit a prompt)
2. While streaming, try to drag a file over the prompt
3. **Expected**:
   - No blue highlight
   - No overlay
   - Cannot drop files while streaming

### Test 13: Combine Button and Drag-Drop
1. Click "Attach Files" button and select 1 file
2. Drag and drop another file
3. **Expected**:
   - Both files appear as chips
   - Counter shows "2/3"
   - Both methods work seamlessly together

### Test 14: Edge Case - Rapid Drag In/Out
1. Quickly drag a file in and out of the prompt area multiple times
2. **Expected**:
   - No flickering
   - Overlay appears/disappears smoothly
   - No stuck states (blue highlight persists when it shouldn't)

## Visual Checklist

### Drag-Over State
- [ ] Blue border (border-blue-400)
- [ ] Subtle blue ring (ring-4 ring-blue-500/20)
- [ ] Light blue background tint on textarea (bg-blue-50/30)
- [ ] Overlay with dashed blue border
- [ ] 📎 paperclip icon (text-4xl)
- [ ] "Drop files to attach" text (blue-700)
- [ ] Remaining slot count (when files already attached)

### File Chips
- [ ] Icon: 📄 for text files, 🖼️ for images
- [ ] Filename displayed
- [ ] File size in B/KB/MB
- [ ] X button to remove
- [ ] Gray background (bg-gray-50)
- [ ] Border (border-gray-200)
- [ ] Hover state on X button

### Transitions
- [ ] Smooth 300ms transition on textarea border/ring/bg
- [ ] Overlay appears/disappears instantly (no animation)
- [ ] No visual lag or flicker

## Browser Testing

Test in multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari

## Accessibility Verification

- [ ] "Attach Files" button still works for keyboard users
- [ ] Error alerts are announced (use alert() which is screen-reader friendly)
- [ ] File chips have aria-label for remove button
- [ ] Textarea maintains proper focus states
- [ ] Drag-drop is supplementary (doesn't break existing workflow)

## Integration Testing

1. **Backend receives files correctly**:
   - Open browser DevTools → Network tab
   - Drop a file and submit
   - Check request payload is `multipart/form-data`
   - Verify `file_0`, `file_1`, etc. are present

2. **Files process correctly**:
   - Drop a code file with syntax
   - Ask "What's in this file?"
   - Verify response references file content

3. **Images work**:
   - Drop a PNG image
   - Ask "Describe this image"
   - Verify vision-capable model is selected
   - Response describes image content

## Performance

- [ ] No lag when dragging over prompt area
- [ ] No console errors
- [ ] State updates immediately on drop
- [ ] No memory leaks (check DevTools Memory tab after 10+ drops)

## Screenshot Comparison

### Before (Button Only)
- Only "Attach Files" button for adding files

### After (Button + Drag-Drop)
- Same button
- Plus: Visual feedback when dragging files over prompt
- Plus: Seamless drop-to-attach behavior

---

## Quick Command to Generate Test Files

```bash
# Create test files in a temp directory
cd /tmp
echo "This is a text file" > test.txt
echo "Sample log content" > test.log
echo '{"key": "value"}' > test.json
echo "# Markdown file" > test.md

# For image, you can download or use an existing one
# Or create a simple one (requires ImageMagick):
# convert -size 100x100 xc:blue test.png
```

---

## Expected Behavior Summary

| Action | Visual Feedback | Result |
|--------|----------------|--------|
| Drag file over prompt | Blue border, ring, overlay | Ready to drop |
| Drop file | Overlay disappears, chip appears | File attached |
| Drop 4+ files | Alert dialog | Max 3 files enforced |
| Drop unsupported file | Alert dialog | File rejected |
| Drop while streaming | No feedback | Drop ignored |
| Remove file chip | Chip disappears | File removed |
| Drag over with 3 files | No feedback | Drop disabled |

All visual feedback is subtle and consistent with the existing design language of the application.
