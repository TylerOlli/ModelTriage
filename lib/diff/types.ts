/**
 * Types for diff summary
 *
 * Used by the DiffAnalyzer to produce structured comparison
 * summaries between model responses. The verdict field identifies
 * which model performed best and is stored in the database
 * for future calibration.
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
  /** One-sentence verdict: which model performed best and why. */
  verdict: string | null;
}
