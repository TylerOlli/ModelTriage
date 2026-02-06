/**
 * Anthropic provider implementation
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMRequest, LLMResponse, ModelId } from "../types";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function runAnthropic(
  request: LLMRequest,
  modelId: ModelId
): Promise<LLMResponse> {
  const startTime = Date.now();

  try {
    const anthropicClient = getClient();
    
    // Build content array (text + images if present)
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } }
    > = [{ type: "text", text: request.prompt }];
    
    if (request.images && request.images.length > 0) {
      for (const image of request.images) {
        const base64Data = image.data.toString("base64");
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: image.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: base64Data,
          },
        });
      }
    }
    
    const message = await anthropicClient.messages.create({
      model: modelId,
      max_tokens: request.maxTokens ?? 16000,
      temperature: request.temperature ?? 1,
      messages: [
        {
          role: "user",
          content,
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

/**
 * Stream Anthropic response with SSE
 */
export async function* streamAnthropic(
  request: LLMRequest,
  modelId: ModelId
): AsyncGenerator<{ type: "chunk" | "done" | "error"; data: any }> {
  const startTime = Date.now();

  try {
    const anthropicClient = getClient();
    
    // Build content array (text + images if present)
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } }
    > = [{ type: "text", text: request.prompt }];
    
    if (request.images && request.images.length > 0) {
      for (const image of request.images) {
        const base64Data = image.data.toString("base64");
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: image.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: base64Data,
          },
        });
      }
    }
    
    const stream = await anthropicClient.messages.stream({
      model: modelId,
      max_tokens: request.maxTokens ?? 16000,
      temperature: request.temperature ?? 1,
      messages: [
        {
          role: "user",
          content,
        },
      ],
    });

    let fullText = "";
    let finishReason: string | undefined;
    let usage: any;

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const delta = event.delta.text;
        fullText += delta;
        yield {
          type: "chunk",
          data: { model: modelId, delta },
        };
      }

      if (event.type === "message_stop") {
        const message = await stream.finalMessage();
        finishReason = message.stop_reason || undefined;
        usage = message.usage;
      }
    }

    const latencyMs = Date.now() - startTime;

    yield {
      type: "done",
      data: {
        model: modelId,
        latencyMs,
        finishReason,
        tokenUsage: usage
          ? {
              promptTokens: usage.input_tokens,
              completionTokens: usage.output_tokens,
              totalTokens: usage.input_tokens + usage.output_tokens,
            }
          : undefined,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    yield {
      type: "error",
      data: {
        model: modelId,
        message: errorMessage,
        code: "provider_error",
        latencyMs,
      },
    };
  }
}
