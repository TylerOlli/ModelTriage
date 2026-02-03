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
    case "gpt-5.2":
      return runOpenAI(request, modelId);

    default:
      throw new Error(
        `Unsupported model: ${modelId}. Supported models: gpt-5-mini, gpt-5.2`
      );
  }
}
