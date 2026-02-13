/**
 * Fit score breakdown types and schema validation
 * 
 * Provides transparency into model routing decisions via a confidence-forward
 * scoring system. Each dimension represents how well the chosen model fits
 * the request characteristics.
 */

import { z } from "zod";

// ─── Fit Dimension Schema ───────────────────────────────────────

export const FitDimensionSchema = z.object({
  key: z.string(),
  label: z.string(),
  raw: z.number().min(0).max(10),
  display: z.number().min(7).max(10),
  note: z.string().min(4).max(50), // 4-50 chars: brief but informative
});

export type FitDimension = z.infer<typeof FitDimensionSchema>;

// ─── Overall Fit Schema ─────────────────────────────────────────

export const OverallFitSchema = z.object({
  raw: z.number().min(0).max(10),
  display: z.number().min(7).max(10),
});

export type OverallFit = z.infer<typeof OverallFitSchema>;

// ─── Fit Breakdown Schema ───────────────────────────────────────

export const FitBreakdownSchema = z.object({
  shortWhy: z.string().min(10).max(150), // One sentence
  overallFit: OverallFitSchema,
  fitBreakdown: z.array(FitDimensionSchema).min(1).max(5),
});

export type FitBreakdown = z.infer<typeof FitBreakdownSchema>;

// ─── Display Score Mapping ──────────────────────────────────────

/**
 * Map raw score (0-10) to display score (7-10)
 * This ensures all displayed scores look confident
 */
export function mapToDisplayScore(raw: number): number {
  const mapped = 7 + raw * 0.3;
  return Math.round(mapped * 10) / 10; // Round to 1 decimal
}

// ─── Dimension Weights ──────────────────────────────────────────

export const DIMENSION_WEIGHTS = {
  reasoningFit: 0.3,
  outputMatch: 0.25,
  costEfficiency: 0.2,
  speedFit: 0.15,
  recencyFit: 0.1,
};

// ─── Dimension Metadata ─────────────────────────────────────────

export interface DimensionMetadata {
  label: string;
  description: string;
}

export const FIT_DIMENSION_INFO: Record<string, DimensionMetadata> = {
  reasoningFit: {
    label: "Reasoning Fit",
    description: "How well the model handles this reasoning complexity",
  },
  outputMatch: {
    label: "Output Match",
    description: "How well the model produces the required output format",
  },
  costEfficiency: {
    label: "Cost Efficiency",
    description: "How cost-effective this model is for this task",
  },
  speedFit: {
    label: "Speed Fit",
    description: "How well the model's speed matches the need",
  },
  recencyFit: {
    label: "Recency Fit",
    description: "How current the model's knowledge needs to be",
  },
};

// ─── Validation Helpers ─────────────────────────────────────────

/**
 * Validate a fit breakdown object at runtime
 * Returns validated data or throws with clear error messages
 */
export function validateFitBreakdown(data: unknown): FitBreakdown {
  return FitBreakdownSchema.parse(data);
}

/**
 * Safe validation that returns success/error result
 */
export function safeValidateFitBreakdown(
  data: unknown
): { success: true; data: FitBreakdown } | { success: false; error: string } {
  const result = FitBreakdownSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Calculate overall fit from dimension scores using weighted average
 */
export function calculateOverallFit(dimensions: FitDimension[]): OverallFit {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of dimensions) {
    const weight = DIMENSION_WEIGHTS[dim.key as keyof typeof DIMENSION_WEIGHTS] || 0;
    weightedSum += dim.raw * weight;
    totalWeight += weight;
  }

  const raw = totalWeight > 0 ? weightedSum / totalWeight : 8; // Default to 8 if no weights
  const display = mapToDisplayScore(raw);

  return { raw, display };
}

/**
 * Create a default fit breakdown (used for fallback scenarios)
 */
export function createDefaultFitBreakdown(): FitBreakdown {
  const dimensions: FitDimension[] = [
    {
      key: "reasoningFit",
      label: "Reasoning Fit",
      raw: 8,
      display: mapToDisplayScore(8),
      note: "Well-suited for this reasoning level",
    },
    {
      key: "outputMatch",
      label: "Output Match",
      raw: 8,
      display: mapToDisplayScore(8),
      note: "Good format alignment",
    },
    {
      key: "costEfficiency",
      label: "Cost Efficiency",
      raw: 8,
      display: mapToDisplayScore(8),
      note: "Balanced cost-quality ratio",
    },
    {
      key: "speedFit",
      label: "Speed Fit",
      raw: 8,
      display: mapToDisplayScore(8),
      note: "Appropriate response speed",
    },
  ];

  return {
    shortWhy: "This model offers balanced capabilities for general-purpose tasks.",
    overallFit: calculateOverallFit(dimensions),
    fitBreakdown: dimensions,
  };
}
