/**
 * File attachment processing with strict token/cost guardrails
 */

import { routeToProvider } from "../llm/router";

// ===== Constants and Limits =====

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

// Blocked file extensions (denylist approach)
export const BLOCKED_EXTENSIONS = {
  archives: ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz', '.tgz'],
  media: ['.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'],
  executables: ['.exe', '.dmg', '.app', '.bin', '.dll', '.so', '.dylib', '.msi', '.deb', '.rpm'],
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'],
  databases: ['.db', '.sqlite', '.mdb'],
  other: ['.iso', '.img'],
};

// Flatten all blocked extensions
const ALL_BLOCKED_EXTENSIONS: string[] = Object.values(BLOCKED_EXTENSIONS).flat();

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

// ===== Types =====

export interface ProcessedTextAttachment {
  type: "text";
  filename: string;
  extension: string;
  originalSize: number;
  content: string;
  truncated: boolean;
  truncatedAt?: number;
}

export interface ProcessedImageAttachment {
  type: "image";
  filename: string;
  mimeType: string;
  originalSize: number;
  data: Buffer;
  resized: boolean;
}

export type ProcessedAttachment =
  | ProcessedTextAttachment
  | ProcessedImageAttachment;

export interface AttachmentProcessingResult {
  attachments: ProcessedAttachment[];
  totalTextChars: number;
  summarized: boolean;
  summary?: string;
  errors: string[];
  // Metadata for routing
  hasImages: boolean;
  hasTextFiles: boolean;
  attachmentNames: string[];
  attachmentTypes: string[];
  imageCount: number;
  textFileCount: number;
}

export interface ValidationError {
  valid: false;
  error: string;
}

export interface ValidationSuccess {
  valid: true;
}

export type ValidationResult = ValidationError | ValidationSuccess;

// ===== Validation =====

export function validateFileCount(count: number): ValidationResult {
  if (count === 0) {
    return { valid: false, error: "No files attached" };
  }
  if (count > LIMITS.MAX_FILES) {
    return {
      valid: false,
      error: `Too many files. Maximum ${LIMITS.MAX_FILES} files allowed.`,
    };
  }
  return { valid: true };
}

