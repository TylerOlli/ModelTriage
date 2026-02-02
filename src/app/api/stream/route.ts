/**
 * Streaming API route using Server-Sent Events (SSE)
 * Streams LLM responses as they are generated
 */

import { MockProvider } from "@/lib/providers/mock-provider";
import { modelRouter } from "@/lib/routing";

// Force Node.js runtime (not Edge)
export const runtime = "nodejs";

interface StreamRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StreamRequest;
    const { prompt, model, maxTokens } = body;

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

    // Enforce max prompt length (4,000 characters per spec)
    if (prompt.length > 4000) {
      return new Response(
        JSON.stringify({ error: "Prompt exceeds maximum length of 4,000 characters" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Route to appropriate model
    const routingDecision = modelRouter.route({
      prompt,
      promptLength: prompt.length,
      requestedModel: model,
    });

    // Create provider and start streaming
    const provider = new MockProvider(50); // 50ms delay between chunks
    const response = provider.stream(prompt, {
      model: routingDecision.model,
      maxTokens: maxTokens || 800, // Default max tokens per spec
    });

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send routing decision first
          const routingMessage = {
            type: "routing",
            routing: {
              model: routingDecision.model,
              reason: routingDecision.reason,
              confidence: routingDecision.confidence,
            },
          };
          const sseRouting = `data: ${JSON.stringify(routingMessage)}\n\n`;
          controller.enqueue(encoder.encode(sseRouting));

          // Stream chunks as they arrive
          for await (const chunk of response.chunks) {
            const data = {
              type: "chunk",
              content: chunk.content,
              done: chunk.done,
            };

            // Format as SSE
            const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
          }

          // Send metadata when streaming completes
          const metadata = await response.metadata;
          const metadataMessage = {
            type: "metadata",
            metadata,
          };

          const sseMetadata = `data: ${JSON.stringify(metadataMessage)}\n\n`;
          controller.enqueue(encoder.encode(sseMetadata));

          // Close the stream
          controller.close();
        } catch (error) {
          // Send error event
          const errorMessage = {
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          };

          const sseError = `data: ${JSON.stringify(errorMessage)}\n\n`;
          controller.enqueue(encoder.encode(sseError));
          controller.close();
        }
      },

      cancel() {
        // Client disconnected - clean up if needed
        console.log("Stream cancelled by client");
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in stream route:", error);
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
