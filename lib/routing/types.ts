/**
 * Types for model routing
 */

export interface RoutingDecision {
  model: string;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface RoutingContext {
  prompt: string;
  promptLength: number;
  requestedModel?: string;
}
