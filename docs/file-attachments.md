# File Attachments

ModelTriage supports attaching files (text and images) to prompts with strict token/cost guardrails.

## Overview

Users can attach up to **3 files** per request:
- **Text files**: `.txt`, `.log`, `.json`, `.md`, `.ts`, `.tsx`, `.js`, `.jsx`, `.env`, `.yml`, `.yaml`
- **Images**: `.png`, `.jpg`, `.webp`

All attachments are processed server-side with automatic truncation, compression, and summarization to prevent runaway costs.

---

## Features

### 1. Text File Processing

**Limits:**
- Max 2MB per text file
- Max 20,000 characters per file
- Max 35,000 characters total across all text files

**Automatic Truncation:**
- Files exceeding per-file limit are truncated to 20,000 characters
- If total exceeds 35,000 characters, files are truncated starting from the end

**Smart Summarization:**
- If total text exceeds 12,000 characters, an LLM (gpt-5-mini) generates a concise summary
- Summary is sent to the main model instead of raw text (cost optimization)
- Summarization never blocks streaming

### 2. Image Processing

**Limits:**
- Max 5MB per image
- Max 2 images per request

**Automatic Optimization:**
- Images are resized to max dimension of 1024px (maintains aspect ratio)
- JPEG quality: 80%
- WebP quality: 80%
- PNG compression level: 7

**Vision Model Requirements:**
- Images are only sent to vision-capable models:
  - `gpt-5.2`
  - `claude-opus-4-5-20251101`
  - `claude-sonnet-4-5-20250929`
  - `gemini-2.5-flash`
  - `gemini-2.5-pro`
- In auto-routing mode: automatically falls back to a vision-capable model if images are attached
- In Verify/Advanced mode: filters to only vision-capable models, or returns an error if none are selected

### 3. Security

**User Warnings:**
- UI displays: "⚠️ Avoid including secrets or sensitive data. Attachments are sent to the model."
- No server-side persistence (files are processed in-memory only)
- Compatible with Vercel serverless runtime

---

## Implementation Details

### Backend Architecture

**Module Structure:**
```
lib/attachments/
├── processor.ts          # Validation, truncation, summarization
├── image-resizer.ts      # Server-side image processing (sharp)
├── vision-support.ts     # Vision capability detection
└── request-parser.ts     # Multipart/JSON request parsing
```

**API Route Updates:**
- `/api/stream` accepts both `application/json` and `multipart/form-data`
- Files are sent as `file_0`, `file_1`, etc. in FormData
- All existing JSON fields remain compatible

**Prompt Construction:**
```
Original Prompt

--- ATTACHMENTS ---

Attachment: file.txt (.txt)
[Truncated: showing first 20000 characters]
<content>

2 image(s) attached (sent separately to vision-capable models).

Instruction: Use attachments as primary evidence. If truncated, mention what's missing.
```

### Frontend Implementation

**State Management:**
```typescript
const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
const fileInputRef = useRef<HTMLInputElement>(null);
```

**Request Building:**
- If files are attached: sends `multipart/form-data`
- Otherwise: sends `application/json` (backward compatible)

**UI Components:**
- Hidden file input with accept filter
- "📎 Attach Files" button (disabled when 3 files attached or streaming)
- File chips showing name, size, type, and remove button
- Security warning banner

---

## Usage Examples

### Text File Attachment

1. Click "📎 Attach Files"
2. Select a log file or code file
3. Submit prompt
4. Model receives:
   - Original prompt
   - File name and type
   - File content (truncated if needed)

### Image Attachment

1. Attach an image file
2. If in auto-routing mode: automatically routed to a vision-capable model (e.g., `gemini-2.5-flash`)
3. If in Verify mode: only vision-capable selected models will receive the image

### Mixed Attachments

1. Attach 1 image + 2 text files
2. Text files are processed first:
   - Individual truncation
   - Total cap enforcement
   - Optional summarization
3. Image is resized and compressed
4. Both sent to vision-capable model(s)

---

## Error Handling

