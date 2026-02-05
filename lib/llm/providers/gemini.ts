import { GoogleGenAI } from "@google/genai";
import type { LLMRequest, LLMResponse, ModelId } from "../types";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export async function runGemini(
  request: LLMRequest,
  modelId: ModelId
): Promise<LLMResponse> {
  const startTime = Date.now();

  try {
    const geminiClient = getClient();
    const generationConfig: {
      temperature?: number;
      maxOutputTokens?: number;
    } = {};

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }

    const result = await geminiClient.models.generateContent({
      model: modelId,
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      config: generationConfig,
    });

    const latencyMs = Date.now() - startTime;
    const firstCandidate = result.candidates?.[0];
    const text = firstCandidate?.content?.parts?.[0]?.text || "";

    console.log("Gemini Full Response:", {
      model: modelId,
      candidates: result.candidates,
      usageMetadata: result.usageMetadata,
    });

    console.log("Gemini Response:", {
      model: modelId,
      text: text.substring(0, 100),
      textLength: text.length,
      latencyMs,
      hasText: !!text,
    });

    return {
      text,
      model: modelId,
      latencyMs,
      finishReason: firstCandidate?.finishReason || undefined,
      tokenUsage: result.usageMetadata
        ? {
            promptTokens: result.usageMetadata.promptTokenCount || 0,
            completionTokens: result.usageMetadata.candidatesTokenCount || 0,
            totalTokens: result.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    console.error("Gemini Error:", {
      model: modelId,
      error: errorMessage,
      fullError: err,
    });

    return {
      text: "",
      model: modelId,
      latencyMs,
      error: errorMessage,
    };
  }
}

/**
 * Stream Gemini response with SSE
 * Note: Gemini doesn't support native streaming in this SDK version,
 * so we simulate it by chunking the response
 */
export async function* streamGemini(
  request: LLMRequest,
  modelId: ModelId
): AsyncGenerator<{ type: "chunk" | "done" | "error"; data: any }> {
  const startTime = Date.now();

  try {
    const geminiClient = getClient();
    const generationConfig: {
      temperature?: number;
      maxOutputTokens?: number;
    } = {};

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }

    const result = await geminiClient.models.generateContent({
      model: modelId,
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      config: generationConfig,
    });

    const firstCandidate = result.candidates?.[0];
    const text = firstCandidate?.content?.parts?.[0]?.text || "";
    const usage = result.usageMetadata;
    const finishReason = firstCandidate?.finishReason;

    // Simulate streaming by chunking the response
    // Split text into reasonable chunks (approximately by words)
    const chunkSize = 50; // characters per chunk
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      yield {
        type: "chunk",
        data: { model: modelId, delta: chunk },
      };
      // Small delay to simulate streaming
      await new Promise((resolve) => setTimeout(resolve, 10));
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
              promptTokens: usage.promptTokenCount || 0,
              completionTokens: usage.candidatesTokenCount || 0,
              totalTokens: usage.totalTokenCount || 0,
            }
          : undefined,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    console.error("Gemini Streaming Error:", {
      model: modelId,
      error: errorMessage,
      fullError: err,
    });

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
