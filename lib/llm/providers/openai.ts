/**
 * OpenAI provider implementation
 */

import OpenAI from "openai";
import type { LLMRequest, LLMResponse, ModelId } from "../types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function runOpenAI(
  request: LLMRequest,
  modelId: ModelId
): Promise<LLMResponse> {
  const startTime = Date.now();

  try {
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
      // GPT-5 models only support temperature of 1 (default)
      // temperature: request.temperature ?? 1,
      // Reasoning models need more tokens for internal reasoning + output
      max_completion_tokens: request.maxTokens ?? 16000,
    });

    const latencyMs = Date.now() - startTime;
    const text = completion.choices[0]?.message?.content || "";

    console.log("OpenAI Full Response:", {
      model: modelId,
      choices: completion.choices,
      finishReason: completion.choices[0]?.finish_reason,
      refusal: completion.choices[0]?.message?.refusal,
      usage: completion.usage,
    });

    console.log("OpenAI Response:", {
      model: modelId,
      text: text.substring(0, 100),
      textLength: text.length,
      latencyMs,
      hasChoices: !!completion.choices[0],
      hasMessage: !!completion.choices[0]?.message,
      hasContent: !!completion.choices[0]?.message?.content,
    });

    return {
      text,
      model: modelId,
      latencyMs,
      finishReason: completion.choices[0]?.finish_reason || undefined,
      tokenUsage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    return {
      text: "",
      model: modelId,
      latencyMs,
      error: errorMessage,
    };
  }
}
