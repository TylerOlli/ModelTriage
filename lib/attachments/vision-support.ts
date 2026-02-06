/**
 * Vision capability detection and model selection for LLM models
 */

import type { ModelId } from "../llm/types";

/**
 * Model capability metadata
 */
export interface ModelCapability {
  vision: boolean;
  tier: "fast" | "balanced" | "deep";
  strengths: ("coding" | "writing" | "vision" | "reasoning")[];
  costTier: "low" | "medium" | "high";
}

/**
 * Model capabilities configuration
 */
export const MODEL_CAPABILITIES: Record<ModelId, ModelCapability> = {
  "gpt-5-mini": {
    vision: false,
    tier: "fast",
    strengths: ["coding", "writing"],
    costTier: "low",
  },
  "gpt-5.2": {
    vision: true,
    tier: "deep",
    strengths: ["reasoning", "coding", "vision"],
    costTier: "high",
  },
  "claude-haiku-4-5-20251001": {
    vision: false,
    tier: "fast",
    strengths: ["writing", "coding"],
    costTier: "low",
  },
  "claude-sonnet-4-5-20250929": {
    vision: true,
    tier: "balanced",
    strengths: ["coding", "writing", "vision"],
    costTier: "medium",
  },
  "claude-opus-4-5-20251101": {
    vision: true,
    tier: "deep",
    strengths: ["reasoning", "writing", "vision", "coding"],
    costTier: "high",
  },
  "gemini-2.5-flash": {
    vision: true,
    tier: "fast",
    strengths: ["vision", "coding"],
    costTier: "low",
  },
  "gemini-2.5-pro": {
    vision: true,
    tier: "balanced",
    strengths: ["vision", "coding", "reasoning"],
    costTier: "medium",
  },
};

/**
 * Default model selections for different use cases
 */
export const MODEL_DEFAULTS = {
  visionPrimary: "gemini-2.5-pro" as ModelId, // Best for screenshots/images
  visionFast: "gemini-2.5-flash" as ModelId, // Quick image analysis
  codePrimary: "claude-sonnet-4-5-20250929" as ModelId, // Best for code/text
  codeFast: "gpt-5-mini" as ModelId, // Quick code questions
  deepReasoningA: "gpt-5.2" as ModelId, // Deep reasoning primary
  deepReasoningB: "claude-opus-4-5-20251101" as ModelId, // Deep reasoning secondary
};

/**
 * Models that support vision (image) inputs
 */
export const VISION_CAPABLE_MODELS: ModelId[] = Object.entries(MODEL_CAPABILITIES)
  .filter(([_, cap]) => cap.vision)
  .map(([id, _]) => id as ModelId);

/**
 * Check if a model supports vision inputs
 */
export function supportsVision(modelId: string): boolean {
  const capability = MODEL_CAPABILITIES[modelId as ModelId];
  return capability?.vision ?? false;
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
 * Get default model for vision requests
 */
export function getDefaultVisionModel(lightweight: boolean = false): ModelId {
  return lightweight ? MODEL_DEFAULTS.visionFast : MODEL_DEFAULTS.visionPrimary;
}

/**
 * Get default model for code/text requests
 */
export function getDefaultCodeModel(lightweight: boolean = false): ModelId {
  return lightweight ? MODEL_DEFAULTS.codeFast : MODEL_DEFAULTS.codePrimary;
}

/**
 * Get default models for Verify mode based on request type
 */
export function getVerifyModeDefaults(hasImages: boolean): ModelId[] {
  if (hasImages) {
    // Vision: Gemini Pro + deep reasoning for second opinion
    return [MODEL_DEFAULTS.visionPrimary, MODEL_DEFAULTS.deepReasoningA];
  } else {
    // Code/text: Sonnet + GPT-5.2
    return [MODEL_DEFAULTS.codePrimary, MODEL_DEFAULTS.deepReasoningA];
  }
}
