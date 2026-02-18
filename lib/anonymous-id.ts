/**
 * Anonymous User ID
 *
 * Get-or-create a random UUID stored in localStorage.
 * Used to build the anonymous usage fingerprint (hashed with IP server-side).
 *
 * Shared across AuthProvider (usage display) and page.tsx (request body)
 * so the ID is guaranteed to exist before the first usage check fires.
 */

const STORAGE_KEY = "mt_anonymous_id";

export function getAnonymousId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
