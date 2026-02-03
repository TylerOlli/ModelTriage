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
  finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
