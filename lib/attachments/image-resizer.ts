/**
 * Server-side image resizing and compression
 * Uses sharp for high-quality, fast image processing
 */

import sharp from "sharp";

export const IMAGE_LIMITS = {
  MAX_DIMENSION: 1024,
  JPEG_QUALITY: 80,
  WEBP_QUALITY: 80,
  PNG_COMPRESSION: 7,
} as const;

export interface ResizedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

/**
 * Resize and compress an image to meet token/cost limits
 * - Max dimension: 1024px (maintains aspect ratio)
 * - Reasonable compression based on format
 */
export async function resizeAndCompressImage(
  inputBuffer: Buffer,
  originalMimeType: string
): Promise<ResizedImage> {
  try {
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    // Determine if resizing is needed
    const needsResize =
      originalWidth > IMAGE_LIMITS.MAX_DIMENSION ||
      originalHeight > IMAGE_LIMITS.MAX_DIMENSION;

    let pipeline = image;

    // Resize if needed (maintains aspect ratio)
    if (needsResize) {
      pipeline = pipeline.resize(IMAGE_LIMITS.MAX_DIMENSION, IMAGE_LIMITS.MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Apply format-specific compression
    let outputBuffer: Buffer;
    let outputMimeType: string;

    if (originalMimeType === "image/png") {
      outputBuffer = await pipeline
        .png({ compressionLevel: IMAGE_LIMITS.PNG_COMPRESSION })
        .toBuffer();
      outputMimeType = "image/png";
    } else if (originalMimeType === "image/webp") {
      outputBuffer = await pipeline
        .webp({ quality: IMAGE_LIMITS.WEBP_QUALITY })
        .toBuffer();
      outputMimeType = "image/webp";
    } else {
      // Default to JPEG for jpg/jpeg
      outputBuffer = await pipeline
        .jpeg({ quality: IMAGE_LIMITS.JPEG_QUALITY })
        .toBuffer();
      outputMimeType = "image/jpeg";
    }

    // Get final dimensions
    const finalMetadata = await sharp(outputBuffer).metadata();

    return {
      buffer: outputBuffer,
      mimeType: outputMimeType,
      width: finalMetadata.width || originalWidth,
      height: finalMetadata.height || originalHeight,
      originalSize: inputBuffer.length,
      compressedSize: outputBuffer.length,
    };
  } catch (error) {
    console.error("Image resizing error:", error);
    throw new Error("Failed to process image");
  }
}

/**
 * Convert image buffer to base64 data URL for vision APIs
 */
export function imageToBase64DataURL(
  buffer: Buffer,
  mimeType: string
): string {
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
