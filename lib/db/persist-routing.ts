/**
 * Routing Decision Persistence
 *
 * Async, fire-and-forget database writes for routing analytics.
 * Called after the SSE stream closes (auto-select) or after the
 * compare summary returns (compare mode).
 *
 * These writes NEVER block the user-facing response. If a write
 * fails, it logs the error and moves on — dropped data points
 * are acceptable for analytics; added latency is not.
 *
 * Privacy: Only prompt hashes are stored. Raw prompts and model
 * responses are never persisted.
 */

import { prisma } from "./prisma";
import type { ScoringResult } from "@/lib/llm/scoring-types";
import type { DiffSummary } from "@/lib/diff/types";

// ─── Hashing ────────────────────────────────────────────────────

/**
 * Generate a SHA-256 hash of the prompt for privacy-safe storage.
 * The prompt is lowercased and trimmed before hashing to normalize
 * minor variations (casing, trailing whitespace).
 */
async function hashPrompt(prompt: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256")
    .update(prompt.toLowerCase().trim())
    .digest("hex");
}

// ─── Auto-Select Persistence ────────────────────────────────────

export interface AutoSelectData {
  /** Raw prompt text (will be hashed, not stored) */
  prompt: string;
  /** Anonymous browser UUID from localStorage */
  anonymousId: string;
  /** Routing metadata from the intent router */
  routing: {
    intent?: string;
    category?: string;
    chosenModel?: string;
    confidence?: number;
  };
  /** Output of the scoring engine */
  scoring?: ScoringResult | null;
  /** Output of the prompt classifier */
  classification?: {
    taskType?: string;
    stakes?: string;
    inputSignals?: Record<string, boolean>;
  } | null;
}

/**
 * Persist an auto-select routing decision to the database.
 *
 * Call this AFTER the SSE stream has closed and the response
 * has been fully delivered to the user.
 *
 * This function is designed to be called with fire-and-forget:
 *   persistAutoSelect(data).catch(err => console.error(err));
 */
export async function persistAutoSelect(data: AutoSelectData): Promise<void> {
  try {
    const promptHash = await hashPrompt(data.prompt);

    await prisma.routingDecision.create({
      data: {
        anonymousId: data.anonymousId,
        promptHash,
        mode: "auto",

        // Classification
        taskType: data.classification?.taskType ?? null,
        stakes: data.classification?.stakes ?? null,
        inputSignals: data.classification?.inputSignals ?? undefined,

        // Routing
        selectedModel: data.routing.chosenModel ?? null,
        routingIntent: data.routing.intent ?? null,
        routingCategory: data.routing.category ?? null,
        routingConfidence: data.routing.confidence ?? null,

        // Scoring
        expectedSuccess: data.scoring?.expectedSuccess ?? null,
        confidence: data.scoring?.confidence ?? null,
        keyFactors: data.scoring?.keyFactors
          ? (data.scoring.keyFactors as unknown as any)
          : undefined,
      },
    });

    console.log("[DB] Persisted auto-select routing decision:", {
      promptHash: promptHash.substring(0, 12) + "...",
      model: data.routing.chosenModel,
      expectedSuccess: data.scoring?.expectedSuccess,
    });
  } catch (err) {
    // Non-fatal — log and move on. The user's response is already delivered.
    console.error("[DB] Failed to persist auto-select routing decision:", {
      error: err instanceof Error ? err.message : err,
      model: data.routing.chosenModel,
    });
  }
}

// ─── Compare Mode Persistence ───────────────────────────────────

export interface CompareData {
  /** Raw prompt text (will be hashed, not stored) */
  prompt: string;
  /** Anonymous browser UUID from localStorage */
  anonymousId: string;
  /** Model IDs that were compared */
  modelsCompared: string[];
  /** The structured comparison summary from the DiffAnalyzer */
  diffSummary: DiffSummary;
}

/**
 * Persist a compare-mode session to the database.
 *
 * Call this AFTER the diff summary has been generated and
 * returned to the frontend.
 *
 * Fire-and-forget:
 *   persistCompare(data).catch(err => console.error(err));
 */
export async function persistCompare(data: CompareData): Promise<void> {
  try {
    const promptHash = await hashPrompt(data.prompt);

    await prisma.routingDecision.create({
      data: {
        anonymousId: data.anonymousId,
        promptHash,
        mode: "compare",

        // Compare-specific fields
        modelsCompared: data.modelsCompared,
        diffSummary: data.diffSummary as any, // Prisma Json type
        verdict: data.diffSummary.verdict ?? null,
      },
    });

    console.log("[DB] Persisted compare session:", {
      promptHash: promptHash.substring(0, 12) + "...",
      models: data.modelsCompared,
      hasVerdict: !!data.diffSummary.verdict,
    });
  } catch (err) {
    // Non-fatal — log and move on.
    console.error("[DB] Failed to persist compare session:", {
      error: err instanceof Error ? err.message : err,
      models: data.modelsCompared,
    });
  }
}
