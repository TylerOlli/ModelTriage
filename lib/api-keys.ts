/**
 * API Key Utilities
 *
 * Handles key generation, hashing, and validation.
 * Keys are prefixed with "mt_" and stored as SHA-256 hashes.
 */

import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { getUserProfile, invalidateProfileCache } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/gates";

const KEY_PREFIX = "mt_";
const MAX_ACTIVE_KEYS = 5;

/**
 * Generate a new API key.
 * Returns the full key (shown once to user) and the hash (stored in DB).
 */
export function generateApiKey(): { fullKey: string; keyHash: string; keyPrefix: string } {
  const random = randomBytes(32).toString("hex");
  const fullKey = `${KEY_PREFIX}${random}`;
  const keyHash = hashKey(fullKey);
  const keyPrefix = fullKey.substring(0, 11); // "mt_" + 8 chars
  return { fullKey, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256.
 */
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Resolve an API key to a user ID and role.
 * Returns null if the key is invalid, revoked, or the user doesn't exist.
 * Updates lastUsedAt on successful resolution.
 */
export async function resolveApiKey(
  bearerToken: string
): Promise<{ userId: string; role: UserRole } | null> {
  if (!bearerToken.startsWith(KEY_PREFIX)) {
    return null;
  }

  const keyHash = hashKey(bearerToken);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });

  if (!apiKey || apiKey.revokedAt) {
    return null;
  }

  const profile = await getUserProfile(apiKey.userId);
  if (!profile) {
    return null;
  }

  // Fire-and-forget: update lastUsedAt
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((err) => {
      console.error("[API Key] Failed to update lastUsedAt:", err);
    });

  return {
    userId: apiKey.userId,
    role: (profile.role as UserRole) ?? "free",
  };
}

/**
 * Get the count of active (non-revoked) keys for a user.
 */
export async function getActiveKeyCount(userId: string): Promise<number> {
  return prisma.apiKey.count({
    where: { userId, revokedAt: null },
  });
}

/**
 * Check if a user can create more API keys.
 */
export async function canCreateKey(userId: string): Promise<boolean> {
  const count = await getActiveKeyCount(userId);
  return count < MAX_ACTIVE_KEYS;
}

export { MAX_ACTIVE_KEYS };
