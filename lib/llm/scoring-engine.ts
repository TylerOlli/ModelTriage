/**
 * Expected Success Scoring Engine
 *
 * Computes an Expected Success score (0–100) for each model given
 * a prompt classification. Uses weighted capability matching,
 * mismatch penalties, and bonus adjustments.
 *
 * Also determines Confidence level and selects the top Key Factors
 * for transparency display.
 */

import type { ModelId } from "./types";
import type {
  PromptClassification,
  ScoringResult,
  KeyFactor,
  ConfidenceLevel,
  ModelCapabilityScores,
} from "./scoring-types";
import {
  MODEL_PROFILES,
  TASK_WEIGHTS,
  CAPABILITY_LABELS,
  getAllModelIds,
} from "./capability-matrix";
import { classifyPrompt } from "./prompt-classifier";

// ─── Score Calculation ──────────────────────────────────────────

interface ModelScore {
  modelId: ModelId;
  rawScore: number;
  adjustedScore: number;
  dimensionScores: Record<string, { weighted: number; raw: number; weight: number }>;
}

/**
 * Compute raw Expected Success for a single model against a classification.
 */
function computeModelScore(
  modelId: ModelId,
  classification: PromptClassification
): ModelScore {
  const profile = MODEL_PROFILES[modelId];
  const weights = TASK_WEIGHTS[classification.taskType];
  const caps = profile.capabilities;

  // Compute weighted sum of capability * weight
  const dimensions: Record<string, { weighted: number; raw: number; weight: number }> = {};
  let totalWeight = 0;
  let weightedSum = 0;

  const entries: [keyof ModelCapabilityScores, number][] = [
    ["reasoning", weights.reasoning],
    ["codeGeneration", weights.codeGeneration],
    ["debugging", weights.debugging],
    ["structuredOutput", weights.structuredOutput],
    ["instructionFollowing", weights.instructionFollowing],
    ["speed", weights.speed],
    ["costEfficiency", weights.costEfficiency],
    ["recencyStrength", weights.recencyStrength],
  ];

  for (const [key, weight] of entries) {
    const raw = caps[key];
    const weighted = raw * weight;
    dimensions[key] = { weighted, raw, weight };
    weightedSum += weighted;
    totalWeight += weight;
  }

  // Base score: weighted average scaled to 0–100
  let rawScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 50;

  // ── Signal-based adjustments ────────────────────────────────
  // Larger magnitudes than v1 to create meaningful separation
  // between models when specific signals are present.
  let adjustedScore = rawScore;

  // Bonus: code signals align with code-strong models
  if (classification.inputSignals.hasCode && caps.codeGeneration >= 0.75) {
    adjustedScore += 5;
  }

  // Bonus: stack trace + strong debugging
  if (classification.inputSignals.hasStackTrace && caps.debugging >= 0.7) {
    adjustedScore += 6;
  }

  // Bonus: strict format needs + strong structured output
  if (classification.inputSignals.strictFormat && caps.structuredOutput >= 0.75) {
    adjustedScore += 5;
  }

  // Bonus: recency requirement + strong recency
  if (classification.recencyRequirement && caps.recencyStrength >= 0.8) {
    adjustedScore += 5;
  }

  // Penalty: high stakes with weak reasoning
  if (classification.stakes === "high" && caps.reasoning < 0.7) {
    adjustedScore -= 12;
  }

  // Penalty: medium stakes with weak reasoning
  if (classification.stakes === "medium" && caps.reasoning < 0.6) {
    adjustedScore -= 6;
  }

  // Penalty: recency needed but model is stale
  if (classification.recencyRequirement && caps.recencyStrength < 0.7) {
    adjustedScore -= 8;
  }

  // Penalty: code task with weak code generation
  if (
    (classification.taskType === "code_gen" || classification.taskType === "debug") &&
    caps.codeGeneration < 0.6
  ) {
    adjustedScore -= 8;
  }

  // Penalty: concise request penalizes slow/expensive models
  if (classification.inputSignals.concise && caps.speed < 0.5) {
    adjustedScore -= 5;
  }

  // Bonus: concise request rewards fast models
  if (classification.inputSignals.concise && caps.speed >= 0.85) {
    adjustedScore += 4;
  }

  // Bonus: long-form request rewards strong reasoning + instruction following
  // Complex prompts benefit from premium models that can handle nuance.
  if (classification.inputSignals.longForm && caps.reasoning >= 0.75) {
    adjustedScore += 6;
  }
  if (classification.inputSignals.longForm && caps.instructionFollowing >= 0.85) {
    adjustedScore += 3;
  }

  // Penalty: long-form request with weak reasoning (budget models shouldn't handle complex tasks)
  if (classification.inputSignals.longForm && caps.reasoning < 0.55) {
    adjustedScore -= 6;
  }

  // Clamp 0–100
  adjustedScore = Math.max(0, Math.min(100, Math.round(adjustedScore)));

  return {
    modelId,
    rawScore,
    adjustedScore,
    dimensionScores: dimensions,
  };
}

