/**
 * Tests for attachment processing with token/cost guardrails
 */

import {
  validateFileCount,
  validateFileType,
  validateImageCount,
  truncateTextFile,
  truncateTextAttachmentsToTotalCap,
  LIMITS,
} from "../../lib/attachments/processor";

describe("Attachment validation", () => {
  describe("validateFileCount", () => {
    it("should accept 1-3 files", () => {
      expect(validateFileCount(1).valid).toBe(true);
      expect(validateFileCount(2).valid).toBe(true);
      expect(validateFileCount(3).valid).toBe(true);
    });

    it("should reject 0 files", () => {
      const result = validateFileCount(0);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("No files");
      }
    });

    it("should reject more than 3 files", () => {
      const result = validateFileCount(4);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Too many files");
        expect(result.error).toContain("3");
      }
    });
  });

  describe("validateFileType", () => {
    it("should accept supported text files", () => {
      expect(validateFileType("test.txt", "text/plain", 1000).valid).toBe(
        true
      );
      expect(validateFileType("error.log", "text/plain", 1000).valid).toBe(
        true
      );
      expect(validateFileType("data.json", "application/json", 1000).valid).toBe(
        true
      );
      expect(validateFileType("readme.md", "text/markdown", 1000).valid).toBe(
        true
      );
      expect(validateFileType("index.ts", "text/typescript", 1000).valid).toBe(
        true
      );
    });

    it("should accept any text-based code files (denylist approach)", () => {
      expect(validateFileType("script.py", "text/plain", 1000).valid).toBe(true);
      expect(validateFileType("main.go", "text/plain", 1000).valid).toBe(true);
      expect(validateFileType("lib.rs", "text/plain", 1000).valid).toBe(true);
      expect(validateFileType("style.css", "text/css", 1000).valid).toBe(true);
      expect(validateFileType("component.vue", "text/plain", 1000).valid).toBe(true);
      expect(validateFileType("config.toml", "text/plain", 1000).valid).toBe(true);
    });

    it("should accept supported image files", () => {
      expect(validateFileType("image.png", "image/png", 1000).valid).toBe(true);
      expect(validateFileType("photo.jpg", "image/jpeg", 1000).valid).toBe(
        true
      );
      expect(validateFileType("graphic.webp", "image/webp", 1000).valid).toBe(
        true
      );
      expect(validateFileType("icon.gif", "image/gif", 1000).valid).toBe(true);
      expect(validateFileType("logo.svg", "image/svg+xml", 1000).valid).toBe(true);
    });

    it("should reject blocked file types (denylist)", () => {
      // Archives
      const zipResult = validateFileType("file.zip", "application/zip", 1000);
      expect(zipResult.valid).toBe(false);
      if (!zipResult.valid) {
        expect(zipResult.error).toContain("Archive");
      }

      // Media
      const mp4Result = validateFileType("video.mp4", "video/mp4", 1000);
      expect(mp4Result.valid).toBe(false);
      if (!mp4Result.valid) {
        expect(mp4Result.error).toContain("Media");
      }

      // Executables
      const exeResult = validateFileType("app.exe", "application/x-msdownload", 1000);
      expect(exeResult.valid).toBe(false);
      if (!exeResult.valid) {
        expect(exeResult.error).toContain("Executable");
      }

      // Documents
      const pdfResult = validateFileType("doc.pdf", "application/pdf", 1000);
      expect(pdfResult.valid).toBe(false);
      if (!pdfResult.valid) {
        expect(pdfResult.error).toContain("Document");
      }
    });

    it("should reject files without clear extensions", () => {
      const result = validateFileType("file", "application/octet-stream", 1000);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("without clear extensions");
      }
    });

    it("should reject oversized text files", () => {
      const result = validateFileType(
        "large.txt",
        "text/plain",
        LIMITS.MAX_TEXT_SIZE_BYTES + 1
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("too large");
        expect(result.error).toContain("2MB");
      }
    });

    it("should reject oversized image files", () => {
      const result = validateFileType(
        "large.png",
        "image/png",
        LIMITS.MAX_IMAGE_SIZE_BYTES + 1
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("too large");
        expect(result.error).toContain("5MB");
      }
    });
  });

  describe("validateImageCount", () => {
    it("should accept 0-2 images", () => {
      expect(validateImageCount(0).valid).toBe(true);
      expect(validateImageCount(1).valid).toBe(true);
      expect(validateImageCount(2).valid).toBe(true);
    });

    it("should reject more than 2 images", () => {
      const result = validateImageCount(3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Too many images");
        expect(result.error).toContain("2");
      }
    });
  });
});

