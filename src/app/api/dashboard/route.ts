/**
 * Dashboard API
 *
 * Returns usage analytics and routing decision history
 * for the authenticated user.
 *
 * GET /api/dashboard
 *   - Requires authentication
 *   - Returns: todayUsage, totalRequests, dailyCounts (last 14 days),
 *     modelDistribution, recentDecisions (paginated)
 *
 * Query params:
 *   - page (default 1)
 *   - limit (default 25, max 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, getUserProfile } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDailyLimit, type UserRole } from "@/lib/auth/gates";
import { reportError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSession();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = sessionUser.id;
    const profile = await getUserProfile(userId);
    const role = (profile?.role as UserRole) ?? "free";

    // Parse pagination
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    // ── Today's usage ────────────────────────────────────────
    const today = getToday();
    const todayRecord = await prisma.dailyUsage.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    const dailyLimit = getDailyLimit(role);
    const todayUsage = {
      used: todayRecord?.count ?? 0,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - (todayRecord?.count ?? 0)),
    };

    // ── Total requests (all time) ─────────────────────────────
    const totalResult = await prisma.dailyUsage.aggregate({
      where: { userId },
      _sum: { count: true },
    });
    const totalRequests = totalResult._sum.count ?? 0;

    // ── Daily counts (last 14 days) ────────────────────────────
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);
    fourteenDaysAgo.setUTCHours(0, 0, 0, 0);

    const dailyRecords = await prisma.dailyUsage.findMany({
      where: {
        userId,
        date: { gte: fourteenDaysAgo },
      },
      orderBy: { date: "asc" },
    });

    // Fill in missing days with 0
    const dailyCounts: { date: string; count: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(fourteenDaysAgo);
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const record = dailyRecords.find(
        (r) => r.date.toISOString().split("T")[0] === dateStr
      );
      dailyCounts.push({ date: dateStr, count: record?.count ?? 0 });
    }

    // ── Model distribution ────────────────────────────────────
    const modelCounts = await prisma.routingDecision.groupBy({
      by: ["selectedModel"],
      where: { userId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const modelDistribution = modelCounts
      .filter((m) => m.selectedModel !== null)
      .map((m) => ({
        model: m.selectedModel!,
        count: m._count.id,
      }));

    // ── Recent routing decisions ───────────────────────────────
    const [decisions, totalDecisions] = await Promise.all([
      prisma.routingDecision.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          promptHash: true,
          mode: true,
          taskType: true,
          stakes: true,
          inputSignals: true,
          selectedModel: true,
          routingIntent: true,
          routingCategory: true,
          routingConfidence: true,
          expectedSuccess: true,
          confidence: true,
          keyFactors: true,
          responseTimeMs: true,
          modelsCompared: true,
          verdict: true,
          promptLength: true,
        },
      }),
      prisma.routingDecision.count({ where: { userId } }),
    ]);

    return NextResponse.json({
      todayUsage,
      totalRequests,
      dailyCounts,
      modelDistribution,
      recentDecisions: decisions,
      pagination: {
        page,
        limit,
        total: totalDecisions,
        totalPages: Math.ceil(totalDecisions / limit),
      },
    });
  } catch (err) {
    reportError(err, { context: "dashboard-api" });
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

function getToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
