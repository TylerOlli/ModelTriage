import { GoogleGenAI } from "@google/genai";
import type { LLMRequest, LLMResponse, ModelId } from "../types";
import { buildImageGistInstruction } from "@/lib/attachments/image-gist-schema";

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

    // Build parts array (text + images if present)
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];
    
    // If images are present, prepend IMAGE_GIST instruction
    const hasImages = request.images && request.images.length > 0;
    const promptText = hasImages 
      ? buildImageGistInstruction(request.prompt)
      : request.prompt;
    
    parts.push({ text: promptText });
    
    if (hasImages) {
      for (const image of request.images!) {
        const base64Data = image.data.toString("base64");
        parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: base64Data,
          },
        });
      }
    }

    const result = await geminiClient.models.generateContent({
      model: modelId,
      contents: [{ role: "user", parts }],
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
 * Stream Gemini response with SSE using native streaming
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

    // Build parts array (text + images if present)
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];
    
    // If images are present, prepend IMAGE_GIST instruction
    const hasImages = request.images && request.images.length > 0;
    const promptText = hasImages 
      ? buildImageGistInstruction(request.prompt)
      : request.prompt;
    
    const isDev = process.env.NODE_ENV !== "production";
    
    if (isDev && hasImages) {
      console.log('[GEMINI_STREAM] Image present - using IMAGE_GIST instruction');
      console.log('[GEMINI_STREAM] Prompt first 300 chars:', promptText.substring(0, 300));
    }
    
    parts.push({ text: promptText });
    
    if (hasImages) {
      for (const image of request.images!) {
        const base64Data = image.data.toString("base64");
        parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: base64Data,
          },
        });
      }
      
      if (isDev) {
        console.log('[GEMINI_STREAM] Added', request.images!.length, 'image(s) to request');
      }
    }

    // Use native streaming with generateContentStream
    const stream = await geminiClient.models.generateContentStream({
      model: modelId,
      contents: [{ role: "user", parts }],
      config: generationConfig,
    });

    let fullText = "";
    let usage: any;
    let finishReason: string | undefined;

    // Process stream chunks in real-time
    for await (const chunk of stream) {
      const firstCandidate = chunk.candidates?.[0];
      const text = firstCandidate?.content?.parts?.[0]?.text || "";
      
      if (text) {
        fullText += text;
        yield {
          type: "chunk",
          data: { model: modelId, delta: text },
        };
      }

      // Capture finish reason and usage metadata
      if (firstCandidate?.finishReason) {
        finishReason = firstCandidate.finishReason;
      }
      
      if (chunk.usageMetadata) {
        usage = chunk.usageMetadata;
      }
    }

    if (isDev && hasImages) {
      console.log('[GEMINI_STREAM] ========================================');
      console.log('[GEMINI_STREAM] Gemini Response Received');
      console.log('[GEMINI_STREAM] Response length:', fullText.length, 'characters');
      console.log('[GEMINI_STREAM] First 800 chars of response:');
      console.log(fullText.substring(0, 800));
      console.log('[GEMINI_STREAM] ========================================');
      
      if (fullText.includes('IMAGE_GIST:')) {
        console.log('[GEMINI_STREAM] ✓ IMAGE_GIST detected in response');
      } else {
        console.log('[GEMINI_STREAM] ✗ IMAGE_GIST NOT FOUND in response');
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
