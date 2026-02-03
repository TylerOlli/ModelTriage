/**
 * LLM inference endpoint
 * Processes prompts through one or more models in parallel
 */

import { routeToProvider } from "@/lib/llm/router";
import type { ModelId, LLMRequest } from "@/lib/llm/types";

// Force Node.js runtime (not Edge)
export const runtime = "nodejs";

interface InferenceRequest {
  prompt: string;
  models: string[];
  temperature?: number;
  maxTokens?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InferenceRequest;
    const { prompt, models, temperature, maxTokens } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Prompt is required and must be a string" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Prompt cannot be empty" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate models array
    if (!models || !Array.isArray(models) || models.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Models is required and must be a non-empty array",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate each model is a string
    if (!models.every((m) => typeof m === "string")) {
      return new Response(
        JSON.stringify({ error: "All models must be strings" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Call LLM router in parallel for each model
    const llmRequest: LLMRequest = {
      prompt,
      temperature,
      maxTokens,
    };

    const results = await Promise.allSettled(
      models.map((modelId) =>
        routeToProvider(modelId as ModelId, llmRequest)
      )
    );

    // Format results
    const formattedResults = results.map((result, index) => {
      const modelId = models[index];

      if (result.status === "fulfilled") {
        return {
          modelId,
          success: true,
          ...result.value,
        };
      } else {
        return {
          modelId,
          success: false,
          text: "",
          model: modelId as ModelId,
          latencyMs: 0,
          error: result.reason?.message || "Unknown error",
        };
      }
    });

    console.log("API Response:", {
      resultsCount: formattedResults.length,
      firstResult: formattedResults[0]
        ? {
            success: formattedResults[0].success,
            textLength: formattedResults[0].text?.length || 0,
            hasError: !!formattedResults[0].error,
          }
        : null,
    });

    return new Response(JSON.stringify({ results: formattedResults }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in inference route:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
