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
