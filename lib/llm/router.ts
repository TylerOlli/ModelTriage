/**
 * LLM router - routes model IDs to their provider implementations
 */

import type { ModelId, LLMRequest, LLMResponse } from "./types";
import { runOpenAI } from "./providers/openai";
import { runAnthropic } from "./providers/anthropic";
import { runGemini } from "./providers/gemini";

export async function routeToProvider(
  modelId: ModelId,
  request: LLMRequest
): Promise<LLMResponse> {
  switch (modelId) {
    case "gpt-5-mini":
    case "gpt-5.2":
      return runOpenAI(request, modelId);

    case "claude-opus-4-6":
    case "claude-sonnet-4-5-20250929":
    case "claude-haiku-4-5-20251001":
      return runAnthropic(request, modelId);

    case "gemini-2.5-flash":
    case "gemini-2.5-pro":
      return runGemini(request, modelId);

    default:
      throw new Error(
        `Unsupported model: ${modelId}. Supported models: gpt-5-mini, gpt-5.2, claude-opus-4-6, claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001, gemini-2.5-flash, gemini-2.5-pro`
      );
  }
}
