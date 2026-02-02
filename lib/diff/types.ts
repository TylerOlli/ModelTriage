/**
 * Types for diff summary
 */

export interface ModelResponse {
  model: string;
  content: string;
}

export interface DiffSummary {
  agreement: string[];
  disagreement: string[];
  omissions: string[];
  conflictingAssumptions: string[];
}
