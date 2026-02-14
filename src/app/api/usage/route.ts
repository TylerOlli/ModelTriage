/**
 * Usage Info API
 *
 * Returns the current user's usage stats and limits.
 * Called by the frontend to display remaining requests
 * and show upgrade prompts at the right time.
 *
 * GET /api/usage
 *   - Authenticated: returns daily usage + limit for their role
 *   - Anonymous (with ?fingerprint=): returns lifetime usage + limit
 *   - No identity: returns zeroed-out response
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, getUserProfile } from "@/lib/auth/session";
import { getCurrentUsage } from "@/lib/auth/limits";
import { getUsageLimitInfo, type UserRole } from "@/lib/auth/gates";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSession();
    let userId: string | null = null;
    let role: UserRole | null = null;

    if (sessionUser) {
      userId = sessionUser.id;
      const profile = await getUserProfile(sessionUser.id);
      role = (profile?.role as UserRole) ?? "free";
    }

    // For anonymous users, fingerprint comes from query param
    const fingerprint = request.nextUrl.searchParams.get("fingerprint");

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
    console.error("Usage API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch usage info" },
      { status: 500 }
    );
  }
}
