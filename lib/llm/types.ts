/**
 * LLM abstraction types
 */

export type ModelId =
  | "gpt-5-mini"
  | "gpt-5.2"
  | "claude-opus-4-6"
  | "claude-sonnet-4-5-20250929"
  | "claude-haiku-4-5-20251001"
  | "gemini-2.5-flash"
  | "gemini-2.5-pro";

export interface ImageAttachment {
  data: Buffer;
  mimeType: string;
  filename: string;
}

export interface LLMRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  images?: ImageAttachment[]; // For vision-capable models
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
