/**
 * Expected Success Scoring System — Types
 *
 * "The estimated probability this model will successfully handle this prompt."
 *
 * This module defines the type system for ModelTriage's deterministic
 * scoring engine: prompt classification, model capability matrices,
 * and the Expected Success output format.
 */

import type { ModelId } from "./types";

// ─── Prompt Classification ─────────────────────────────────────

export type TaskType =
  | "code_gen"
  | "debug"
  | "refactor"
  | "explain"
  | "research"
  | "creative"
  | "general";

export type StakesLevel = "low" | "medium" | "high";
export type ClassifierConfidence = "low" | "medium" | "high";

export interface InputSignals {
  hasCode: boolean;
  hasStackTrace: boolean;
  strictFormat: boolean;
  longForm: boolean;
  concise: boolean;
  mentionsLatest: boolean;
}

export interface PromptClassification {
  taskType: TaskType;
  inputSignals: InputSignals;
  stakes: StakesLevel;
  recencyRequirement: boolean;
  classifierConfidence: ClassifierConfidence;
}

// ─── Model Capability Matrix ────────────────────────────────────

export interface ModelCapabilityScores {
  reasoning: number;         // 0–1: Multi-step logic, planning
  codeGeneration: number;    // 0–1: Writing new code
  debugging: number;         // 0–1: Error analysis, root cause
  structuredOutput: number;  // 0–1: JSON, tables, strict formats
  instructionFollowing: number; // 0–1: Adherence to constraints
  speed: number;             // 0–1: Response latency
  costEfficiency: number;    // 0–1: Cost per quality unit
  recencyStrength: number;   // 0–1: Knowledge cutoff freshness
}

export interface ModelProfile {
  id: ModelId;
  displayName: string;
  provider: string;
  capabilities: ModelCapabilityScores;
}

// ─── Scoring Output ─────────────────────────────────────────────

export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface KeyFactor {
  label: string;
  score: number;       // 0–100
  shortReason: string; // 5–8 word phrase
}

export interface ScoringResult {
  recommendedModelId: ModelId;
  expectedSuccess: number;     // 0–100, integer
  confidence: ConfidenceLevel;
  keyFactors: KeyFactor[];     // 3–4 factors
  shortWhy: string;            // One sentence
}

// ─── Task Weight Profile ────────────────────────────────────────
// Maps each task type to weighted importance of each capability dimension

export interface TaskWeightProfile {
  reasoning: number;
  codeGeneration: number;
  debugging: number;
  structuredOutput: number;
  instructionFollowing: number;
  speed: number;
  costEfficiency: number;
  recencyStrength: number;
}
