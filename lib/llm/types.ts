/**
 * LLM abstraction types
 */

export type ModelId = "gpt-5-mini";

export interface LLMRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  model: ModelId;
  latencyMs: number;
  error?: string;
}
