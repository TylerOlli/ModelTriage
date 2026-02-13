/**
 * Model Capability Matrix
 *
 * Defines numeric capability scores (0–1) for every supported model
 * across 8 dimensions. These scores are calibrated against benchmarks
 * and real-world performance observations.
 *
 * Each score represents a relative capability within the model lineup.
 * The scoring engine uses these to compute Expected Success.
 */

import type { ModelId } from "./types";
import type { ModelProfile, TaskWeightProfile, TaskType } from "./scoring-types";

// ─── Model Profiles ─────────────────────────────────────────────

export const MODEL_PROFILES: Record<ModelId, ModelProfile> = {
  "gpt-5-mini": {
    id: "gpt-5-mini",
    displayName: "GPT-5 Mini",
    provider: "OpenAI",
    capabilities: {
      reasoning: 0.65,
      codeGeneration: 0.70,
      debugging: 0.60,
      structuredOutput: 0.75,
      instructionFollowing: 0.80,
      speed: 0.95,
      costEfficiency: 0.95,
      recencyStrength: 0.80,
    },
  },

  "gpt-5.2": {
    id: "gpt-5.2",
    displayName: "GPT-5.2",
    provider: "OpenAI",
    capabilities: {
      reasoning: 0.95,
      codeGeneration: 0.88,
      debugging: 0.92,
      structuredOutput: 0.85,
      instructionFollowing: 0.88,
      speed: 0.50,
      costEfficiency: 0.35,
      recencyStrength: 0.85,
    },
  },

  "claude-opus-4-5-20251101": {
    id: "claude-opus-4-5-20251101",
    displayName: "Claude Opus 4.5",
    provider: "Anthropic",
    capabilities: {
      reasoning: 0.92,
      codeGeneration: 0.85,
      debugging: 0.85,
      structuredOutput: 0.80,
      instructionFollowing: 0.92,
      speed: 0.40,
      costEfficiency: 0.25,
      recencyStrength: 0.78,
    },
  },

  "claude-sonnet-4-5-20250929": {
    id: "claude-sonnet-4-5-20250929",
    displayName: "Claude Sonnet 4.5",
    provider: "Anthropic",
    capabilities: {
      reasoning: 0.82,
      codeGeneration: 0.90,
      debugging: 0.80,
      structuredOutput: 0.82,
      instructionFollowing: 0.90,
      speed: 0.75,
      costEfficiency: 0.65,
      recencyStrength: 0.78,
    },
  },

  "claude-haiku-4-5-20251001": {
    id: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    provider: "Anthropic",
    capabilities: {
      reasoning: 0.55,
      codeGeneration: 0.60,
      debugging: 0.50,
      structuredOutput: 0.70,
      instructionFollowing: 0.82,
      speed: 0.95,
      costEfficiency: 0.92,
      recencyStrength: 0.75,
    },
  },

  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "Google",
    capabilities: {
      reasoning: 0.62,
      codeGeneration: 0.68,
      debugging: 0.58,
      structuredOutput: 0.72,
      instructionFollowing: 0.75,
      speed: 0.92,
      costEfficiency: 0.90,
      recencyStrength: 0.82,
    },
  },

  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "Google",
    capabilities: {
      reasoning: 0.80,
      codeGeneration: 0.78,
      debugging: 0.75,
      structuredOutput: 0.78,
      instructionFollowing: 0.82,
      speed: 0.65,
      costEfficiency: 0.55,
      recencyStrength: 0.88,
    },
  },
};

// ─── Task Weight Profiles ───────────────────────────────────────
// How important each capability is for a given task type.
// Weights are 0–1 and represent relative importance (not required to sum to 1).

export const TASK_WEIGHTS: Record<TaskType, TaskWeightProfile> = {
  code_gen: {
    reasoning: 0.20,
    codeGeneration: 0.35,
    debugging: 0.05,
    structuredOutput: 0.15,
    instructionFollowing: 0.15,
    speed: 0.05,
    costEfficiency: 0.03,
    recencyStrength: 0.02,
  },

  debug: {
    reasoning: 0.30,
    codeGeneration: 0.10,
    debugging: 0.35,
    structuredOutput: 0.05,
    instructionFollowing: 0.10,
    speed: 0.05,
    costEfficiency: 0.03,
    recencyStrength: 0.02,
  },

  refactor: {
    reasoning: 0.25,
    codeGeneration: 0.25,
    debugging: 0.10,
    structuredOutput: 0.10,
    instructionFollowing: 0.20,
    speed: 0.05,
    costEfficiency: 0.03,
    recencyStrength: 0.02,
  },

  explain: {
    reasoning: 0.30,
    codeGeneration: 0.05,
    debugging: 0.05,
    structuredOutput: 0.10,
    instructionFollowing: 0.25,
    speed: 0.10,
    costEfficiency: 0.10,
    recencyStrength: 0.05,
  },

  research: {
    reasoning: 0.35,
    codeGeneration: 0.05,
    debugging: 0.05,
    structuredOutput: 0.10,
    instructionFollowing: 0.15,
    speed: 0.05,
    costEfficiency: 0.05,
    recencyStrength: 0.20,
  },

  creative: {
    reasoning: 0.15,
    codeGeneration: 0.05,
    debugging: 0.02,
    structuredOutput: 0.08,
    instructionFollowing: 0.30,
    speed: 0.15,
    costEfficiency: 0.15,
    recencyStrength: 0.10,
  },

  general: {
    reasoning: 0.20,
    codeGeneration: 0.10,
    debugging: 0.05,
    structuredOutput: 0.10,
    instructionFollowing: 0.20,
    speed: 0.15,
    costEfficiency: 0.15,
    recencyStrength: 0.05,
  },
};

// ─── Helpers ────────────────────────────────────────────────────

export function getModelProfile(modelId: ModelId): ModelProfile {
  return MODEL_PROFILES[modelId];
}

export function getAllModelIds(): ModelId[] {
  return Object.keys(MODEL_PROFILES) as ModelId[];
}

/**
 * Human-readable capability labels for UI display
 */
export const CAPABILITY_LABELS: Record<keyof import("./scoring-types").ModelCapabilityScores, string> = {
  reasoning: "Reasoning",
  codeGeneration: "Code Generation",
  debugging: "Debugging",
  structuredOutput: "Structured Output",
  instructionFollowing: "Instruction Following",
  speed: "Speed",
  costEfficiency: "Cost Efficiency",
  recencyStrength: "Knowledge Recency",
};
