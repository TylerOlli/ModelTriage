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
import { getAttachmentsGist } from "@/lib/attachments/gist-generator";
import { parseImageGist, generateRoutingReasonFromGist, type ImageGist } from "@/lib/attachments/image-gist-schema";
import { classifyPrompt } from "@/lib/llm/prompt-classifier";

/**
 * Check if a routing reason is a placeholder (not final)
 * Placeholders should always be replaced by IMAGE_GIST-derived reasons
 */
function isPlaceholderImageReason(reason: string): boolean {
  const lower = reason.toLowerCase();
  
  // Check for common placeholder patterns
  const hasScreenshot = lower.includes("screenshot") || lower.includes("image");
  const hasGenericPhrase = 
    lower.includes("snippet or file") ||
    lower.includes("code snippet") ||
    lower.includes("visual content") ||
    (lower.includes("showing") && lower.includes("or file"));
  
  return hasScreenshot && hasGenericPhrase;
}

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
  isFollowUp?: boolean; // Optional - signals this is a follow-up turn
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
    modelId === "claude-opus-4-6" ||
    modelId === "claude-sonnet-4-5-20250929" ||
    modelId === "claude-haiku-4-5-20251001"
  ) {
    streamFn = streamAnthropic(llmRequest, modelId);
  } else if (modelId === "gemini-3-flash-preview" || modelId === "gemini-3-pro-preview") {
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
    const { prompt, models, temperature, previousPrompt, previousResponse, files, stream, anonymousId } = parsedRequest;
    const isFollowUp = (parsedRequest as any).isFollowUp === true || (parsedRequest as any).isFollowUp === "true";
    let { maxTokens } = parsedRequest;
    
    // Construct contextual prompt if this is a follow-up
    let contextualPrompt = prompt;
    // Compact routing prompt: includes original prompt for context so the router
    // can correctly classify follow-ups (e.g. "Rewrite it in TypeScript" → coding, not writing).
    // This is separate from contextualPrompt which includes the full previous response for the model.
    let routingPrompt = prompt;
    if (previousPrompt && previousResponse) {
      contextualPrompt = `Previous conversation:
User: ${previousPrompt}
Assistant: ${previousResponse}

Follow-up question:
${prompt}`;
      // Give the router the original prompt + follow-up so it understands the task domain
      routingPrompt = `Original request: ${previousPrompt}\nFollow-up: ${prompt}`;
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

        // Resize and compress images (parallelized for speed)
        if (imageAttachments.length > 0) {
          console.log(`Resizing ${imageAttachments.length} image(s) in parallel`);
          const resizeResults = await Promise.allSettled(
            imageAttachments.map(async (img) => {
              const resized = await resizeAndCompressImage(img.data, img.mimeType);
              return { img, resized };
            })
          );

          for (const result of resizeResults) {
            if (result.status === "rejected") {
              // Find which image failed (best-effort)
              const failedImg = imageAttachments[resizeResults.indexOf(result)];
              const filename = failedImg?.filename || "unknown";
              console.error(`Failed to process image ${filename}:`, result.reason);
              return new Response(
                JSON.stringify({
                  error: `We couldn't process the image attachment "${filename}". Please re-upload a clearer screenshot or try a different image format.`,
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }

            const { img, resized } = result.value;
            img.data = resized.buffer;
            img.mimeType = resized.mimeType;
            img.resized = true;
            console.log(
              `Image ${img.filename}: ${img.originalSize} → ${resized.compressedSize} bytes`
            );

            imageAttachmentsForProvider.push({
              data: img.data,
              mimeType: img.mimeType,
              filename: img.filename,
            });
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
      fitBreakdown?: any;
      scoring?: any;
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
          routingPrompt,
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
          fitBreakdown: decision.fitBreakdown,
          scoring: decision.scoring,
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
                error: `This request includes an image attachment and requires a vision-capable model. Enable Verify/Advanced and select a vision model (GPT-5.2, Claude Opus 4.5, Claude Sonnet 4.5, Gemini 3 Flash, or Gemini 3 Pro), or remove the image.`,
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
          // Declared outside try so it's accessible in finally for persistence
          let modelDispatchStart = Date.now();
          
          try {
            /**
             * LATENCY OPTIMIZATION: Routing already completed in outer scope (lines 371-447).
             * Previously, routing was duplicated here — re-running the LLM classifier inside
             * the stream added ~1-2s of unnecessary latency. Now we reuse the outer-scope
             * `modelsToRun` and `routingMetadata` directly, which already include:
             * - Intent classification (LLM or deterministic)
             * - Attachment-aware routing
             * - Vision capability enforcement
             *
             * This eliminates the single largest source of latency in the Auto-Select pipeline.
             */
            const modelsToRunStream = modelsToRun;
            const routingMetadataStream = routingMetadata;

            // Send initial connection + routing metadata in a single batch
            // LATENCY OPTIMIZATION: Combined into one enqueue to reduce SSE round-trips.
            // Previously sent "connected" first, then routing in a separate event.
            controller.enqueue(
              encoder.encode(formatSSE("meta", { requestId, status: "connected" }))
            );

            // Send routing metadata immediately — no re-routing delay
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

            /**
             * PHASE A (Critical Path) vs PHASE B (Non-blocking Explanation Path)
             *
             * Phase A: Model dispatch + streaming (latency-sensitive)
             *   - Routing already complete (outer scope)
             *   - model_start events already sent
             *   - Model streaming starts immediately below
             *
             * Phase B: TEXT_GIST + routing reason generation (non-blocking)
             *   - Runs in parallel with Phase A via fire-and-forget Promise
             *   - TEXT_GIST is generated synchronously from attachment metadata (getAttachmentsGist)
             *   - Routing explanation is generated asynchronously via LLM (generateRoutingReason)
             *   - Results are sent via SSE events that the frontend hydrates independently
             *   - If the explanation isn't ready when streaming starts, the frontend shows
             *     the initial reason from routing as a placeholder
             *
             * TEXT_GIST generation NEVER blocks Phase A.
             */
            const hasImages = imageAttachmentsForProvider.length > 0;
            const isPlaceholder = routingMetadataStream.reason ? isPlaceholderImageReason(routingMetadataStream.reason) : false;
            
            const isDescriptiveReason = 
              routingMetadataStream.reason &&
              !isPlaceholder &&
              !hasImages &&
              (routingMetadataStream.reason.includes("screenshot") ||
               routingMetadataStream.reason.includes("image") ||
               routingMetadataStream.reason.includes("uploaded") ||
               routingMetadataStream.reason.includes("terminal") ||
               routingMetadataStream.reason.includes("error output") ||
               routingMetadataStream.reason.includes("UI") ||
               routingMetadataStream.reason.includes("interface") ||
               routingMetadataStream.reason.includes("diagram") ||
               routingMetadataStream.reason.length > 80);

            const isDev = process.env.NODE_ENV !== "production";
            
            if (isDev && hasImages) {
              console.log('[ROUTING] Image request detected - will require IMAGE_GIST-derived reason');
              console.log('[ROUTING] Initial reason (placeholder):', routingMetadataStream.reason);
              console.log('[ROUTING] isPlaceholder:', isPlaceholder);
              console.log('[ROUTING] Skipping OpenAI async reason generation - will use IMAGE_GIST from Gemini vision model');
            }

            // PHASE B: Async routing reason generation (runs in parallel with Phase A).
            // For image requests, skip — IMAGE_GIST from vision model replaces the reason during streaming.
            // For follow-ups, ALWAYS run Phase B to generate contextual "Continuing conversation..." reason,
            // even if the initial fast-path reason looks descriptive enough.
            //
            // IMPORTANT: We capture the Phase B promise so we can await it before closing the stream.
            // Previously this was fire-and-forget, causing a race condition where short model responses
            // (Phase A) would close the stream before the Phase B LLM call completed, silently losing
            // the follow-up routing reason.
            let phaseBPromise: Promise<void> | null = null;

            if (isAutoMode && routingMetadataStream.mode === "auto" && (!isDescriptiveReason || isFollowUp) && !hasImages) {
              console.log("Starting async routing reason generation (Phase B, parallel with model dispatch):", {
                model: routingMetadataStream.chosenModel,
                promptPreview: prompt.substring(0, 100),
                currentReason: routingMetadataStream.reason,
                isFollowUp,
              });
              
              // TEXT_GIST: Synchronous, deterministic gist from attachment metadata.
              // This is NOT the same as IMAGE_GIST (which comes from vision model output).
              // TEXT_GIST provides file-type, language, and topic signals for the routing explanation.
              const attachmentGist = attachmentResult && attachmentResult.attachments 
                ? getAttachmentsGist(attachmentResult.attachments.map((a) => ({
                    type: a.type,
                    filename: (a as any).filename,
                    content: a.type === "text" ? (a as any).content : undefined,
                    extension: (a as any).extension,
                  })), prompt)
                : null;
              
              // Phase B runs in parallel with model streaming (Phase A).
              // The frontend displays the initial fast-path reason immediately and replaces it
              // when this async result arrives via the routing_reason SSE event.
              phaseBPromise = intentRouter
                .generateRoutingReason({
                  prompt,
                  chosenModel: routingMetadataStream.chosenModel as any,
                  intent: routingMetadataStream.intent || "unknown",
                  category: routingMetadataStream.category || "",
                  attachmentGist,
                  isFollowUp,
                  previousPrompt: previousPrompt || undefined,
                })
                .then((customReason) => {
                  console.log("Generated custom routing reason (Phase B complete):", customReason);
                  
                  const isGenericReason = 
                    customReason.includes("balanced capabilities") ||
                    customReason.includes("best match for") ||
                    (customReason.includes("well-suited to") && customReason.length < 80);
                  
                  // For follow-ups, always use the Phase B reason (it contains "Continuing conversation..." context).
                  // For initial prompts, only upgrade if the new reason is more descriptive.
                  const shouldUpgrade = isFollowUp
                    ? !isGenericReason
                    : !isGenericReason && customReason.length > (routingMetadataStream.reason?.length || 0);
                  
                  if (shouldUpgrade) {
                    controller.enqueue(
                      encoder.encode(
                        formatSSE("routing_reason", {
                          reason: customReason,
                          forceUpdate: isFollowUp, // Follow-up reasons always replace — frontend must not length-gate them
                        })
                      )
                    );
                    console.log("Sent improved routing_reason SSE event", isFollowUp ? "(follow-up, forceUpdate)" : "");
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
            
            // Track accumulated response for vision models (for image gist extraction)
            const visionModelResponses = new Map<string, string>();
            let imageGistExtracted = false;

            // ── Response Time Tracking ──────────────────────────────
            // Captures wall-clock time from model dispatch to all
            // streams completing. Stored in the database for calibration.
            modelDispatchStart = Date.now();

            // PHASE A: Stream all models in parallel — this is the critical path.
            // Model dispatch starts immediately; routing explanation (Phase B) runs concurrently.
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

                // Check if this is a vision model processing images
                const isVisionModel = imageAttachmentsForProvider.length > 0 && supportsVision(modelId as ModelId);

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
                      
                      // Extract text from chunk for vision models
                      if (isVisionModel && !imageGistExtracted) {
                        const isDev = process.env.NODE_ENV !== "production";
                        
                        try {
                          // Gemini chunks have "delta" field, not "text"
                          const chunkMatch = sseEvent.match(/"delta":"([^"]*)"/);
                          if (chunkMatch && chunkMatch[1]) {
                            // Unescape the delta text (\\n -> \n, etc.)
                            const rawDelta = chunkMatch[1];
                            const unescapedDelta = rawDelta.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
                            
                            const currentResponse = visionModelResponses.get(modelId) || "";
                            const newResponse = currentResponse + unescapedDelta;
                            visionModelResponses.set(modelId, newResponse);
                            
                            if (isDev && currentResponse.length === 0) {
                              console.log('[IMAGE_GIST_DEBUG] ========================================');
                              console.log('[IMAGE_GIST_DEBUG] First chunk received for vision model:', modelId);
                              console.log('[IMAGE_GIST_DEBUG] Raw delta:', rawDelta);
                              console.log('[IMAGE_GIST_DEBUG] Unescaped delta:', unescapedDelta);
                              console.log('[IMAGE_GIST_DEBUG] ========================================');
                            }
                            
                            if (isDev && currentResponse.length === 0) {
                              console.log('[IMAGE_GIST_DEBUG] ========================================');
                              console.log('[IMAGE_GIST_DEBUG] First chunk received for vision model:', modelId);
                              console.log('[IMAGE_GIST_DEBUG] Raw delta:', rawDelta);
                              console.log('[IMAGE_GIST_DEBUG] Unescaped delta:', unescapedDelta);
                              console.log('[IMAGE_GIST_DEBUG] ========================================');
                            }
                            
                            // Look for IMAGE_GIST in the accumulated response
                            if (newResponse.length >= 100 && !imageGistExtracted && newResponse.includes("IMAGE_GIST:")) {
                              imageGistExtracted = true;
                              
                              if (isDev) {
                                console.log('[IMAGE_GIST_DEBUG] ========================================');
                                console.log('[IMAGE_GIST_DEBUG] IMAGE_GIST Detection Triggered');
                                console.log('[IMAGE_GIST_DEBUG] hasImages:', true);
                                console.log('[IMAGE_GIST_DEBUG] chosenModel:', modelId);
                                console.log('[IMAGE_GIST_DEBUG] Accumulated response length:', newResponse.length);
                                console.log('[IMAGE_GIST_DEBUG] First 500 chars of accumulated response:');
                                console.log(newResponse.substring(0, 500));
                                console.log('[IMAGE_GIST_DEBUG] ========================================');
                              }
                              
                              const { gist, cleanedResponse, parseError } = parseImageGist(newResponse);
                              
                              if (gist) {
                                const modelDisplayName = modelId.includes("gemini-3-flash-preview") 
                                  ? "Gemini 3 Flash"
                                  : modelId.includes("gemini-3-pro-preview")
                                  ? "Gemini 3 Pro"
                                  : modelId;
                                
                                const improvedReason = generateRoutingReasonFromGist(gist, modelDisplayName);
                                
                                if (isDev) {
                                  console.log('[IMAGE_GIST_DEBUG] Parsed IMAGE_GIST:', JSON.stringify(gist, null, 2));
                                  console.log('[IMAGE_GIST_DEBUG] OLD routing.reason (placeholder):', routingMetadataStream.reason);
                                  console.log('[IMAGE_GIST_DEBUG] NEW routing.reason (IMAGE_GIST-derived):', improvedReason);
                                  console.log('[IMAGE_GIST_DEBUG] Replacing placeholder with IMAGE_GIST-derived reason');
                                }
                                
                                console.log("[ROUTING] parsed IMAGE_GIST:", JSON.stringify(gist));
                                console.log("[ROUTING] Generated routing reason:", improvedReason);
                                
                                // Update backend routing metadata state (persists in final response)
                                if (routingMetadataStream.mode === 'auto') {
                                  routingMetadataStream.reason = improvedReason;
                                  console.log("[ROUTING] Updated routing.reason in backend state");
                                  
                                  // Send routing_update SSE event with full routing object
                                  controller.enqueue(
                                    encoder.encode(
                                      formatSSE("routing_update", {
                                        routing: routingMetadataStream,
                                        imageGist: gist
                                      })
                                    )
                                  );
                                  
                                  console.log("[ROUTING] emitted routing_update SSE event");
                                  
                                  if (isDev) {
                                    console.log('[IMAGE_GIST_DEBUG] ✓ routing_update SSE emitted with full routing object');
                                    console.log('[IMAGE_GIST_DEBUG] Frontend should now display IMAGE_GIST-derived reason');
                                  }
                                } else {
                                  if (isDev) {
                                    console.warn('[IMAGE_GIST_DEBUG] Skipping routing update - not in auto mode');
                                  }
                                }
                                
                                // Store gist for potential future use
                                visionModelResponses.set(`${modelId}_gist`, JSON.stringify(gist));
                              } else {
                                if (isDev) {
                                  console.warn('[IMAGE_GIST_DEBUG] Failed to parse IMAGE_GIST');
                                  console.warn('[IMAGE_GIST_DEBUG] Parse error:', parseError);
                                  console.warn('[IMAGE_GIST_DEBUG] Response being parsed:', newResponse.substring(0, 500));
                                }
                                console.warn("Failed to parse IMAGE_GIST from vision model response");
                              }
                            } else if (isDev && newResponse.length >= 800 && !imageGistExtracted && !newResponse.includes("IMAGE_GIST:")) {
                              // Log when we've accumulated 800 chars but still no IMAGE_GIST
                              console.warn('[IMAGE_GIST_DEBUG] ========================================');
                              console.warn('[IMAGE_GIST_DEBUG] WARNING: 800+ chars received but no IMAGE_GIST found');
                              console.warn('[IMAGE_GIST_DEBUG] Accumulated response length:', newResponse.length);
                              console.warn('[IMAGE_GIST_DEBUG] First 800 chars:');
                              console.warn(newResponse.substring(0, 800));
                              console.warn('[IMAGE_GIST_DEBUG] ========================================');
                              console.warn('[IMAGE_GIST_DEBUG] IMAGE_GIST missing from Gemini output, keeping safe generic reason');
                              imageGistExtracted = true; // Mark as extracted to avoid repeated warnings
                            }
                          }
                        } catch (parseErr) {
                          console.error("Failed to parse chunk for IMAGE_GIST:", parseErr);
                        }
                      }
                    }
                    
                    // Strip IMAGE_GIST line from chunks before forwarding to frontend
                    let forwardEvent = sseEvent;
                    if (isVisionModel && sseEvent.includes('"chunk"')) {
                      try {
                        const chunkMatch = sseEvent.match(/"delta":"([^"]*)"/);
                        if (chunkMatch && chunkMatch[1]) {
                          const rawDelta = chunkMatch[1];
                          // Check if this chunk contains IMAGE_GIST (before unescaping, check raw)
                          if (rawDelta.includes("IMAGE_GIST:")) {
                            const isDev = process.env.NODE_ENV !== "production";
                            if (isDev) {
                              console.log("[ROUTING] Stripping IMAGE_GIST from chunk before forwarding to frontend");
                            }
                            
                            // Unescape to process
                            const unescapedDelta = rawDelta.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
                            const lines = unescapedDelta.split('\n');
                            const filteredLines = lines.filter(line => !line.includes("IMAGE_GIST:"));
                            const cleanedText = filteredLines.join('\n').trim();
                            
                            // Re-escape for JSON
                            const reescapedText = cleanedText.replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/"/g, '\\"');
                            
                            // Reconstruct the SSE event with cleaned text
                            forwardEvent = sseEvent.replace(
                              /"delta":"([^"]*)"/,
                              `"delta":"${reescapedText}"`
                            );
                            
                            if (isDev) {
                              console.log("[ROUTING] IMAGE_GIST line stripped successfully");
                            }
                          }
                        }
                      } catch (stripErr) {
                        console.error("Failed to strip IMAGE_GIST from chunk:", stripErr);
                      }
                    }
                    
                    controller.enqueue(encoder.encode(forwardEvent));
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

            // Wait for Phase B (routing reason) if it's still running.
            // Use a timeout so a slow/stuck Phase B doesn't block the stream indefinitely.
            if (phaseBPromise) {
              try {
                await Promise.race([
                  phaseBPromise,
                  new Promise<void>((resolve) => setTimeout(resolve, 8000)), // 8s max wait
                ]);
              } catch {
                // Phase B errors are non-fatal — already handled in the .catch() above
              }
            }

            // Send completion event
            controller.enqueue(
              encoder.encode(formatSSE("complete", { requestId }))
            );
          } catch (err) {
            console.error("SSE stream error:", err);
          } finally {
            // ── Fire-and-forget: persist routing decision ──────────
            // Only persist auto-select decisions (not manual mode).
            // This runs AFTER the stream closes — zero latency impact.
            // Uses `routingMetadata` (outer scope) since `routingMetadataStream`
            // is a const alias inside the start() function body.
            const responseTimeMs = Date.now() - modelDispatchStart;
            if (anonymousId && routingMetadata.mode === "auto") {
              const classification = classifyPrompt(prompt);
              // Dynamic import to avoid loading Prisma during build
              import("@/lib/db/persist-routing").then(({ persistAutoSelect }) => {
                persistAutoSelect({
                  prompt,
                  anonymousId,
                  routing: {
                    intent: routingMetadata.intent,
                    category: routingMetadata.category,
                    chosenModel: routingMetadata.chosenModel,
                    confidence: routingMetadata.confidence,
                  },
                  scoring: routingMetadata.scoring ?? null,
                  classification: {
                    taskType: classification.taskType,
                    stakes: classification.stakes,
                    inputSignals: classification.inputSignals as unknown as Record<string, boolean>,
                  },
                  responseTimeMs,
                }).catch((err) => {
                  console.error("[DB] Fire-and-forget persistence failed:", err);
                });
              }).catch((err) => {
                console.error("[DB] Failed to load persistence module:", err);
              });
            }
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