export function validateFileType(
  filename: string,
  mimeType: string,
  size: number
): ValidationResult {
  const extension = filename
    .slice(filename.lastIndexOf("."))
    .toLowerCase() as string;
  
  // Check if it's an allowed image by MIME type
  const isImage = ALLOWED_IMAGE_TYPES.includes(
    mimeType as (typeof ALLOWED_IMAGE_TYPES)[number]
  );
  
  if (isImage) {
    if (size > LIMITS.MAX_IMAGE_SIZE_BYTES) {
      return {
        valid: false,
        error: `Image too large: ${filename}. Maximum ${LIMITS.MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB allowed.`,
      };
    }
    return { valid: true };
  }
  
  // Check if file is in blocked list (denylist approach)
  if (ALL_BLOCKED_EXTENSIONS.includes(extension)) {
    const category = Object.entries(BLOCKED_EXTENSIONS).find(([_, exts]) =>
      exts.includes(extension)
    )?.[0] || 'binary';
    
    return {
      valid: false,
      error: `${category.charAt(0).toUpperCase() + category.slice(0, -1)} files are not supported (${extension}). Supported: code files, text files, config files, and images.`,
    };
  }
  
  // Check for files without clear extensions (likely binary)
  if (!extension || extension.length <= 2) {
    return {
      valid: false,
      error: `Files without clear extensions are not supported: ${filename}`,
    };
  }
  
  // Allow all other text-based files
  if (size > LIMITS.MAX_TEXT_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large: ${filename}. Maximum ${LIMITS.MAX_TEXT_SIZE_BYTES / 1024 / 1024}MB allowed.`,
    };
  }

  return { valid: true };
}

export function validateImageCount(imageCount: number): ValidationResult {
  if (imageCount > LIMITS.MAX_IMAGES) {
    return {
      valid: false,
      error: `Too many images. Maximum ${LIMITS.MAX_IMAGES} images allowed.`,
    };
  }
  return { valid: true };
}

// ===== Text Processing =====

export function truncateTextFile(
  content: string,
  filename: string
): ProcessedTextAttachment {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  let truncated = false;
  let truncatedAt: number | undefined;

  if (content.length > LIMITS.MAX_CHARS_PER_TEXT_FILE) {
    content = content.slice(0, LIMITS.MAX_CHARS_PER_TEXT_FILE);
    truncated = true;
    truncatedAt = LIMITS.MAX_CHARS_PER_TEXT_FILE;
  }

  return {
    type: "text",
    filename,
    extension,
    originalSize: content.length,
    content,
    truncated,
    truncatedAt,
  };
}

export function truncateTextAttachmentsToTotalCap(
  textAttachments: ProcessedTextAttachment[]
): { attachments: ProcessedTextAttachment[]; totalChars: number } {
  let totalChars = 0;
  const result: ProcessedTextAttachment[] = [];

  for (const attachment of textAttachments) {
    const remaining = LIMITS.MAX_CHARS_TOTAL - totalChars;
    if (remaining <= 0) break;

    if (attachment.content.length <= remaining) {
      result.push(attachment);
      totalChars += attachment.content.length;
    } else {
      // Truncate this file to fit within total cap
      result.push({
        ...attachment,
        content: attachment.content.slice(0, remaining),
        truncated: true,
        truncatedAt: remaining,
      });
      totalChars += remaining;
      break;
    }
  }

  return { attachments: result, totalChars };
}

// ===== Summarization =====

export async function summarizeAttachments(
  textAttachments: ProcessedTextAttachment[],
  prompt: string
): Promise<string | null> {
  try {
    // Construct summarization prompt
    const attachmentText = textAttachments
      .map((a) => `File: ${a.filename}\n${a.content}`)
      .join("\n\n---\n\n");

    const summarizationPrompt = `The user submitted this prompt:
"${prompt}"

They also attached ${textAttachments.length} file(s). Provide a concise bullet summary of the attachments:
- Key content/data from each file
- Important errors, warnings, or issues
- File names and types

Keep summary under 250 tokens.

Attachments:
${attachmentText}`;

    // Use a cheap model for summarization (gpt-5-mini)
    const response = await routeToProvider("gpt-5-mini", {
      prompt: summarizationPrompt,
      temperature: 0.0,
      maxTokens: 250,
    });

    if (!response.text) {
      console.error("Summarization failed: no text returned");
      return null;
    }

    return response.text;
  } catch (error) {
    console.error("Summarization error:", error);
    return null;
  }
}

// ===== Main Processing =====

export async function processAttachments(
  files: File[],
  prompt: string
): Promise<AttachmentProcessingResult> {
  const errors: string[] = [];
  const textAttachments: ProcessedTextAttachment[] = [];
  const imageAttachments: ProcessedImageAttachment[] = [];

  // Validate file count
  const countValidation = validateFileCount(files.length);
  if (!countValidation.valid) {
    return {
      attachments: [],
      totalTextChars: 0,
      summarized: false,
      errors: [countValidation.error],
      hasImages: false,
      hasTextFiles: false,
      attachmentNames: [],
      attachmentTypes: [],
      imageCount: 0,
      textFileCount: 0,
    };
  }

  // Process each file
  for (const file of files) {
    const typeValidation = validateFileType(file.name, file.type, file.size);
    if (!typeValidation.valid) {
      errors.push(typeValidation.error);
      continue;
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
    );

    if (isImage) {
      // Process image
      const buffer = Buffer.from(await file.arrayBuffer());
      imageAttachments.push({
        type: "image",
        filename: file.name,
        mimeType: file.type,
        originalSize: file.size,
        data: buffer,
        resized: false, // Resizing will be done separately
      });
    } else {
      // Process text file
      const text = await file.text();
      const processed = truncateTextFile(text, file.name);
      textAttachments.push(processed);
    }
  }

  // Validate image count
  const imageCountValidation = validateImageCount(imageAttachments.length);
  if (!imageCountValidation.valid) {
    errors.push(imageCountValidation.error);
  }

  // Apply total text cap
  const { attachments: cappedTextAttachments, totalChars } =
    truncateTextAttachmentsToTotalCap(textAttachments);

  // Check if summarization is needed
  let summarized = false;
  let summary: string | undefined;

  if (totalChars > LIMITS.SUMMARIZATION_THRESHOLD) {
    // Attempt to summarize
    const summaryResult = await summarizeAttachments(
      cappedTextAttachments,
      prompt
    );
    if (summaryResult) {
      summarized = true;
      summary = summaryResult;
    }
  }

  // Combine text and image attachments
  const allAttachments: ProcessedAttachment[] = [
    ...cappedTextAttachments,
    ...imageAttachments,
  ];

  // Extract metadata for routing
  const attachmentNames = allAttachments.map((a) => a.filename);
  const attachmentTypes = allAttachments.map((a) =>
    a.type === "image" ? a.mimeType : `text${a.extension}`
  );

  return {
    attachments: allAttachments,
    totalTextChars: totalChars,
    summarized,
    summary,
    errors,
    hasImages: imageAttachments.length > 0,
    hasTextFiles: cappedTextAttachments.length > 0,
    attachmentNames,
    attachmentTypes,
    imageCount: imageAttachments.length,
    textFileCount: cappedTextAttachments.length,
  };
}

// ===== Prompt Construction =====

export function buildAttachmentsSection(
  result: AttachmentProcessingResult,
  userPrompt: string
): string {
  if (result.attachments.length === 0) {
    return "";
  }

  const parts: string[] = ["\n\n--- ATTACHMENTS ---"];

  // List all attachments at the top
  const allNames = result.attachmentNames.join(", ");
  parts.push(`\nAttached files: ${allNames}`);

  // Add image-specific context if images are present
  const imageAttachments = result.attachments.filter(
    (a) => a.type === "image"
  ) as ProcessedImageAttachment[];
  if (imageAttachments.length > 0) {
    parts.push(
      `\n⚠️ IMPORTANT: ${imageAttachments.length} image(s) attached. These images contain visual content that must be analyzed.`
    );
    imageAttachments.forEach((img) => {
      parts.push(`  - ${img.filename} (${img.mimeType})`);
    });
  }

  if (result.summarized && result.summary) {
    parts.push("\nText Attachment Summary (files were large):");
    parts.push(result.summary);
    parts.push(
      "\n(Full attachment text truncated. Ask if you need specific details.)"
    );
  } else {
    // Include text attachments directly
    const textAttachments = result.attachments.filter(
      (a) => a.type === "text"
    ) as ProcessedTextAttachment[];

    for (const attachment of textAttachments) {
      parts.push(
        `\nText Attachment: ${attachment.filename} (${attachment.extension})`
      );
      if (attachment.truncated) {
        parts.push(
          `[Truncated: showing first ${attachment.truncatedAt} characters]`
        );
      }
      parts.push(attachment.content);
      parts.push("");
    }
  }

  // Add strict instructions for attachment handling
  parts.push("\n--- INSTRUCTIONS FOR USING ATTACHMENTS ---");
  parts.push(
    "1. Use the attachment(s) as the PRIMARY source of truth. Do not invent or guess content."
  );
  if (imageAttachments.length > 0) {
    parts.push(
      "2. For image attachments: READ the visual content carefully. If it contains code, identify the programming language from syntax before explaining."
    );
    parts.push(
      "3. If an image is missing, unreadable, or ambiguous, explicitly state this and ask for clarification."
    );
  }
  parts.push(
    "4. Do not make assumptions about content that is not visible in the attachments."
  );
  parts.push("");

  // Add user's task
  parts.push("--- USER'S REQUEST ---");
  parts.push(userPrompt);
  parts.push("");

  return parts.join("\n");
}
