/**
 * OpenAI provider implementation
 */

import OpenAI from "openai";
import type { LLMRequest, LLMResponse } from "../types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function runOpenAI(request: LLMRequest): Promise<LLMResponse> {
  const startTime = Date.now();

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
      // GPT-5 mini only supports temperature of 1 (default)
      // temperature: request.temperature ?? 1,
      // GPT-5 mini is a reasoning model - needs more tokens for internal reasoning + output
      max_completion_tokens: request.maxTokens ?? 16000,
    });

    const latencyMs = Date.now() - startTime;
    const text = completion.choices[0]?.message?.content || "";

    console.log("OpenAI Full Response:", {
      choices: completion.choices,
      finishReason: completion.choices[0]?.finish_reason,
      refusal: completion.choices[0]?.message?.refusal,
      usage: completion.usage,
    });

    console.log("OpenAI Response:", {
      text: text.substring(0, 100),
      textLength: text.length,
      latencyMs,
      hasChoices: !!completion.choices[0],
      hasMessage: !!completion.choices[0]?.message,
      hasContent: !!completion.choices[0]?.message?.content,
    });

    return {
      text,
      model: "gpt-5-mini",
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
      model: "gpt-5-mini",
      latencyMs,
      error: errorMessage,
    };
  }
}
