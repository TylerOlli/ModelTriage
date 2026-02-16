/**
 * Usage Info API
 *
 * Returns the current user's usage stats and limits.
 * Called by the frontend to display remaining requests
 * and show upgrade prompts at the right time.
 *
 * GET /api/usage
 *   - Authenticated: returns daily usage + limit for their role
 *   - Anonymous (with ?anonymousId=): hashes IP + anonymousId server-side,
 *     then looks up lifetime usage
 *   - No identity: returns zeroed-out response
 *
 * Rate-limited to prevent abuse (60 requests per minute per IP).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, getUserProfile } from "@/lib/auth/session";
import { getCurrentUsage, createFingerprint } from "@/lib/auth/limits";
import { getUsageLimitInfo, type UserRole } from "@/lib/auth/gates";
import { reportError } from "@/lib/errors";

export const runtime = "nodejs";

// ─── Simple in-memory rate limiter for this read-only endpoint ──
// This is acceptable here (unlike the old usage tracking) because:
//   1. It protects a read-only endpoint, not a billing boundary
//   2. Worst case on cache miss = extra DB reads, not free usage
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per IP

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Periodically clean up stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIP) return realIP;
  return "unknown";
}

export async function GET(request: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIP(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const sessionUser = await getSession();
    let userId: string | null = null;
    let role: UserRole | null = null;

    if (sessionUser) {
      userId = sessionUser.id;
      const profile = await getUserProfile(sessionUser.id);
      role = (profile?.role as UserRole) ?? "free";
    }

    // For anonymous users, build fingerprint server-side from IP + anonymousId
    let fingerprint: string | null = null;
    if (!userId) {
      const anonymousId = request.nextUrl.searchParams.get("anonymousId");
      if (anonymousId) {
        fingerprint = await createFingerprint(ip, anonymousId);
      }
    }

    const usage = await getCurrentUsage(userId, role, fingerprint);
    const limitInfo = getUsageLimitInfo(role);

    return NextResponse.json({
      authenticated: !!sessionUser,
      role,
      email: sessionUser?.email ?? null,
      ...usage,
      period: limitInfo.period,
      label: limitInfo.label,
    });
  } catch (err) {
    reportError(err, { context: "usage-api" });
    return NextResponse.json(
      { error: "Failed to fetch usage info" },
      { status: 500 }
    );
  }
}
