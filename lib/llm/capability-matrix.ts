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
  // ── Budget / Fast Tier ────────────────────────────────────────
  // These models trade quality for speed and cost. Quality scores
  // are clearly separated from the premium tier to ensure the
  // scoring engine picks premium models for complex tasks.

  "gpt-5-mini": {
    id: "gpt-5-mini",
    displayName: "GPT-5 Mini",
    provider: "OpenAI",
    capabilities: {
      reasoning: 0.45,         // Basic reasoning, struggles with multi-step
      codeGeneration: 0.55,    // Adequate for simple snippets
      debugging: 0.40,         // Weak at root-cause analysis
      structuredOutput: 0.70,  // Good JSON/format adherence
      instructionFollowing: 0.72, // Follows clear instructions well
      speed: 0.95,             // Very fast
      costEfficiency: 0.95,    // Cheapest option
      recencyStrength: 0.80,   // Recent training data
    },
  },

  "claude-haiku-4-5-20251001": {
    id: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    provider: "Anthropic",
    capabilities: {
      reasoning: 0.42,         // Light reasoning only
      codeGeneration: 0.48,    // Basic code, misses edge cases
      debugging: 0.35,         // Shallow error analysis
      structuredOutput: 0.65,  // Decent format compliance
      instructionFollowing: 0.70, // Generally follows instructions
      speed: 0.95,             // Very fast
      costEfficiency: 0.92,    // Very cheap
      recencyStrength: 0.72,   // Slightly older training
    },
  },

  "gemini-3-flash-preview": {
    id: "gemini-3-flash-preview",
    displayName: "Gemini 3 Flash",
    provider: "Google",
    capabilities: {
      reasoning: 0.48,         // Slightly better than GPT-5 Mini
      codeGeneration: 0.52,    // Adequate for straightforward code
      debugging: 0.42,         // Basic error identification
      structuredOutput: 0.68,  // Good format handling
      instructionFollowing: 0.68, // Sometimes drifts on complex prompts
      speed: 0.92,             // Very fast
      costEfficiency: 0.90,    // Very cheap
      recencyStrength: 0.85,   // Strong recency (Google advantage)
    },
  },

  // ── Mid Tier ──────────────────────────────────────────────────
  // Strong all-rounders. Best balance of quality, speed, and cost.

  "claude-sonnet-4-5-20250929": {
    id: "claude-sonnet-4-5-20250929",
    displayName: "Claude Sonnet 4.5",
    provider: "Anthropic",
    capabilities: {
      reasoning: 0.78,         // Strong reasoning for mid-tier
      codeGeneration: 0.88,    // Excellent code quality
      debugging: 0.75,         // Good error analysis
      structuredOutput: 0.80,  // Reliable format compliance
      instructionFollowing: 0.88, // Follows nuanced instructions
      speed: 0.70,             // Moderate speed
      costEfficiency: 0.55,    // Moderate cost
      recencyStrength: 0.75,   // Decent recency
    },
  },

  "gemini-3-pro-preview": {
    id: "gemini-3-pro-preview",
    displayName: "Gemini 3 Pro",
    provider: "Google",
    capabilities: {
      reasoning: 0.75,         // Strong reasoning
      codeGeneration: 0.72,    // Good code, not as polished as Sonnet
      debugging: 0.68,         // Solid debugging
      structuredOutput: 0.75,  // Good format handling
      instructionFollowing: 0.78, // Follows instructions well
      speed: 0.58,             // Slower than Sonnet
      costEfficiency: 0.45,    // More expensive
      recencyStrength: 0.92,   // Strongest recency (Google advantage)
    },
  },

  // ── Premium Tier ──────────────────────────────────────────────
  // Maximum quality. Reserved for complex, high-stakes tasks.
  // Speed and cost scores are low to prevent selection on trivial prompts.

  "gpt-5.2": {
    id: "gpt-5.2",
    displayName: "GPT-5.2",
    provider: "OpenAI",
    capabilities: {
      reasoning: 0.96,         // Best-in-class reasoning
      codeGeneration: 0.90,    // Excellent code quality
      debugging: 0.92,         // Excellent root-cause analysis
      structuredOutput: 0.85,  // Strong format compliance
      instructionFollowing: 0.88, // Follows complex instructions
      speed: 0.30,             // Slow (reasoning overhead)
      costEfficiency: 0.20,    // Expensive
      recencyStrength: 0.85,   // Good recency
    },
  },

  "claude-opus-4-6": {
    id: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    provider: "Anthropic",
    capabilities: {
      reasoning: 0.94,         // Near-best reasoning
      codeGeneration: 0.85,    // Excellent code quality
      debugging: 0.88,         // Strong debugging
      structuredOutput: 0.82,  // Reliable format compliance
      instructionFollowing: 0.92, // Best instruction following
      speed: 0.25,             // Slowest
      costEfficiency: 0.15,    // Most expensive
      recencyStrength: 0.75,   // Decent recency
    },
  },
};

