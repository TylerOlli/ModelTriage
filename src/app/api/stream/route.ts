/**
 * LLM inference endpoint
 * Processes prompts through one or more models in parallel
 * Supports automatic model selection via intent router
 */

import { routeToProvider } from "@/lib/llm/router";
import { intentRouter } from "@/lib/llm/intent-router";
import type { ModelId, LLMRequest } from "@/lib/llm/types";

// Force Node.js runtime (not Edge)
export const runtime = "nodejs";

// Hard limits
const MAX_PROMPT_LENGTH = 8000;
const DEFAULT_MAX_TOKENS = 16000; // High default for reasoning models (GPT-5 mini needs tokens for internal reasoning)
const MAX_TOKENS_LIMIT = 32000; // Max limit for cost control
const MODEL_TIMEOUT_MS = 60000; // 60 seconds (reasoning models can take longer)

// Rate limiting (in-memory, simple MVP)
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface InferenceRequest {
  prompt: string;
  models?: string[]; // Optional - if empty/missing, triggers auto-routing
  temperature?: number;
  maxTokens?: number;
}

/**
 * Get client IP from request headers
 */
function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return "unknown";
}

/**
 * Check rate limit for IP
 */
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!record || record.resetAt < now) {
    // New window
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count += 1;
  return { allowed: true };
}

/**
 * Run model with timeout
 */
async function runWithTimeout(
  modelId: ModelId,
  llmRequest: LLMRequest
): Promise<any> {
  return Promise.race([
    routeToProvider(modelId, llmRequest),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Model timeout after 60 seconds")),
        MODEL_TIMEOUT_MS
      )
    ),
  ]);
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitCheck = checkRateLimit(clientIP);
    
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS / 60000} minutes. Try again in ${rateLimitCheck.retryAfter} seconds.`,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitCheck.retryAfter),
          },
        }
      );
    }

    const body = (await request.json()) as InferenceRequest;
    const { prompt, models, temperature } = body;
    let { maxTokens } = body;

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

    // Enforce max prompt length
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters. Current length: ${prompt.length}`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Clamp maxTokens to safe limits
    if (!maxTokens) {
      maxTokens = DEFAULT_MAX_TOKENS;
    } else if (maxTokens > MAX_TOKENS_LIMIT) {
      maxTokens = MAX_TOKENS_LIMIT;
      console.log(
        `Clamped maxTokens from ${body.maxTokens} to ${MAX_TOKENS_LIMIT}`
      );
    }

    // Determine routing mode: auto (no models) or manual (models provided)
    const isAutoMode = !models || models.length === 0;
    let modelsToRun: string[];
    let routingMetadata: {
      mode: "auto" | "manual";
      intent?: string;
      category?: string;
      chosenModel?: string;
      confidence?: number;
      reason?: string;
    };

    if (isAutoMode) {
      // Auto-routing mode: use intent router to select best model
      try {
        const decision = await intentRouter.route(prompt);
        modelsToRun = [decision.chosenModel];
        routingMetadata = {
          mode: "auto",
          intent: decision.intent,
          category: decision.category,
          chosenModel: decision.chosenModel,
          confidence: decision.confidence,
          reason: decision.reason,
        };
        console.log("Auto-routing decision:", routingMetadata);
      } catch (err) {
        console.error("Intent router failed:", err);
        // Fallback to gpt-5-mini
        modelsToRun = ["gpt-5-mini"];
        routingMetadata = {
          mode: "auto",
          intent: "unknown",
          category: "router_fallback",
          chosenModel: "gpt-5-mini",
          confidence: 0,
          reason: "Router fallback due to error",
        };
      }
    } else {
      // Manual mode: use user-selected models
      // Validate models array
      if (!Array.isArray(models)) {
        return new Response(
          JSON.stringify({ error: "Models must be an array" }),
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

      modelsToRun = models;
      routingMetadata = {
        mode: "manual",
      };
      console.log("Manual mode, running models:", modelsToRun);
    }

    // Call LLM router in parallel for each model with timeout
    const llmRequest: LLMRequest = {
      prompt,
      temperature,
      maxTokens,
    };

    const results = await Promise.allSettled(
      modelsToRun.map((modelId) =>
        runWithTimeout(modelId as ModelId, llmRequest)
      )
    );

    // Format results
    const formattedResults = results.map((result, index) => {
      const modelId = modelsToRun[index];

      if (result.status === "fulfilled") {
        return {
          modelId,
          success: true,
          ...result.value,
        };
      } else {
        const errorMessage = result.reason?.message || "Unknown error";
        const isTimeout = errorMessage.includes("timeout");
        
        return {
          modelId,
          success: false,
          text: "",
          model: modelId as ModelId,
          latencyMs: isTimeout ? MODEL_TIMEOUT_MS : 0,
          error: isTimeout ? "timeout" : errorMessage,
        };
      }
    });

    console.log("API Response:", {
      mode: routingMetadata.mode,
      resultsCount: formattedResults.length,
      firstResult: formattedResults[0]
        ? {
            success: formattedResults[0].success,
            textLength: formattedResults[0].text?.length || 0,
            hasError: !!formattedResults[0].error,
          }
        : null,
    });

    return new Response(
      JSON.stringify({
        routing: routingMetadata,
        results: formattedResults,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
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
