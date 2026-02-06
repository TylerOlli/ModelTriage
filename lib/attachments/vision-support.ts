/**
 * Vision capability detection for LLM models
 */

import type { ModelId } from "../llm/types";

/**
 * Models that support vision (image) inputs
 */
export const VISION_CAPABLE_MODELS: ModelId[] = [
  "gpt-5.2", // GPT-5.2 supports vision
  "claude-opus-4-5-20251101", // Claude Opus 4.5 supports vision
  "claude-sonnet-4-5-20250929", // Claude Sonnet 4.5 supports vision
  "gemini-2.5-flash", // Gemini 2.5 Flash supports vision
  "gemini-2.5-pro", // Gemini 2.5 Pro supports vision
];

/**
 * Check if a model supports vision inputs
 */
export function supportsVision(modelId: string): boolean {
  return VISION_CAPABLE_MODELS.includes(modelId as ModelId);
}

/**
 * Check if any of the provided models support vision
 */
export function anyModelSupportsVision(models: string[]): boolean {
  return models.some((m) => supportsVision(m));
}

/**
 * Filter models to only those that support vision
 */
export function filterVisionCapableModels(models: string[]): string[] {
  return models.filter((m) => supportsVision(m));
}

/**
 * Get a default vision-capable model for fallback
 */
export function getDefaultVisionModel(): ModelId {
  return "gemini-2.5-flash"; // Fast and cost-effective for vision
}