**User-Friendly Errors:**
- "Too many files. Maximum 3 files allowed."
- "Unsupported file type: video.mp4. Allowed: text/log/json/md/ts/js files or png/jpg/webp images."
- "Image too large: photo.jpg. Maximum 5MB allowed."
- "Images require a vision-capable model. Please select: gpt-5.2, claude-opus-4-5-20251101, ..."

**Server-Side Validation:**
- File count, type, and size validated before processing
- Graceful fallback if summarization fails
- Per-model vision capability checks

---

## Testing

**Run Tests:**
```bash
npm run test:attachments
```

**Test Coverage:**
- File count validation (0, 1-3, 4+ files)
- File type validation (supported vs. unsupported)
- Size limit enforcement (text 2MB, images 5MB)
- Image count validation (0-2 ok, 3+ rejected)
- Per-file text truncation (20k chars)
- Total text cap enforcement (35k chars)
- Multi-file truncation logic

---

## Future Enhancements

**Not Implemented (MVP):**
- PDF support
- Audio/video files
- Attachment persistence across sessions
- OCR for images
- Multi-page document support
- Attachment preview in UI

---

## Cost Optimization

**Token Savings:**
- Truncation prevents oversized context from inflating costs
- Summarization reduces tokens by ~70% for large attachments
- Image compression reduces vision API costs
- Hard caps prevent accidental cost spikes

**Typical Token Usage:**
- Small text file (1k chars): ~250 tokens
- Large text file (20k chars, truncated): ~5,000 tokens
- Large text file (20k chars, summarized): ~1,500 tokens
- Resized image (1024px): ~800-1200 tokens (vision models)

---

## Security Considerations

1. **No Persistence:** Files are processed in-memory only, never written to disk
2. **User Warning:** Clear UI message about not including secrets
3. **Server-Side Processing:** All validation and truncation happens server-side
4. **Vercel Compatible:** Works within serverless function limits
5. **No dangerouslySetInnerHTML:** Safe HTML escaping for file content display

---

## Limitations

1. **Max 3 files per request**
2. **Max 2 images per request**
3. **Single-turn only** (attachments not persisted in follow-up prompts)
4. **No drag-and-drop** (file input button only)
5. **No preview** (users see file name/size only)

---

## API Contract

### Request (Multipart)

```
POST /api/stream
Content-Type: multipart/form-data

Fields:
- prompt: string (required)
- stream: "true" | "false"
- models: JSON array (optional)
- previousPrompt: string (optional)
- previousResponse: string (optional)
- file_0: File (optional)
- file_1: File (optional)
- file_2: File (optional)
```

### Response

Same SSE/JSON response format as existing `/api/stream` endpoint.

---

## Dependencies

- `sharp` - Server-side image processing (resize, compress, format conversion)
- No additional client-side dependencies

---

## Configuration

**Hard-Coded Limits** (in `lib/attachments/processor.ts`):
```typescript
export const LIMITS = {
  MAX_FILES: 3,
  MAX_IMAGES: 2,
  MAX_TEXT_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  MAX_CHARS_PER_TEXT_FILE: 20_000,
  MAX_CHARS_TOTAL: 35_000,
  SUMMARIZATION_THRESHOLD: 12_000,
  MAX_CHARS_WHEN_SUMMARIZED: 6_000,
} as const;
```

**Vision-Capable Models** (in `lib/attachments/vision-support.ts`):
```typescript
export const VISION_CAPABLE_MODELS: ModelId[] = [
  "gpt-5.2",
  "claude-opus-4-5-20251101",
  "claude-sonnet-4-5-20250929",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];
```

---

## Troubleshooting

**"Attachment validation failed"**
- Check file types are supported
- Check file sizes are under limits
- Check total file count <= 3

**"Images require a vision-capable model"**
- Enable Verify/Advanced mode
- Select at least one vision-capable model
- OR: Let auto-routing handle it (default behavior)

**"Failed to process attachments"**
- Check image is not corrupt
- Check image format is supported
- Try reducing image file size

**"We couldn't process the image attachment"**
- Image resize/compression failed
- Try re-uploading a clearer screenshot
- Try a different image format (PNG recommended)

**Model ignoring image or hallucinating**
- If this occurs, check:
  - Model is vision-capable
  - Image appears in request payload (network tab)
  - No errors in server logs
