/**
 * Usage Limit Enforcement
 *
 * Database-backed usage tracking with atomic increments.
 * Replaces the old in-memory rate limiter which was ineffective
 * on serverless (each invocation gets its own memory).
 *
 * Two tracking modes:
 *   1. Authenticated users — DailyUsage table (resets daily)
 *   2. Anonymous users — AnonymousUsage table (lifetime cap)
 *
 * The `checkAndIncrement` functions are atomic (Prisma upsert
 * with increment) to prevent race conditions when a user fires
 * multiple requests concurrently.
 *
 * Usage:
 *   import { checkUsageLimit } from "@/lib/auth/limits";
 *   const result = await checkUsageLimit(userId, role, fingerprint);
 *   if (!result.allowed) return Response(429);
 */

import { prisma } from "@/lib/db/prisma";
import { getAnonymousLimit, getDailyLimit, type UserRole } from "./gates";

// ─── Types ───────────────────────────────────────────────────

export interface UsageLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  /** Why the request was denied */
  reason?: "limit_exceeded" | "no_identity";
  /** True if the user needs to sign up (anonymous limit hit) */
  requiresAuth?: boolean;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Check usage limits and increment the counter atomically.
 *
 * Call this BEFORE processing the request. If `allowed` is false,
 * return a 429 response with the limit info.
 *
 * @param userId - Authenticated user ID (null for anonymous)
 * @param role - User role (null for anonymous)
 * @param fingerprint - Hash of IP + anonymousId (for anonymous tracking)
 */
export async function checkUsageLimit(
  userId: string | null,
  role: UserRole | null,
  fingerprint: string | null
): Promise<UsageLimitResult> {
  // Dev bypass — skip all limits when AUTH_DISABLED is set
  if (process.env.AUTH_DISABLED === "true") {
    return { allowed: true, remaining: 999, limit: 999, used: 0 };
  }

  // Authenticated user — daily limit
  if (userId && role) {
    return checkAuthenticatedUsage(userId, role);
  }

  // Anonymous user — lifetime limit
  if (fingerprint) {
    return checkAnonymousUsage(fingerprint);
  }

  // No identity at all — deny
  return {
    allowed: false,
    remaining: 0,
    limit: 0,
    used: 0,
    reason: "no_identity",
  };
}

/**
 * Get current usage without incrementing.
 * Used for display purposes (showing remaining count in UI).
 */
export async function getCurrentUsage(
  userId: string | null,
  role: UserRole | null,
  fingerprint: string | null
): Promise<{ used: number; limit: number; remaining: number }> {
  // Dev bypass — show unlimited when AUTH_DISABLED is set
  if (process.env.AUTH_DISABLED === "true") {
    return { used: 0, limit: 999, remaining: 999 };
  }

  if (userId && role) {
    const limit = getDailyLimit(role);
    const today = getToday();
    const record = await prisma.dailyUsage.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    const used = record?.count ?? 0;
    return { used, limit, remaining: Math.max(0, limit - used) };
  }

  if (fingerprint) {
    const limit = getAnonymousLimit();
    const record = await prisma.anonymousUsage.findUnique({
      where: { fingerprint },
    });
    const used = record?.count ?? 0;
    return { used, limit, remaining: Math.max(0, limit - used) };
  }

  return { used: 0, limit: 0, remaining: 0 };
}

// ─── Internal ────────────────────────────────────────────────

/**
 * Check and increment daily usage for an authenticated user.
 * Uses atomic upsert with increment — no TOCTOU race.
 */
async function checkAuthenticatedUsage(
  userId: string,
  role: UserRole
): Promise<UsageLimitResult> {
  const limit = getDailyLimit(role);
  const today = getToday();

  // Atomic: create or increment in a single SQL statement
  const record = await prisma.dailyUsage.upsert({
    where: { userId_date: { userId, date: today } },
    update: { count: { increment: 1 } },
    create: { userId, date: today, count: 1 },
  });

  const allowed = record.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - record.count),
    limit,
    used: record.count,
    reason: allowed ? undefined : "limit_exceeded",
  };
}

/**
 * Check and increment lifetime usage for an anonymous user.
 * Uses atomic upsert with increment — no TOCTOU race.
 */
async function checkAnonymousUsage(
  fingerprint: string
): Promise<UsageLimitResult> {
  const limit = getAnonymousLimit();

  // Atomic: create or increment in a single SQL statement
  const record = await prisma.anonymousUsage.upsert({
    where: { fingerprint },
    update: { count: { increment: 1 } },
    create: { fingerprint, count: 1 },
  });

  const allowed = record.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - record.count),
    limit,
    used: record.count,
    reason: allowed ? undefined : "limit_exceeded",
    requiresAuth: !allowed,
  };
}

/**
 * Get today's date truncated to midnight UTC.
 * Used as the partition key for DailyUsage.
 */
function getToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// ─── Fingerprinting ──────────────────────────────────────────

/**
 * Create a fingerprint for anonymous usage tracking.
 * Hashes IP + anonymousId to create a stable identifier
 * without storing raw PII.
 */
export async function createFingerprint(
  ip: string,
  anonymousId: string
): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256")
    .update(`${ip}:${anonymousId}`)
    .digest("hex");
}
