/**
 * LLM abstraction types
 */

export type ModelId =
  | "gpt-5-mini"
  | "gpt-5.2"
  | "claude-opus-4-5-20251101"
  | "claude-sonnet-4-5-20250929"
  | "claude-haiku-4-5-20251001";

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
