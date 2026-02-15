/**
 * Data Export API
 *
 * Downloads all user data as a JSON file.
 *
 * GET /api/account/export
 *   - Requires authentication
 *   - Returns JSON file with profile, usage, and routing decisions
 *   - Sets Content-Disposition for download
 */

import { NextResponse } from "next/server";
import { getSession, getUserProfile } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { reportError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
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

    // Fetch all user data in parallel
    const [usageRecords, routingDecisions] = await Promise.all([
      prisma.dailyUsage.findMany({
        where: { userId },
        orderBy: { date: "desc" },
      }),
      prisma.routingDecision.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          mode: true,
          promptHash: true,
          promptLength: true,
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
        },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: profile
        ? {
            id: profile.id,
            role: profile.role,
            createdAt: profile.createdAt,
          }
        : null,
      email: sessionUser.email,
      usage: usageRecords.map((r) => ({
        date: r.date.toISOString().split("T")[0],
        count: r.count,
      })),
      routingDecisions,
    };

    const json = JSON.stringify(exportData, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="modeltriage-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (err) {
    reportError(err, { context: "account-export" });
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