// ─── Confidence Calculation ─────────────────────────────────────

function computeConfidence(
  topScore: number,
  secondScore: number,
  classification: PromptClassification
): ConfidenceLevel {
  const gap = topScore - secondScore;
  const classifierConf = classification.classifierConfidence;

  // Three signals: score gap, classifier confidence, alignment strength
  let confidencePoints = 0;

  // Score gap contribution (0–3 points)
  // With wider model differentiation, gaps of 5+ are now common.
  if (gap >= 12) confidencePoints += 3;
  else if (gap >= 6) confidencePoints += 2;
  else if (gap >= 3) confidencePoints += 1;

  // Classifier confidence contribution (0–2 points)
  if (classifierConf === "high") confidencePoints += 2;
  else if (classifierConf === "medium") confidencePoints += 1;

  // Absolute score contribution (0–1 point)
  if (topScore >= 70) confidencePoints += 1;

  // Map to confidence level
  // Lowered from 5/3 to 4/2 — the old thresholds were nearly unreachable
  if (confidencePoints >= 4) return "High";
  if (confidencePoints >= 2) return "Medium";
  return "Low";
}

// ─── Key Factor Selection ───────────────────────────────────────

function selectKeyFactors(
  modelScore: ModelScore,
  classification: PromptClassification
): KeyFactor[] {
  const dimensions = modelScore.dimensionScores;

  // Build factor candidates with human-readable labels and scores
  const candidates: Array<{
    key: string;
    label: string;
    score: number;
    weight: number;
    reason: string;
  }> = [];

  const reasonTemplates: Record<string, (score: number) => string> = {
    reasoning: (s) =>
      s >= 80 ? "Excels at complex logic" : s >= 60 ? "Solid logical reasoning" : "Basic reasoning capability",
    codeGeneration: (s) =>
      s >= 80 ? "Top-tier code output" : s >= 60 ? "Reliable code generation" : "Adequate code support",
    debugging: (s) =>
      s >= 80 ? "Expert error diagnosis" : s >= 60 ? "Good error tracing" : "Basic debugging support",
    structuredOutput: (s) =>
      s >= 80 ? "Precise format control" : s >= 60 ? "Good format adherence" : "Basic format support",
    instructionFollowing: (s) =>
      s >= 80 ? "Follows instructions closely" : s >= 60 ? "Reliable instruction adherence" : "May need guidance",
    speed: (s) =>
      s >= 80 ? "Very fast response time" : s >= 60 ? "Reasonable response speed" : "Slower, more thorough",
    costEfficiency: (s) =>
      s >= 80 ? "Highly cost-effective" : s >= 60 ? "Good value for quality" : "Premium quality, higher cost",
    recencyStrength: (s) =>
      s >= 80 ? "Up-to-date knowledge" : s >= 60 ? "Fairly current training" : "May lack recent info",
  };

  for (const [key, { raw, weight }] of Object.entries(dimensions)) {
    if (weight < 0.05) continue; // Skip negligible dimensions

    const score100 = Math.round(raw * 100);
    const label = CAPABILITY_LABELS[key as keyof ModelCapabilityScores] || key;
    const reasonFn = reasonTemplates[key];
    const reason = reasonFn ? reasonFn(score100) : "Relevant capability";

    candidates.push({
      key,
      label,
      score: score100,
      weight,
      reason,
    });
  }

  // Sort by weight (importance to this task) descending, then by score descending
  candidates.sort((a, b) => {
    const weightDiff = b.weight - a.weight;
    if (Math.abs(weightDiff) > 0.01) return weightDiff;
    return b.score - a.score;
  });

  // Take top 3–4 factors
  const factorCount = candidates.length >= 4 ? 4 : Math.min(candidates.length, 3);

  return candidates.slice(0, factorCount).map((c) => ({
    label: c.label,
    score: c.score,
    shortReason: c.reason,
  }));
}

