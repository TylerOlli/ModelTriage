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
  stream?: boolean; // Optional - if true, use SSE streaming
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

/**
 * Format SSE event
 */
function formatSSE(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Stream provider responses via SSE
 */
async function* streamProvider(
  modelId: ModelId,
  llmRequest: LLMRequest
): AsyncGenerator<string> {
  // Import streaming functions dynamically
  const { streamOpenAI } = await import("@/lib/llm/providers/openai");
  const { streamAnthropic } = await import("@/lib/llm/providers/anthropic");
  const { streamGemini } = await import("@/lib/llm/providers/gemini");

  let streamFn;
  if (modelId === "gpt-5-mini" || modelId === "gpt-5.2") {
    streamFn = streamOpenAI(llmRequest, modelId);
  } else if (
    modelId === "claude-opus-4-5-20251101" ||
    modelId === "claude-sonnet-4-5-20250929" ||
    modelId === "claude-haiku-4-5-20251001"
  ) {
    streamFn = streamAnthropic(llmRequest, modelId);
  } else if (modelId === "gemini-2.5-flash" || modelId === "gemini-2.5-pro") {
    streamFn = streamGemini(llmRequest, modelId);
  } else {
    yield formatSSE("error", {
      model: modelId,
      message: `Unsupported model: ${modelId}`,
      code: "unknown",
    });
    return;
  }

  try {
    for await (const event of streamFn) {
      if (event.type === "chunk") {
        yield formatSSE("chunk", event.data);
      } else if (event.type === "done") {
        yield formatSSE("done", event.data);
      } else if (event.type === "error") {
        yield formatSSE("error", event.data);
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    yield formatSSE("error", {
      model: modelId,
      message: errorMessage,
      code: "provider_error",
    });
  }
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
      // Use fast routing (skip custom reason generation) to avoid blocking streams
      try {
        const decision = await intentRouter.route(prompt, false);
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
          reason: "Selected as a reliable default for this request.",
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

    // Check if streaming is requested
    if (body.stream === true) {
      // SSE streaming mode - start response immediately
      const requestId = Math.random().toString(36).substring(7);
      
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          try {
            // Send initial ping to establish connection immediately
            controller.enqueue(
              encoder.encode(formatSSE("meta", { requestId, status: "connected" }))
            );

            // Determine routing mode inside the stream (async)
            let modelsToRunStream: string[];
            let routingMetadataStream: typeof routingMetadata;

            if (isAutoMode) {
              // Auto-routing mode: use intent router to select best model
              // In streaming mode, skip custom reason generation to avoid blocking (use fast fallback reasons)
              try {
                const decision = await intentRouter.route(prompt, false);
                modelsToRunStream = [decision.chosenModel];
                routingMetadataStream = {
                  mode: "auto",
                  intent: decision.intent,
                  category: decision.category,
                  chosenModel: decision.chosenModel,
                  confidence: decision.confidence,
                  reason: decision.reason,
                };
              } catch (err) {
                console.error("Intent router failed:", err);
                // Fallback to gpt-5-mini
                modelsToRunStream = ["gpt-5-mini"];
                routingMetadataStream = {
                  mode: "auto",
                  intent: "unknown",
                  category: "router_fallback",
                  chosenModel: "gpt-5-mini",
                  confidence: 0,
                  reason: "Selected as a reliable default for this request.",
                };
              }
            } else {
              modelsToRunStream = models!;
              routingMetadataStream = { mode: "manual" };
            }

            // Send routing metadata
            controller.enqueue(
              encoder.encode(
                formatSSE("meta", {
                  requestId,
                  models: modelsToRunStream,
                  routing: routingMetadataStream,
                })
              )
            );

            // Send model_start event for each model
            for (const modelId of modelsToRunStream) {
              controller.enqueue(
                encoder.encode(formatSSE("model_start", { model: modelId }))
              );
            }

            // Generate custom routing reason asynchronously (don't block streaming)
            if (isAutoMode && routingMetadataStream.mode === "auto") {
              intentRouter
                .generateRoutingReason({
                  prompt,
                  chosenModel: routingMetadataStream.chosenModel as any,
                  intent: routingMetadataStream.intent || "unknown",
                  category: routingMetadataStream.category || "",
                })
                .then((customReason) => {
                  // Send updated routing reason via SSE
                  controller.enqueue(
                    encoder.encode(
                      formatSSE("routing_reason", {
                        reason: customReason,
                      })
                    )
                  );
                })
                .catch((err) => {
                  console.error("Failed to generate custom routing reason:", err);
                  // Don't send error event, just skip - fallback reason already displayed
                });
            }

            // Track first chunk per model for ping logic
            const firstChunkReceived = new Set<string>();

            // Stream all models in parallel
            await Promise.allSettled(
              modelsToRunStream.map(async (modelId) => {
                const llmRequest: LLMRequest = {
                  prompt,
                  temperature,
                  maxTokens,
                };

                // Start ping interval for this model (500ms until first chunk)
                const pingInterval = setInterval(() => {
                  if (!firstChunkReceived.has(modelId)) {
                    controller.enqueue(
                      encoder.encode(formatSSE("ping", { model: modelId }))
                    );
                  }
                }, 500);

                try {
                  for await (const sseEvent of streamProvider(
                    modelId as ModelId,
                    llmRequest
                  )) {
                    // Mark first chunk received to stop pings
                    if (sseEvent.includes('"chunk"')) {
                      firstChunkReceived.add(modelId);
                      clearInterval(pingInterval);
                    }
                    controller.enqueue(encoder.encode(sseEvent));
                  }
                } catch (err) {
                  const errorMessage =
                    err instanceof Error ? err.message : "Unknown error";
                  controller.enqueue(
                    encoder.encode(
                      formatSSE("error", {
                        model: modelId,
                        message: errorMessage,
                        code: "provider_error",
                      })
                    )
                  );
                } finally {
                  clearInterval(pingInterval);
                }
              })
            );

            // Send completion event
            controller.enqueue(
              encoder.encode(formatSSE("complete", { requestId }))
            );
          } catch (err) {
            console.error("SSE stream error:", err);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming mode (existing JSON response)
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
