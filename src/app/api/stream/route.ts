/**
 * LLM inference endpoint
 * Processes prompts through one or more models in parallel
 * Supports automatic model selection via intent router
 * Supports file attachments (text + images) with strict token guardrails
 */

import { routeToProvider } from "@/lib/llm/router";
import { intentRouter } from "@/lib/llm/intent-router";
import type { ModelId, LLMRequest } from "@/lib/llm/types";
import { parseInferenceRequest } from "@/lib/attachments/request-parser";
import { processAttachments, buildAttachmentsSection } from "@/lib/attachments/processor";
import { resizeAndCompressImage } from "@/lib/attachments/image-resizer";
import { supportsVision, anyModelSupportsVision, getDefaultVisionModel } from "@/lib/attachments/vision-support";
import type { ProcessedImageAttachment } from "@/lib/attachments/processor";

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
  previousPrompt?: string; // Optional - for follow-up prompts
  previousResponse?: string; // Optional - for follow-up prompts
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

    // Parse request (supports both JSON and multipart/form-data)
    const parsedRequest = await parseInferenceRequest(request);
    const { prompt, models, temperature, previousPrompt, previousResponse, files, stream } = parsedRequest;
    let { maxTokens } = parsedRequest;
    
    // Construct contextual prompt if this is a follow-up
    let contextualPrompt = prompt;
    if (previousPrompt && previousResponse) {
      contextualPrompt = `Previous conversation:
User: ${previousPrompt}
Assistant: ${previousResponse}

Follow-up question:
${prompt}`;
      console.log("Follow-up prompt detected, adding context");
    }

    // Process attachments if files are present
    let attachmentResult: Awaited<ReturnType<typeof processAttachments>> | null = null;
    let imageAttachmentsForProvider: Array<{ data: Buffer; mimeType: string; filename: string }> = [];
    
    if (files && files.length > 0) {
      console.log(`Processing ${files.length} attachment(s)`);
      
      try {
        attachmentResult = await processAttachments(files, prompt);
        
        // Check for validation errors
        if (attachmentResult.errors.length > 0) {
          return new Response(
            JSON.stringify({
              error: `Attachment validation failed: ${attachmentResult.errors.join(", ")}`,
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Extract image attachments for provider
        const imageAttachments = attachmentResult.attachments.filter(
          (a) => a.type === "image"
        ) as ProcessedImageAttachment[];

        // Resize and compress images
        if (imageAttachments.length > 0) {
          console.log(`Resizing ${imageAttachments.length} image(s)`);
          for (const img of imageAttachments) {
            try {
              const resized = await resizeAndCompressImage(img.data, img.mimeType);
              img.data = resized.buffer;
              img.mimeType = resized.mimeType;
              img.resized = true;
              console.log(
                `Image ${img.filename}: ${img.originalSize} → ${resized.compressedSize} bytes`
              );
              
              // Store for provider
              imageAttachmentsForProvider.push({
                data: img.data,
                mimeType: img.mimeType,
                filename: img.filename,
              });
            } catch (imgError) {
              console.error(`Failed to process image ${img.filename}:`, imgError);
              return new Response(
                JSON.stringify({
                  error: `We couldn't process the image attachment "${img.filename}". Please re-upload a clearer screenshot or try a different image format.`,
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }
          }
        }

        // Build attachments section with explicit context
        const attachmentsSection = buildAttachmentsSection(attachmentResult, prompt);
        // Replace the original prompt with the enriched version
        contextualPrompt = attachmentsSection;
        
        console.log("Attachments processed:", {
          totalFiles: attachmentResult.attachments.length,
          images: imageAttachments.length,
          textChars: attachmentResult.totalTextChars,
          summarized: attachmentResult.summarized,
          hasImages: attachmentResult.hasImages,
        });
      } catch (err) {
        console.error("Attachment processing error:", err);
        return new Response(
          JSON.stringify({
            error: `Failed to process attachments: ${err instanceof Error ? err.message : "Unknown error"}`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

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
    const originalMaxTokens = maxTokens;
    if (!maxTokens) {
      maxTokens = DEFAULT_MAX_TOKENS;
    } else if (maxTokens > MAX_TOKENS_LIMIT) {
      maxTokens = MAX_TOKENS_LIMIT;
      console.log(
        `Clamped maxTokens from ${originalMaxTokens} to ${MAX_TOKENS_LIMIT}`
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
      // Build attachment context if attachments are present
      let attachmentContext:
        | {
            hasImages: boolean;
            hasTextFiles: boolean;
            textFileTypes: string[];
            attachmentNames: string[];
            totalTextChars: number;
            promptChars: number;
            imageCount: number;
            textFileCount: number;
            attachments?: Array<{
              type: string;
              filename?: string;
              content?: string;
              extension?: string;
            }>;
          }
        | undefined;

      if (attachmentResult) {
        // Extract text file extensions
        const textFileTypes = attachmentResult.attachments
          .filter((a) => a.type === "text")
          .map((a) => (a as any).extension || "");

        attachmentContext = {
          hasImages: attachmentResult.hasImages,
          hasTextFiles: attachmentResult.hasTextFiles,
          textFileTypes,
          attachmentNames: attachmentResult.attachmentNames,
          totalTextChars: attachmentResult.totalTextChars,
          promptChars: prompt.length,
          imageCount: attachmentResult.imageCount,
          textFileCount: attachmentResult.textFileCount,
          attachments: attachmentResult.attachments.map((a) => ({
            type: a.type,
            filename: (a as any).filename,
            content: a.type === "text" ? (a as any).content : undefined,
            extension: (a as any).extension,
          })),
        };

        console.log("Attachment context for routing:", attachmentContext);
      }

      try {
        const decision = await intentRouter.route(
          prompt,
          false,
          attachmentContext
        );
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

    // STRICT vision capability enforcement when images are attached
    if (attachmentResult && attachmentResult.hasImages) {
      const hasVisionModel = anyModelSupportsVision(modelsToRun);
      
      if (!hasVisionModel) {
        if (isAutoMode) {
          // Auto mode: MUST fall back to a vision-capable model (no silent failures)
          const visionModel = getDefaultVisionModel();
          console.log(
            `⚠️ Images attached but ${modelsToRun[0]} doesn't support vision. ENFORCING fallback to ${visionModel}`
          );
          modelsToRun = [visionModel];
          routingMetadata = {
            ...routingMetadata,
            chosenModel: visionModel,
            reason: `Switched to ${visionModel} because your request includes an image attachment. Only vision-capable models can analyze images.`,
          };
        } else {
          // Manual mode: STRICT rejection if no vision model selected
          const visionModels = modelsToRun.filter((m) => supportsVision(m));
          if (visionModels.length === 0) {
            return new Response(
              JSON.stringify({
                error: `This request includes an image attachment and requires a vision-capable model. Enable Verify/Advanced and select a vision model (GPT-5.2, Claude Opus 4.5, Claude Sonnet 4.5, Gemini 2.5 Flash, or Gemini 2.5 Pro), or remove the image.`,
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          } else {
            // Some models support vision, filter to ONLY those
            const removedModels = modelsToRun.filter((m) => !supportsVision(m));
            modelsToRun = visionModels;
            console.log(
              `⚠️ Images attached: filtered to vision-capable models only: ${modelsToRun.join(", ")}`
            );
            if (removedModels.length > 0) {
              console.log(
                `Removed non-vision models: ${removedModels.join(", ")}`
              );
            }
          }
        }
      }
      
      console.log(`✓ Vision capability check passed. Using models: ${modelsToRun.join(", ")}`);
    }

    // Check if streaming is requested
    if (stream === true) {
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
              // Build attachment context if attachments are present
              let attachmentContextStream:
                | {
                    hasImages: boolean;
                    hasTextFiles: boolean;
                    textFileTypes: string[];
                    attachmentNames: string[];
                    totalTextChars: number;
                    promptChars: number;
                    imageCount: number;
                    textFileCount: number;
                    attachments?: Array<{
                      type: string;
                      filename?: string;
                      content?: string;
                      extension?: string;
                    }>;
                  }
                | undefined;

              if (attachmentResult) {
                // Extract text file extensions
                const textFileTypes = attachmentResult.attachments
                  .filter((a) => a.type === "text")
                  .map((a) => (a as any).extension || "");

                attachmentContextStream = {
                  hasImages: attachmentResult.hasImages,
                  hasTextFiles: attachmentResult.hasTextFiles,
                  textFileTypes,
                  attachmentNames: attachmentResult.attachmentNames,
                  totalTextChars: attachmentResult.totalTextChars,
                  promptChars: prompt.length,
                  imageCount: attachmentResult.imageCount,
                  textFileCount: attachmentResult.textFileCount,
                  attachments: attachmentResult.attachments.map((a) => ({
                    type: a.type,
                    filename: (a as any).filename,
                    content: a.type === "text" ? (a as any).content : undefined,
                    extension: (a as any).extension,
                  })),
                };
              }

              try {
                const decision = await intentRouter.route(
                  prompt,
                  false,
                  attachmentContextStream
                );
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
            // Skip if we already have a descriptive attachment-aware reason
            const isDescriptiveReason = 
              routingMetadataStream.reason &&
              (routingMetadataStream.reason.includes("screenshot") ||
               routingMetadataStream.reason.includes("image") ||
               routingMetadataStream.reason.includes("uploaded") ||
               routingMetadataStream.reason.includes("terminal") ||
               routingMetadataStream.reason.includes("error output") ||
               routingMetadataStream.reason.includes("UI") ||
               routingMetadataStream.reason.includes("interface") ||
               routingMetadataStream.reason.includes("diagram") ||
               routingMetadataStream.reason.length > 80); // Longer reasons are typically more descriptive

            if (isAutoMode && routingMetadataStream.mode === "auto" && !isDescriptiveReason) {
              console.log("Starting async routing reason generation for:", {
                model: routingMetadataStream.chosenModel,
                promptPreview: prompt.substring(0, 100),
                currentReason: routingMetadataStream.reason,
              });
              
              intentRouter
                .generateRoutingReason({
                  prompt,
                  chosenModel: routingMetadataStream.chosenModel as any,
                  intent: routingMetadataStream.intent || "unknown",
                  category: routingMetadataStream.category || "",
                })
                .then((customReason) => {
                  console.log("Generated custom routing reason:", customReason);
                  
                  // Only send if the custom reason is better than current one
                  // (longer, more specific, not generic)
                  const isGenericReason = 
                    customReason.includes("balanced capabilities") ||
                    customReason.includes("best match for") ||
                    (customReason.includes("well-suited to") && customReason.length < 80);
                  
                  if (!isGenericReason && customReason.length > (routingMetadataStream.reason?.length || 0)) {
                    // Send updated routing reason via SSE
                    try {
                      controller.enqueue(
                        encoder.encode(
                          formatSSE("routing_reason", {
                            reason: customReason,
                          })
                        )
                      );
                      console.log("Sent improved routing_reason SSE event");
                    } catch (enqueueErr) {
                      console.error("Failed to enqueue routing_reason event:", enqueueErr);
                    }
                  } else {
                    console.log("Skipping generic custom reason, keeping original:", routingMetadataStream.reason);
                  }
                })
                .catch((err) => {
                  console.error("Failed to generate custom routing reason:", {
                    error: err instanceof Error ? err.message : err,
                    prompt: prompt.substring(0, 100),
                    model: routingMetadataStream.chosenModel,
                  });
                  // Don't send error event, keep the original reason
                });
            } else if (isDescriptiveReason) {
              console.log("Skipping async reason generation - already have descriptive reason:", routingMetadataStream.reason);
            }

            // Track first chunk per model for ping logic
            const firstChunkReceived = new Set<string>();

            // Stream all models in parallel
            await Promise.allSettled(
              modelsToRunStream.map(async (modelId) => {
                const llmRequest: LLMRequest = {
                  prompt: contextualPrompt,
                  temperature,
                  maxTokens,
                  ...(imageAttachmentsForProvider.length > 0 && {
                    images: imageAttachmentsForProvider,
                  }),
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
      prompt: contextualPrompt,
      temperature,
      maxTokens,
      ...(imageAttachmentsForProvider.length > 0 && {
        images: imageAttachmentsForProvider,
      }),
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
