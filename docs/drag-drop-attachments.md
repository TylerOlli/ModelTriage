# Drag-and-Drop File Upload Implementation

## Overview
Added drag-and-drop file upload support to the Prompt input area, extending the existing "Attach Files" functionality without creating parallel code paths.

## Changes Made

### 1. State Management (`src/app/page.tsx`)

Added new state and refs for tracking drag operations:

```typescript
const [isDraggingOver, setIsDraggingOver] = useState(false);
const dragCounterRef = useRef(0); // Track nested drag events
```

The `dragCounterRef` is crucial for handling nested drag events (when dragging over child elements), preventing flickering of the drop indicator.

### 2. Drag Event Handlers

Implemented four core drag handlers that work with native browser APIs:

#### `handleDragEnter(e: React.DragEvent)`
- Prevents default browser behavior
- Increments drag counter for nested element tracking
- Respects constraints (no drag state if streaming or 3 files already attached)
- Shows drag-over state when files are detected

#### `handleDragOver(e: React.DragEvent)`
- Prevents default behavior to allow dropping
- Required for the drop event to fire

#### `handleDragLeave(e: React.DragEvent)`
- Decrements drag counter
- Only hides drag state when counter reaches 0 (all nested elements exited)

#### `handleDrop(e: React.DragEvent)`
- Prevents default file-open behavior
- Resets drag state
- Validates file types against existing attachment rules
- Filters valid/invalid files
- Shows appropriate error messages for:
  - Unsupported file types
  - Exceeding 3-file limit
- Adds valid files using same logic as "Attach Files" button

### 3. File Validation

Reuses existing file type restrictions from the file input `accept` attribute:

**Supported text files:**
- `.txt`, `.log`, `.json`, `.md`
- `.ts`, `.tsx`, `.js`, `.jsx`
- `.env`, `.yml`, `.yaml`

**Supported images:**
- `image/png`
- `image/jpeg`
- `image/webp`

### 4. UI Components

#### Form Container
Added drag event handlers to the main form container:

```tsx
<div 
  className="relative bg-slate-50 rounded-lg shadow-md border border-gray-300 p-8"
  onDragEnter={handleDragEnter}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
```

#### Drop Indicator Overlay
Displays when dragging over the prompt area:

```tsx
{isDraggingOver && (
  <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/80 backdrop-blur-sm rounded-lg border-2 border-blue-400 border-dashed pointer-events-none">
    <div className="text-center">
      <div className="text-4xl mb-2">📎</div>
      <div className="text-sm font-medium text-blue-700">Drop files to attach</div>
      <div className="text-xs text-blue-600 mt-1">
        {attachedFiles.length > 0 && `${3 - attachedFiles.length} more file${3 - attachedFiles.length !== 1 ? 's' : ''} allowed`}
      </div>
    </div>
  </div>
)}
```

Features:
- Centered overlay with semi-transparent blue background
- Dashed border for clear drop zone indication
- Shows paperclip emoji for attachment context
- Displays remaining file slots when files are already attached
- `pointer-events-none` to avoid interfering with drag events

#### Textarea Visual Feedback
Enhanced the textarea with drag-over styling:

```tsx
className={`w-full px-5 py-4 border-2 rounded-lg outline-none resize-vertical bg-white text-lg leading-7 text-gray-900 placeholder:text-gray-400/70 transition-all duration-300 ease-out ${
  isDraggingOver
    ? "border-blue-400 ring-4 ring-blue-500/20 bg-blue-50/30"
    : isOverLimit 
      ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10" 
      : "border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
}`}
```

When dragging over:
- Blue border (`border-blue-400`)
- Subtle blue ring (`ring-4 ring-blue-500/20`)
- Light blue background tint (`bg-blue-50/30`)

### 5. User Experience

#### Visual States
1. **Default**: Standard gray border and white background
2. **Drag Over**: Blue border, ring, and light background tint with overlay
3. **Focus**: Blue border and ring (when not dragging)
4. **Over Limit**: Red border and ring (character limit exceeded)

#### Error Handling
- **Unsupported files**: Alert listing file names and supported types
- **Too many files**: Alert showing current count and attempted addition
- **Valid + invalid mix**: Processes valid files, shows error for invalid ones

#### Constraints
- Maximum 3 files (matches existing button behavior)
- Disabled during streaming
- File types validated against existing rules
- Multiple files can be dropped at once

## Testing Checklist

### Basic Functionality
- [ ] Drag single text file over prompt area shows blue highlight
- [ ] Drop single text file attaches it (chip appears below prompt)
- [ ] Drag single image file over prompt area shows blue highlight
- [ ] Drop single image file attaches it (chip appears with 🖼️ icon)
- [ ] Multiple files can be dropped at once (up to 3 total)
- [ ] Dropped files appear in attachment chips immediately

### File Type Validation
- [ ] Supported text files (.txt, .log, .json, .md, .ts, etc.) are accepted
- [ ] Supported images (PNG, JPEG, WebP) are accepted
- [ ] Unsupported file types show error alert with file names
- [ ] Mixed drop (valid + invalid) accepts valid and rejects invalid

### Constraints
- [ ] Cannot drag when streaming (no visual feedback)
- [ ] Cannot exceed 3 files total
- [ ] Dropping 4+ files at once shows appropriate error
- [ ] Dropping files when 3 already attached shows error

### Visual Feedback
- [ ] Blue border and ring appear on drag over
- [ ] Drop indicator overlay shows with paperclip icon
- [ ] "Drop files to attach" message displays
- [ ] Remaining file count shows when files already attached
- [ ] Drag state clears immediately on drop
- [ ] Drag state clears when dragging away

### Integration
- [ ] Dropped files work the same as button-attached files
- [ ] Can remove dropped files with X button
- [ ] Can mix dropped and button-attached files
- [ ] Works in Auto-select mode
- [ ] Works in Compare mode
- [ ] Files are properly sent in API request (FormData)
- [ ] Backend processes dropped files identically to button-attached

### Edge Cases
- [ ] Dragging over nested elements doesn't cause flicker
- [ ] Drag state clears if mouse leaves window
- [ ] Browser's default file-open behavior is prevented
- [ ] Works with rapid drag enter/leave cycles
- [ ] Works when textarea is focused

## Browser Compatibility

Uses native HTML5 Drag and Drop API:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari

## Performance Considerations

- No third-party libraries added
- Minimal state changes (single boolean flag)
- Event handlers are memoized as component methods
- File validation uses existing patterns
- No async operations in drag handlers

## Accessibility

- Maintains existing keyboard navigation
- Screen readers can still use "Attach Files" button
- Visual feedback is supplementary to existing functionality
- Error messages use standard `alert()` for screen reader compatibility

## Future Enhancements (Optional)

1. **File preview on hover**: Show file name/type during drag
2. **Progress indicator**: For large file uploads
3. **Custom error toast**: Replace `alert()` with inline toast notifications
4. **Drag-to-reorder**: Allow reordering attached files
5. **Paste support**: Accept files from clipboard paste events
