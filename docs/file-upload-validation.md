# File Upload Validation (Denylist Approach)

## Overview

File upload validation uses a **denylist approach** instead of an allowlist. This makes the system more flexible and developer-friendly by allowing all text-based files by default while blocking specific non-actionable categories.

## Philosophy

**Allow by default, block specific categories:**
- ✅ Allow: Any text-based file (code, config, markup, etc.)
- ✅ Allow: Common image formats
- ❌ Block: Non-actionable file categories (archives, media, executables, office docs)

## Implementation

### File: `lib/file-validation.ts`

**Core function**: `validateFile(file: File): FileValidationResult`

### Blocked Categories

1. **Archives**: `.zip`, `.tar`, `.gz`, `.rar`, `.7z`, `.bz2`, `.xz`, `.tgz`
2. **Media files**: `.mp4`, `.mov`, `.avi`, `.mkv`, `.mp3`, `.wav`, `.flac`, `.aac`, `.ogg`, `.m4a`, `.wma`
3. **Executables**: `.exe`, `.dmg`, `.app`, `.bin`, `.dll`, `.so`, `.dylib`, `.msi`, `.deb`, `.rpm`
4. **Office documents**: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.odt`, `.ods`, `.odp`
5. **Database files**: `.db`, `.sqlite`, `.mdb`
6. **Other binary formats**: `.iso`, `.img`

### Allowed File Types

**Text-based files** (any extension not in denylist):
- Code files: `.js`, `.ts`, `.py`, `.go`, `.rs`, `.rb`, `.java`, `.c`, `.cpp`, `.cs`, `.php`, `.swift`, etc.
- Web files: `.html`, `.css`, `.scss`, `.sass`, `.less`, `.vue`, `.svelte`, etc.
- Config files: `.json`, `.yaml`, `.yml`, `.toml`, `.ini`, `.env`, `.conf`, etc.
- Documentation: `.md`, `.txt`, `.rst`, `.adoc`, etc.
- Shell scripts: `.sh`, `.bash`, `.zsh`, `.fish`, etc.
- Data files: `.csv`, `.xml`, `.graphql`, etc.

**Images** (by MIME type):
- `.png` (image/png)
- `.jpg`, `.jpeg` (image/jpeg)
- `.webp` (image/webp)
- `.gif` (image/gif)
- `.svg` (image/svg+xml)

## Usage

### Frontend (page.tsx)

Both file picker button and drag-and-drop use the same validation:

```typescript
import { validateFiles, getFileValidationErrorMessage } from "@/lib/file-validation";

// In handleFileSelect or handleDrop:
const { validFiles, invalidFiles } = validateFiles(files);

if (invalidFiles.length > 0) {
  alert(getFileValidationErrorMessage(invalidFiles));
}

if (validFiles.length > 0) {
  setAttachedFiles([...attachedFiles, ...validFiles]);
}
```

### Backend Validation

Backend should also validate files using the same logic to prevent bypassing frontend checks.

## Error Messages

When files are rejected, users see a clear message explaining:
- Which specific files were rejected and why
- What file types ARE supported (code, text, images)
- What file types are NOT supported (archives, media, executables, office docs)

**Example error:**
```
Some files cannot be uploaded:

• report.pdf: Documents files are not supported (.pdf)
• video.mp4: Media files are not supported (.mp4)

✅ Supported file types:
• Code files (any text-based: .js, .py, .go, .rs, .css, etc.)
• Config files (.json, .yaml, .env, etc.)
• Documentation (.md, .txt, etc.)
• Images (.png, .jpg, .webp, .gif, .svg)

❌ Not supported:
• Archives (.zip, .tar, .gz)
• Media files (.mp4, .mp3, .mov)
• Executables (.exe, .dmg, .app)
• Office documents (.pdf, .docx, .xlsx)
```

## Benefits

### 1. Developer-Friendly
- Supports ANY programming language (Python, Go, Rust, C++, etc.)
- Supports ANY config format (TOML, INI, etc.)
- Supports ANY markup format (HTML, XML, etc.)
- No need to update allowlist for every new file type

### 2. Clear Communication
- Error messages explain WHY files were rejected
- Shows examples of supported file types
- Lists blocked categories clearly

### 3. Security
- Blocks executables and binaries
- Blocks potentially harmful file types
- Still flexible for legitimate use cases

### 4. Maintainability
- Easy to add new blocked categories
- Denylist is smaller than allowlist
- Less maintenance as new file types emerge

## Future Enhancements

### 1. Binary Content Detection
Could add actual binary content detection by reading file headers:
- Magic number checking (file signatures)
- UTF-8 validation for text files
- Would catch renamed binaries (e.g., .exe renamed to .txt)

### 2. File Size Validation
Currently handled separately, but could integrate:
- Different limits for different file types
- Separate limits for text vs images

### 3. Custom Error Messages
- More specific category-based messages
- Suggestions for alternatives (e.g., "Try extracting the archive first")

## Migration from Allowlist

**Before** (allowlist):
```typescript
const supportedExtensions = ['.txt', '.log', '.json', '.md', '.ts', '.tsx', '.js', '.jsx', '.env', '.yml', '.yaml'];
const supportedImageTypes = ['image/png', 'image/jpeg', 'image/webp'];

// Only these specific types allowed
```

**After** (denylist):
```typescript
const BLOCKED_EXTENSIONS = {
  archives: ['.zip', '.tar', '.gz', ...],
  media: ['.mp4', '.mov', ...],
  executables: ['.exe', '.dmg', ...],
  documents: ['.pdf', '.docx', ...],
};

// Everything else allowed (text-based)
```

**Impact**:
- Now supports 100+ file types automatically
- No need to update code for new languages/formats
- More intuitive for developers

## Testing

Test cases to verify:

### Should Accept:
- [ ] JavaScript files (.js, .jsx, .ts, .tsx)
- [ ] Python files (.py)
- [ ] Go files (.go)
- [ ] Rust files (.rs)
- [ ] C/C++ files (.c, .cpp, .h, .hpp)
- [ ] CSS files (.css, .scss, .sass)
- [ ] Config files (.json, .yaml, .toml, .ini)
- [ ] Shell scripts (.sh, .bash)
- [ ] Images (.png, .jpg, .webp, .gif, .svg)
- [ ] Documentation (.md, .txt, .rst)

### Should Reject:
- [ ] ZIP archives (.zip, .tar, .gz)
- [ ] Video files (.mp4, .mov, .avi)
- [ ] Audio files (.mp3, .wav, .flac)
- [ ] Executables (.exe, .dmg, .app, .bin)
- [ ] Office documents (.pdf, .docx, .xlsx, .pptx)
- [ ] Database files (.db, .sqlite)

### Edge Cases:
- [ ] Files with no extension
- [ ] Files with uppercase extensions (.JS, .PY)
- [ ] Mixed valid/invalid file drops
- [ ] Multiple images (within 2 image limit)
