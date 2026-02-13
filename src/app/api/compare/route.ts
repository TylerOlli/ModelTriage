/**
 * API endpoint for generating comparison summaries
 * Server-side only to access LLM providers
 *
 * After generating the summary, persists the compare session
 * to the database (fire-and-forget) for future calibration.
 */

import { NextRequest, NextResponse } from "next/server";
import { diffAnalyzer } from "@/lib/diff";
import type { ModelResponse } from "@/lib/diff/types";
import { persistCompare } from "@/lib/db/persist-routing";

export const runtime = "nodejs";

interface ComparisonRequest {
  responses: ModelResponse[];
  /** Anonymous browser UUID for routing analytics */
  anonymousId?: string;
  /** Raw prompt text (will be hashed, not stored raw) */
  prompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ComparisonRequest;
    const { responses, anonymousId, prompt } = body;

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
    // Only persist if we have the anonymous ID and prompt.
    if (anonymousId && prompt) {
      persistCompare({
        prompt,
        anonymousId,
        modelsCompared: responses.map((r) => r.model),
        diffSummary: summary,
      }).catch((err) => {
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