describe("Text truncation", () => {
  describe("truncateTextFile", () => {
    it("should not truncate short files", () => {
      const content = "Short content";
      const result = truncateTextFile(content, "test.txt");
      
      expect(result.content).toBe(content);
      expect(result.truncated).toBe(false);
      expect(result.truncatedAt).toBeUndefined();
    });

    it("should truncate files exceeding MAX_CHARS_PER_TEXT_FILE", () => {
      const longContent = "x".repeat(LIMITS.MAX_CHARS_PER_TEXT_FILE + 1000);
      const result = truncateTextFile(longContent, "large.txt");
      
      expect(result.content.length).toBe(LIMITS.MAX_CHARS_PER_TEXT_FILE);
      expect(result.truncated).toBe(true);
      expect(result.truncatedAt).toBe(LIMITS.MAX_CHARS_PER_TEXT_FILE);
    });

    it("should preserve file metadata", () => {
      const content = "Test content";
      const result = truncateTextFile(content, "test.log");
      
      expect(result.type).toBe("text");
      expect(result.filename).toBe("test.log");
      expect(result.extension).toBe(".log");
    });
  });

  describe("truncateTextAttachmentsToTotalCap", () => {
    it("should not truncate when total is under cap", () => {
      const attachments = [
        truncateTextFile("Content 1", "file1.txt"),
        truncateTextFile("Content 2", "file2.txt"),
      ];
      
      const result = truncateTextAttachmentsToTotalCap(attachments);
      
      expect(result.attachments.length).toBe(2);
      expect(result.attachments[0].content).toBe("Content 1");
      expect(result.attachments[1].content).toBe("Content 2");
      expect(result.totalChars).toBeLessThan(LIMITS.MAX_CHARS_TOTAL);
    });

    it("should enforce total character cap across files", () => {
      const attachments = [
        truncateTextFile("x".repeat(20000), "file1.txt"),
        truncateTextFile("y".repeat(20000), "file2.txt"),
      ];
      
      const result = truncateTextAttachmentsToTotalCap(attachments);
      
      expect(result.totalChars).toBeLessThanOrEqual(LIMITS.MAX_CHARS_TOTAL);
      expect(result.attachments.some((a) => a.truncated)).toBe(true);
    });

    it("should truncate last file to fit within total cap", () => {
      const attachments = [
        truncateTextFile("x".repeat(30000), "file1.txt"),
        truncateTextFile("y".repeat(10000), "file2.txt"),
      ];
      
      const result = truncateTextAttachmentsToTotalCap(attachments);
      
      expect(result.totalChars).toBe(LIMITS.MAX_CHARS_TOTAL);
      expect(result.attachments[1].truncated).toBe(true);
    });

    it("should drop files that don't fit within cap", () => {
      const attachments = [
        truncateTextFile("x".repeat(LIMITS.MAX_CHARS_TOTAL), "file1.txt"),
        truncateTextFile("y".repeat(1000), "file2.txt"),
        truncateTextFile("z".repeat(1000), "file3.txt"),
      ];
      
      const result = truncateTextAttachmentsToTotalCap(attachments);
      
      // Only first file should be included (up to cap)
      expect(result.attachments.length).toBe(1);
      expect(result.totalChars).toBe(LIMITS.MAX_CHARS_TOTAL);
    });
  });
});

describe("Limits constants", () => {
  it("should have sensible limits", () => {
    expect(LIMITS.MAX_FILES).toBe(3);
    expect(LIMITS.MAX_IMAGES).toBe(2);
    expect(LIMITS.MAX_TEXT_SIZE_BYTES).toBe(2 * 1024 * 1024);
    expect(LIMITS.MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(LIMITS.MAX_CHARS_PER_TEXT_FILE).toBe(20000);
    expect(LIMITS.MAX_CHARS_TOTAL).toBe(35000);
    expect(LIMITS.SUMMARIZATION_THRESHOLD).toBe(12000);
  });

  it("total cap should be greater than per-file cap", () => {
    expect(LIMITS.MAX_CHARS_TOTAL).toBeGreaterThan(
      LIMITS.MAX_CHARS_PER_TEXT_FILE
    );
  });

  it("summarization threshold should be less than total cap", () => {
    expect(LIMITS.SUMMARIZATION_THRESHOLD).toBeLessThan(
      LIMITS.MAX_CHARS_TOTAL
    );
  });
});
