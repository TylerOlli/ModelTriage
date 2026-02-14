/**
 * Auth Session Utilities
 *
 * Server-side helpers to get the current user and their profile.
 * Combines Supabase Auth (session/JWT) with Prisma (app data).
 *
 * Usage in API routes:
 *   import { getSession, getUserProfile } from "@/lib/auth/session";
 *   const user = await getSession();
 *   const profile = user ? await getUserProfile(user.id) : null;
 */

import { createSupabaseServer } from "./supabase-server";
import { prisma } from "@/lib/db/prisma";
import type { UserProfile } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string | undefined;
}

/**
 * Get the current authenticated user from Supabase Auth.
 * Returns null if no valid session exists.
 *
 * Uses `getUser()` which validates the JWT server-side —
 * safer than `getSession()` which only checks the token locally.
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    return {
      id: user.id,
      email: user.email,
    };
  } catch {
    // Cookie parsing can fail in certain contexts — treat as unauthenticated
    return null;
  }
}

/**
 * Get the UserProfile from the database for a given user ID.
 * Returns null if the profile doesn't exist (shouldn't happen
 * if the Supabase trigger is set up correctly).
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  return prisma.userProfile.findUnique({
    where: { id: userId },
  });
}