// ─── Task Weight Profiles ───────────────────────────────────────
// How important each capability is for a given task type.
// Weights are 0–1 and represent relative importance (not required to sum to 1).

export const TASK_WEIGHTS: Record<TaskType, TaskWeightProfile> = {
  code_gen: {
    reasoning: 0.20,
    codeGeneration: 0.40,          // Code quality is paramount
    debugging: 0.05,
    structuredOutput: 0.15,
    instructionFollowing: 0.15,
    speed: 0.03,                   // Reduced — quality over speed for code
    costEfficiency: 0.01,
    recencyStrength: 0.01,
  },

  debug: {
    reasoning: 0.30,
    codeGeneration: 0.08,
    debugging: 0.40,               // Debugging ability is paramount
    structuredOutput: 0.05,
    instructionFollowing: 0.10,
    speed: 0.03,                   // Reduced — accuracy matters more
    costEfficiency: 0.02,
    recencyStrength: 0.02,
  },

  refactor: {
    reasoning: 0.28,
    codeGeneration: 0.28,
    debugging: 0.10,
    structuredOutput: 0.10,
    instructionFollowing: 0.20,
    speed: 0.02,
    costEfficiency: 0.01,
    recencyStrength: 0.01,
  },

  explain: {
    reasoning: 0.35,               // Understanding matters most
    codeGeneration: 0.05,
    debugging: 0.05,
    structuredOutput: 0.10,
    instructionFollowing: 0.25,
    speed: 0.08,
    costEfficiency: 0.07,
    recencyStrength: 0.05,
  },

  research: {
    reasoning: 0.40,               // Deep reasoning is critical
    codeGeneration: 0.03,
    debugging: 0.03,
    structuredOutput: 0.10,
    instructionFollowing: 0.15,
    speed: 0.02,
    costEfficiency: 0.02,
    recencyStrength: 0.25,         // Research often needs current info
  },

  creative: {
    reasoning: 0.15,
    codeGeneration: 0.03,
    debugging: 0.02,
    structuredOutput: 0.08,
    instructionFollowing: 0.35,    // Following creative constraints is key
    speed: 0.12,
    costEfficiency: 0.12,
    recencyStrength: 0.13,
  },

  math: {
    reasoning: 0.50,               // Math demands strong reasoning above all
    codeGeneration: 0.03,
    debugging: 0.02,
    structuredOutput: 0.15,        // Precise formatting of solutions
    instructionFollowing: 0.15,    // Following the specific ask
    speed: 0.05,
    costEfficiency: 0.03,
    recencyStrength: 0.07,
  },

  // QA: Simple factual questions that don't need premium models.
  // Speed and cost are weighted heavily — get the answer fast and cheap.
  qa: {
    reasoning: 0.10,
    codeGeneration: 0.02,
    debugging: 0.02,
    structuredOutput: 0.08,
    instructionFollowing: 0.18,
    speed: 0.28,                   // Fast answers matter for simple questions
    costEfficiency: 0.27,          // No need for expensive models
    recencyStrength: 0.05,
  },

  // General: when the classifier can't confidently categorize,
  // lean toward quality (reasoning + instruction following) rather
  // than speed/cost. Better to over-deliver than pick a cheap model.
  general: {
    reasoning: 0.28,               // Up from 0.20 — favor smarter models
    codeGeneration: 0.10,
    debugging: 0.05,
    structuredOutput: 0.10,
    instructionFollowing: 0.27,    // Up from 0.20 — quality matters
    speed: 0.08,                   // Down from 0.15 — don't favor budget models
    costEfficiency: 0.07,          // Down from 0.15 — same reason
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
