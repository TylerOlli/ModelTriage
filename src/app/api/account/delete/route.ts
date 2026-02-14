/**
 * Account Deletion API
 *
 * Permanently deletes a user's account and all associated data.
 *
 * DELETE /api/account/delete
 *
 * Steps:
 *   1. Verify the user is authenticated
 *   2. Delete app data (UserProfile cascades to DailyUsage)
 *   3. Delete the Supabase Auth user via admin API
 *   4. Nullify userId on RoutingDecision rows (preserve analytics)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY for admin user deletion.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@supabase/supabase-js";
import { reportError } from "@/lib/errors";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const sessionUser = await getSession();

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = sessionUser.id;

    // ── 1. Delete app data ───────────────────────────────────────
    // UserProfile has onDelete: Cascade for DailyUsage,
    // so deleting the profile removes all daily usage rows too.
    await prisma.userProfile.delete({
      where: { id: userId },
    }).catch(() => {
      // Profile might not exist (e.g., trigger didn't fire) — that's fine
    });

    // ── 2. Nullify userId on RoutingDecision rows ────────────────
    // Keep the analytics data but disassociate from the deleted user
    await prisma.routingDecision.updateMany({
      where: { userId },
      data: { userId: null },
    });

    // ── 3. Delete Supabase Auth user ─────────────────────────────
    // Requires the service role key (server-side only, never exposed)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      reportError(
        new Error("SUPABASE_SERVICE_ROLE_KEY not configured"),
        { context: "account-delete", userId }
      );
      return NextResponse.json(
        { error: "Account deletion is not configured. Please contact support." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    );

    if (deleteError) {
      reportError(deleteError, { context: "account-delete", userId });
      return NextResponse.json(
        { error: "Failed to delete auth account. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    reportError(err, { context: "account-delete" });
    return NextResponse.json(
      { error: "Account deletion failed. Please try again." },
      { status: 500 }
    );
  }
}
