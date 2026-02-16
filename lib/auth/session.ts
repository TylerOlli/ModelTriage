/**
 * Auth Session Utilities
 *
 * Server-side helpers to get the current user and their profile.
 * Combines Supabase Auth (session/JWT) with Prisma (app data).
 *
 * Two session functions:
 *   - getSession()       — Fast, local JWT validation (<1ms).
 *                          Use for API routes where the middleware already
 *                          validated the session on page load.
 *   - getSessionSecure() — Network call to Supabase to verify the JWT.
 *                          Use for sensitive operations (account deletion).
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

// ─── Profile Cache ────────────────────────────────────────────
// UserProfile rarely changes (only on role upgrade). Cache it
// in memory with a short TTL to avoid a DB round-trip on every
// API request. The cache is per-process — on serverless this
// lives for the duration of a warm instance (~5-15 minutes).

const PROFILE_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

interface CachedProfile {
  profile: UserProfile;
  expiresAt: number;
}

const profileCache = new Map<string, CachedProfile>();

/**
 * Get the current authenticated user via local JWT validation.
 * Returns null if no valid session exists.
 *
 * Uses `getSession()` from Supabase which validates the JWT
 * locally without a network round-trip (~0ms vs ~100-300ms).
 * The JWT is cryptographically signed, so it can't be forged.
 *
 * Safe because the middleware already calls `getUser()` on
 * page loads to refresh expired tokens.
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.user) return null;

    return {
      id: session.user.id,
      email: session.user.email,
    };
  } catch {
    // Cookie parsing can fail in certain contexts — treat as unauthenticated
    return null;
  }
}

/**
 * Get the current authenticated user via server-side validation.
 * Makes a network call to Supabase to verify the JWT is still valid.
 *
 * Use this ONLY for sensitive operations (e.g., account deletion)
 * where you need to confirm the session hasn't been revoked.
 */
export async function getSessionSecure(): Promise<SessionUser | null> {
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
    return null;
  }
}

/**
 * Get the UserProfile from the database for a given user ID.
 * Uses an in-memory cache (5-minute TTL) to avoid a DB query
 * on every request. Cache is automatically invalidated when
 * the serverless instance recycles.
 *
 * Returns null if the profile doesn't exist (shouldn't happen
 * if the Supabase trigger is set up correctly).
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  // Check cache first
  const cached = profileCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.profile;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { id: userId },
  });

  if (profile) {
    profileCache.set(userId, {
      profile,
      expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
    });
  }

  return profile;
}

/**
 * Invalidate the cached profile for a user.
 * Call this when the user's role changes or account is deleted.
 */
export function invalidateProfileCache(userId: string): void {
  profileCache.delete(userId);
}
