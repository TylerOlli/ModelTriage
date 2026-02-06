/**
 * OpenAI provider implementation
 */

import OpenAI from "openai";
import type { LLMRequest, LLMResponse, ModelId } from "../types";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function runOpenAI(
  request: LLMRequest,
  modelId: ModelId
): Promise<LLMResponse> {
  const startTime = Date.now();

  try {
    const openaiClient = getClient();
    
    // Build content array (text + images if present)
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [{ type: "text", text: request.prompt }];
    
    if (request.images && request.images.length > 0) {
      for (const image of request.images) {
        const base64Data = image.data.toString("base64");
        const dataUrl = `data:${image.mimeType};base64,${base64Data}`;
        content.push({
          type: "image_url",
          image_url: { url: dataUrl },
        });
      }
    }
    
    const completion = await openaiClient.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: "user",
          content,
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

/**
 * Stream OpenAI response with SSE
 */
export async function* streamOpenAI(
  request: LLMRequest,
  modelId: ModelId
): AsyncGenerator<{ type: "chunk" | "done" | "error"; data: any }> {
  const startTime = Date.now();

  try {
    const openaiClient = getClient();
    
    // Build content array (text + images if present)
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [{ type: "text", text: request.prompt }];
    
    if (request.images && request.images.length > 0) {
      for (const image of request.images) {
        const base64Data = image.data.toString("base64");
        const dataUrl = `data:${image.mimeType};base64,${base64Data}`;
        content.push({
          type: "image_url",
          image_url: { url: dataUrl },
        });
      }
    }
    
    const stream = await openaiClient.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: "user",
          content,
        },
      ],
      max_completion_tokens: request.maxTokens ?? 16000,
      stream: true,
      stream_options: { include_usage: true },
    });

    let fullText = "";
    let finishReason: string | undefined;
    let usage: any;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        fullText += delta;
        yield {
          type: "chunk",
          data: { model: modelId, delta },
        };
      }

      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }

      // Capture usage if available
      if (chunk.usage) {
        usage = chunk.usage;
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
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
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
