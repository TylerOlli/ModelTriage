/**
 * Provider interface for LLM providers
 */

export interface ProviderConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface StreamMetadata {
  model: string;
  provider: string;
  latency?: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  estimatedCost?: number;
}

export interface ProviderResponse {
  chunks: AsyncIterable<StreamChunk>;
  metadata: Promise<StreamMetadata>;
}

export interface Provider {
  name: string;
  stream(prompt: string, config?: ProviderConfig): ProviderResponse;
}
