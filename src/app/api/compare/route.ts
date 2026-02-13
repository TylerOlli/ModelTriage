/**
 * API endpoint for generating comparison summaries
 * Server-side only to access LLM providers
 *
 * After generating the summary, persists the compare session
 * to the database (fire-and-forget) with full analytics:
 *   - Prompt classification (same classifier as auto-select)
 *   - Shadow routing (what auto-select *would have* chosen)
 *   - Shadow scoring (Expected Success for the shadow pick)
 *   - Response timing
 *   - Diff summary with verdict
 */

import { NextRequest, NextResponse } from "next/server";
import { diffAnalyzer } from "@/lib/diff";
import type { ModelResponse } from "@/lib/diff/types";
import { persistCompare } from "@/lib/db/persist-routing";
import { classifyPrompt } from "@/lib/llm/prompt-classifier";
import { intentRouter } from "@/lib/llm/intent-router";
import { scoreForModel } from "@/lib/llm/scoring-engine";
import type { ModelId } from "@/lib/llm/types";

export const runtime = "nodejs";

interface ComparisonRequest {
  responses: ModelResponse[];
  /** Anonymous browser UUID for routing analytics */
  anonymousId?: string;
  /** Raw prompt text (will be hashed, not stored raw) */
  prompt?: string;
  /** Wall-clock time for all model streams to complete (ms) */
  responseTimeMs?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ComparisonRequest;
    const { responses, anonymousId, prompt, responseTimeMs } = body;

    // Validate input
    if (!Array.isArray(responses) || responses.length < 2) {
      return NextResponse.json(
        { error: "At least 2 responses are required for comparison" },
        { status: 400 }
      );
    }

    // Validate response structure
    for (const response of responses) {
      if (!response.model || !response.content) {
        return NextResponse.json(
          { error: "Invalid response format: missing model or content" },
          { status: 400 }
        );
      }
    }

    // Generate comparison summary (includes verdict)
    const summary = await diffAnalyzer.analyze(responses);

    // ── Fire-and-forget: persist compare session ──────────────
    // The entire block runs AFTER the response is returned.
    // Shadow routing involves an LLM call (1-5s) which must NOT
    // block the user from seeing the comparison summary.
    //
    // Classification (regex) and scoring (math) are instant.
    // Only intentRouter.route() is slow — it's an LLM call purely
    // for analytics, not for the user experience.
    if (anonymousId && prompt) {
      const modelsCompared = responses.map((r) => r.model);

      (async () => {
        let classification;
        let shadowRouting;
        let shadowScoring;

        try {
          // 1. Classify the prompt (deterministic, microseconds)
          classification = classifyPrompt(prompt);

          // 2. Shadow route — what would auto-select have picked? (LLM call, 1-5s)
          const decision = await intentRouter.route(prompt, false);
          shadowRouting = {
            intent: decision.intent,
            category: decision.category,
            chosenModel: decision.chosenModel,
            confidence: decision.confidence,
          };

          // 3. Shadow score — Expected Success for the router's pick (microseconds)
          shadowScoring = scoreForModel(prompt, decision.chosenModel as ModelId);
        } catch (err) {
          // Non-fatal — shadow routing/scoring is best-effort.
          // Classification alone is still valuable.
          console.error("[DB] Shadow routing failed (non-fatal):", {
            error: err instanceof Error ? err.message : err,
          });
        }

        await persistCompare({
          prompt,
          anonymousId,
          modelsCompared,
          diffSummary: summary,
          classification: classification
            ? {
                taskType: classification.taskType,
                stakes: classification.stakes,
                inputSignals: classification.inputSignals as unknown as Record<string, boolean>,
              }
            : null,
          shadowRouting: shadowRouting ?? null,
          shadowScoring: shadowScoring ?? null,
          responseTimeMs: responseTimeMs ?? null,
        });
      })().catch((err) => {
        console.error("[DB] Fire-and-forget compare persistence failed:", err);
      });
    }

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err) {
    console.error("Comparison summary API error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate comparison summary",
      },
      { status: 500 }
    );
  }
}