// ─── Short Why Generation ───────────────────────────────────────

function generateShortWhy(
  modelId: ModelId,
  classification: PromptClassification,
  score: number
): string {
  const profile = MODEL_PROFILES[modelId];
  const name = profile.displayName;

  const taskDescriptions: Record<string, string> = {
    code_gen: "code generation",
    debug: "debugging and error analysis",
    refactor: "code review and refactoring",
    explain: "explanations and analysis",
    research: "deep research and reasoning",
    creative: "creative writing and content",
    general: "general-purpose tasks",
  };

  const taskDesc = taskDescriptions[classification.taskType] || "this type of task";

  if (score >= 85) {
    return `${name} is exceptionally well-suited for ${taskDesc}, with strong alignment across all key dimensions.`;
  } else if (score >= 75) {
    return `${name} is a strong match for ${taskDesc}, offering the best balance of capability and efficiency.`;
  } else if (score >= 65) {
    return `${name} is a good fit for ${taskDesc}, with solid capabilities where it matters most.`;
  } else {
    return `${name} is the best available option for ${taskDesc} given the current model lineup.`;
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Score all models for a given prompt and return the best recommendation.
 *
 * This is the main entry point for the scoring system.
 * It is fully deterministic: same prompt → same result.
 */
export function scorePrompt(prompt: string): ScoringResult {
  const classification = classifyPrompt(prompt);
  return scoreWithClassification(prompt, classification);
}

/**
 * Score all models using a pre-computed classification.
 * Useful when the classification has already been done (e.g., by the intent router).
 */
export function scoreWithClassification(
  prompt: string,
  classification: PromptClassification
): ScoringResult {
  const modelIds = getAllModelIds();

  // Score every model
  const scores: ModelScore[] = modelIds.map((id) =>
    computeModelScore(id, classification)
  );

  // Sort by adjusted score descending
  scores.sort((a, b) => b.adjustedScore - a.adjustedScore);

  const best = scores[0];
  const secondBest = scores[1];

  // Compute confidence
  const confidence = computeConfidence(
    best.adjustedScore,
    secondBest?.adjustedScore ?? 0,
    classification
  );

  // Select key factors for the winning model
  const keyFactors = selectKeyFactors(best, classification);

  // Generate short explanation
  const shortWhy = generateShortWhy(
    best.modelId,
    classification,
    best.adjustedScore
  );

  return {
    recommendedModelId: best.modelId,
    expectedSuccess: best.adjustedScore,
    confidence,
    keyFactors,
    shortWhy,
  };
}

/**
 * Score a specific model for a prompt. Used when the model has already been
 * selected (e.g., by the intent router) and we need the scoring metadata.
 */
export function scoreForModel(
  prompt: string,
  modelId: ModelId
): ScoringResult {
  const classification = classifyPrompt(prompt);
  const modelIds = getAllModelIds();

  // Score all models to determine confidence (needs second-best)
  const scores: ModelScore[] = modelIds.map((id) =>
    computeModelScore(id, classification)
  );

  scores.sort((a, b) => b.adjustedScore - a.adjustedScore);

  // Find the specified model's score
  const targetScore = scores.find((s) => s.modelId === modelId) || scores[0];
  const bestScore = scores[0];
  const secondBest = scores[1];

  // Confidence is relative to the actual best model
  const confidence = computeConfidence(
    targetScore.adjustedScore,
    // If this IS the best model, gap is vs second-best
    // If not, the gap is still meaningful for confidence
    targetScore.modelId === bestScore.modelId
      ? secondBest?.adjustedScore ?? 0
      : bestScore.adjustedScore,
    classification
  );

  const keyFactors = selectKeyFactors(targetScore, classification);
  const shortWhy = generateShortWhy(
    targetScore.modelId,
    classification,
    targetScore.adjustedScore,
  );

  return {
    recommendedModelId: targetScore.modelId,
    expectedSuccess: targetScore.adjustedScore,
    confidence,
    keyFactors,
    shortWhy,
  };
}
