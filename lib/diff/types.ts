/**
 * Types for diff summary
 */

export interface ModelResponse {
  model: string;
  content: string;
}

export interface ModelDifferences {
  model: string;
  points: string[];
}

export interface DiffSummary {
  commonGround: string[];
  keyDifferences: ModelDifferences[];
  notableGaps: string[];
}
