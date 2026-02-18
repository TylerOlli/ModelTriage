/**
 * API Key Revocation
 *
 * DELETE /api/keys/[id] — Revoke a specific API key (soft delete)
 */

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { id } = await params;

    // Verify the key belongs to this user
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId: user.id, revokedAt: null },
    });

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Soft revoke
    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API key revocation error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to revoke API key" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
