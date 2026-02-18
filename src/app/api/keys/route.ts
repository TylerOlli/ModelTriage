/**
 * API Key Management
 *
 * POST /api/keys — Create a new API key (Pro only)
 * GET /api/keys — List active API keys
 */

import { getSession, getUserProfile } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateApiKey, canCreateKey, MAX_ACTIVE_KEYS } from "@/lib/api-keys";

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const profile = await getUserProfile(user.id);
    if (profile?.role !== "pro") {
      return new Response(
        JSON.stringify({
          error: "API keys require a Pro plan",
          upgrade: "/pricing",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check key limit
    const allowed = await canCreateKey(user.id);
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: `Maximum of ${MAX_ACTIVE_KEYS} active API keys allowed`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse optional label
    let label: string | null = null;
    try {
      const body = await request.json();
      if (body.label && typeof body.label === "string") {
        label = body.label.trim().substring(0, 50);
      }
    } catch {
      // No body or invalid JSON — label stays null
    }

    // Generate and store key
    const { fullKey, keyHash, keyPrefix } = generateApiKey();

    await prisma.apiKey.create({
      data: {
        userId: user.id,
        keyHash,
        keyPrefix,
        label,
      },
    });

    // Return the full key — this is the ONLY time it's shown
    return new Response(
      JSON.stringify({
        key: fullKey,
        prefix: keyPrefix,
        label,
        message: "Save this key — it won't be shown again.",
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("API key creation error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create API key" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id, revokedAt: null },
      select: {
        id: true,
        keyPrefix: true,
        label: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API key list error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to list API keys" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
