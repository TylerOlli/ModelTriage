/**
 * MockProvider - Deterministic LLM simulator for testing and development
 * No external API calls, same prompt produces same output
 */

import type {
  Provider,
  ProviderConfig,
  ProviderResponse,
  StreamChunk,
  StreamMetadata,
} from "./types";

export class MockProvider implements Provider {
  name = "mock";
  private chunkDelayMs: number;

  constructor(chunkDelayMs = 50) {
    this.chunkDelayMs = chunkDelayMs;
  }

  stream(prompt: string, config?: ProviderConfig): ProviderResponse {
    const startTime = Date.now();
    const model = config?.model || "mock-model-1";

    // Generate deterministic response based on prompt
    const response = this.generateResponse(prompt);
    const chunks = this.splitIntoChunks(response);

    // Create async iterator for streaming
    const streamIterator = this.createStreamIterator(chunks);

    // Create metadata promise that resolves when streaming completes
    const metadata = this.createMetadata(
      model,
      prompt,
      response,
      startTime,
      chunks.length
    );

    return {
      chunks: streamIterator,
      metadata,
    };
  }

  /**
   * Generate deterministic response based on prompt content
   */
  private generateResponse(prompt: string): string {
    const promptLength = prompt.length;
    const hash = this.simpleHash(prompt);

    // Different response templates based on prompt characteristics
    if (prompt.toLowerCase().includes("code")) {
      return `Here's a code example based on your request:\n\n\`\`\`\nfunction example() {\n  return "mock response";\n}\n\`\`\`\n\nThis is a deterministic mock response for prompt hash ${hash}.`;
    } else if (prompt.toLowerCase().includes("list")) {
      return `Here's a list based on your prompt:\n\n1. First item (hash: ${hash})\n2. Second item\n3. Third item\n\nPrompt length: ${promptLength} characters.`;
    } else {
      return `This is a mock LLM response. Your prompt was ${promptLength} characters long with hash ${hash}. This response is deterministic and will be the same for identical prompts.`;
    }
  }

  /**
   * Simple hash function for deterministic output
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Split response into chunks for streaming simulation
   */
  private splitIntoChunks(response: string): string[] {
    const chunks: string[] = [];
    const words = response.split(" ");

    // Group words into chunks (2-4 words per chunk)
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(" ");
      chunks.push(i + 3 < words.length ? chunk + " " : chunk);
    }

    return chunks;
  }

  /**
   * Create async iterator that yields chunks with delays
   */
  private async *createStreamIterator(
    chunks: string[]
  ): AsyncIterable<StreamChunk> {
    for (let i = 0; i < chunks.length; i++) {
      // Simulate network delay
      await this.delay(this.chunkDelayMs);

      yield {
        content: chunks[i],
        done: i === chunks.length - 1,
      };
    }
  }

  /**
   * Create metadata that resolves after streaming
   */
  private async createMetadata(
    model: string,
    prompt: string,
    response: string,
    startTime: number,
    chunkCount: number
  ): Promise<StreamMetadata> {
    // Wait for estimated streaming duration
    await this.delay(this.chunkDelayMs * chunkCount);

    const latency = Date.now() - startTime;
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(response.length / 4);

    return {
      model,
      provider: "mock",
      latency,
      tokenUsage: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
      estimatedCost: 0,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
