// File upload validation using denylist approach
// Allows all text-based files by default, blocks non-actionable file types

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
}

// Blocked file extensions (denylist)
const BLOCKED_EXTENSIONS = {
  // Archives
  archives: ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz', '.tgz'],
  // Media files
  media: ['.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'],
  // Executables and binaries
  executables: ['.exe', '.dmg', '.app', '.bin', '.dll', '.so', '.dylib', '.msi', '.deb', '.rpm'],
  // Office and document formats
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'],
  // Database files
  databases: ['.db', '.sqlite', '.mdb'],
  // Other binary formats
  other: ['.iso', '.img'],
};

// Flatten all blocked extensions
const ALL_BLOCKED_EXTENSIONS = Object.values(BLOCKED_EXTENSIONS).flat();

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

/**
 * Validates a file based on denylist approach
 * Allows all text-based files by default, blocks specific categories
 */
export function validateFile(file: File): FileValidationResult {
  const fileName = file.name.toLowerCase();
  const extension = '.' + fileName.split('.').pop();
  const mimeType = file.type;

  // Allow images by MIME type
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return { valid: true };
  }

  // Check if file is in blocked list
  if (ALL_BLOCKED_EXTENSIONS.includes(extension)) {
    const category = Object.entries(BLOCKED_EXTENSIONS).find(([_, exts]) =>
      exts.includes(extension)
    )?.[0] || 'binary';
    
    return {
      valid: false,
      reason: `${category.charAt(0).toUpperCase() + category.slice(0, -1)} files are not supported (${extension})`,
    };
  }

  // Check for binary content detection (basic heuristic)
  // Files with no extension or very short extensions are likely binary
  if (!extension || extension.length <= 2) {
    return {
      valid: false,
      reason: 'Files without clear extensions are not supported',
    };
  }

  // Allow everything else (text-based files)
  return { valid: true };
}

/**
 * Validates multiple files and returns valid files and error messages
 */
export function validateFiles(files: File[]): {
  validFiles: File[];
  invalidFiles: Array<{ file: File; reason: string }>;
} {
  const validFiles: File[] = [];
  const invalidFiles: Array<{ file: File; reason: string }> = [];

  for (const file of files) {
    const result = validateFile(file);
    if (result.valid) {
      validFiles.push(file);
    } else {
      invalidFiles.push({
        file,
        reason: result.reason || 'Unsupported file type',
      });
    }
  }

  return { validFiles, invalidFiles };
}

/**
 * Generates user-friendly error message for rejected files
 */
export function getFileValidationErrorMessage(
  invalidFiles: Array<{ file: File; reason: string }>
): string {
  const fileList = invalidFiles
    .map((item) => `• ${item.file.name}: ${item.reason}`)
    .join('\n');

  return `Some files cannot be uploaded:\n\n${fileList}\n\n✅ Supported file types:\n• Code files (any text-based: .js, .py, .go, .rs, .css, etc.)\n• Config files (.json, .yaml, .env, etc.)\n• Documentation (.md, .txt, etc.)\n• Images (.png, .jpg, .webp, .gif, .svg)\n\n❌ Not supported:\n• Archives (.zip, .tar, .gz)\n• Media files (.mp4, .mp3, .mov)\n• Executables (.exe, .dmg, .app)\n• Office documents (.pdf, .docx, .xlsx)`;
}
