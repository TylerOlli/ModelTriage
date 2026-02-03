/**
 * LLM router - routes model IDs to their provider implementations
 */

import type { ModelId, LLMRequest, LLMResponse } from "./types";
import { runOpenAI } from "./providers/openai";

export async function routeToProvider(
  modelId: ModelId,
  request: LLMRequest
): Promise<LLMResponse> {
  switch (modelId) {
    case "gpt-5-mini":
      return runOpenAI(request);

    default:
      throw new Error(
        `Unsupported model: ${modelId}. Only "gpt-5-mini" is currently supported.`
      );
  }
}
