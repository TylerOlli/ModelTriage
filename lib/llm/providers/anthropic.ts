/**
 * Anthropic provider implementation
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMRequest, LLMResponse, ModelId } from "../types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function runAnthropic(
  request: LLMRequest,
  modelId: ModelId
): Promise<LLMResponse> {
  const startTime = Date.now();

  try {
    const message = await client.messages.create({
      model: modelId,
      max_tokens: request.maxTokens ?? 16000,
      temperature: request.temperature ?? 1,
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
    });

    const latencyMs = Date.now() - startTime;
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    console.log("Anthropic Full Response:", {
      model: modelId,
      content: message.content,
      stopReason: message.stop_reason,
      usage: message.usage,
    });

    console.log("Anthropic Response:", {
      model: modelId,
      text: text.substring(0, 100),
      textLength: text.length,
      latencyMs,
      hasContent: message.content.length > 0,
    });

    return {
      text,
      model: modelId,
      latencyMs,
      finishReason: message.stop_reason || undefined,
      tokenUsage: message.usage
        ? {
            promptTokens: message.usage.input_tokens,
            completionTokens: message.usage.output_tokens,
            totalTokens: message.usage.input_tokens + message.usage.output_tokens,
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
