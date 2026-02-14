/**
 * Feature Gates — Centralized Access Control
 *
 * Single source of truth for "what can this user do?"
 * All role checks and feature flags go through this module.
 * No role checks should be scattered across components or routes.
 *
 * Limits are read from environment variables with sensible defaults.
 * This lets you tune limits without redeploying.
 *
 * Usage:
 *   import { getUsageLimit, canAccessFeature } from "@/lib/auth/gates";
 *   const limit = getUsageLimit(role);
 *   const allowed = canAccessFeature(role, "compare_mode");
 */

export type UserRole = "free" | "pro";

// ─── Usage Limits ─────────────────────────────────────────────

/** Lifetime cap for anonymous (not logged in) users */
export function getAnonymousLimit(): number {
  return parseInt(process.env.ANONYMOUS_MAX_REQUESTS || "3", 10);
}

/** Daily request cap for authenticated users based on role */
export function getDailyLimit(role: UserRole): number {
  switch (role) {
    case "pro":
      return parseInt(process.env.PRO_DAILY_LIMIT || "200", 10);
    case "free":
    default:
      return parseInt(process.env.FREE_DAILY_LIMIT || "15", 10);
  }
}

/** Get usage limit info for display purposes */
export function getUsageLimitInfo(role: UserRole | null): {
  limit: number;
  period: "lifetime" | "daily";
  label: string;
} {
  if (!role) {
    return {
      limit: getAnonymousLimit(),
      period: "lifetime",
      label: "Sign up to continue",
    };
  }

  return {
    limit: getDailyLimit(role),
    period: "daily",
    label: role === "pro" ? "Pro plan" : "Free plan",
  };
}

// ─── Feature Flags ────────────────────────────────────────────

type Feature =
  | "compare_mode"
  | "auto_select"
  | "file_attachments"
  | "follow_up";

/**
 * Check if a role has access to a specific feature.
 * Phase 1: All features are available to all roles.
 * Extend this when adding pro-only features.
 */
export function canAccessFeature(
  role: UserRole | null,
  feature: Feature
): boolean {
  // Phase 1: all features available to everyone (including anonymous)
  // The only restriction is usage limits, not feature access.
  switch (feature) {
    case "compare_mode":
    case "auto_select":
    case "file_attachments":
    case "follow_up":
      return true;
    default:
      return false;
  }
}

/**
 * Maximum number of models in compare mode based on role.
 * Free users can compare 2 models. Pro can compare 3.
 */
export function getMaxCompareModels(role: UserRole | null): number {
  if (role === "pro") return 3;
  return 2;
}
