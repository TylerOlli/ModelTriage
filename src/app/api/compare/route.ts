/**
 * API endpoint for generating comparison summaries
 * Server-side only to access LLM providers
 */

import { NextRequest, NextResponse } from "next/server";
import { diffAnalyzer } from "@/lib/diff";
import type { ModelResponse } from "@/lib/diff/types";

export const runtime = "nodejs";

interface ComparisonRequest {
  responses: ModelResponse[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ComparisonRequest;
    const { responses } = body;

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

    // Generate comparison summary
    const summary = await diffAnalyzer.analyze(responses);

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
