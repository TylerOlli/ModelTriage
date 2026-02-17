/**
 * Client-side Prompt Cache
 *
 * Stores prompts in localStorage keyed by their SHA-256 hash.
 * Used to display prompt text on the dashboard by matching
 * against the promptHash stored in RoutingDecision rows.
 *
 * The hash function uses the same normalization as the server-side
 * hashPrompt in lib/db/persist-routing.ts: toLowerCase().trim() + SHA-256.
 * This guarantees hashes match across client and server.
 *
 * Privacy: Prompts are stored only in the user's browser.
 * They are never sent to the server or stored in the database.
 */

const CACHE_KEY = "mt_prompt_cache";
const MAX_ENTRIES = 200;

interface CachedPrompt {
  text: string;
  timestamp: number;
}

/**
 * Compute SHA-256 hash of a prompt using the Web Crypto API.
 * Uses the same normalization as the server: toLowerCase().trim()
 */
export async function hashPromptClient(prompt: string): Promise<string> {
  const normalized = prompt.toLowerCase().trim();
  const encoded = new TextEncoder().encode(normalized);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Save a prompt to the local cache, keyed by its hash.
 * Automatically trims the cache to MAX_ENTRIES if it grows too large.
 */
export async function cachePrompt(prompt: string): Promise<void> {
  const trimmed = prompt.trim();
  if (!trimmed) return;

  try {
    const hash = await hashPromptClient(trimmed);
    const cache = loadCache();

    cache[hash] = { text: trimmed, timestamp: Date.now() };

    // Trim to MAX_ENTRIES, keeping most recent
    const entries = Object.entries(cache);
    if (entries.length > MAX_ENTRIES) {
      entries.sort(([, a], [, b]) => b.timestamp - a.timestamp);
      const trimmedCache = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmedCache));
    } else {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }
  } catch {
    // Non-critical — if crypto or localStorage fails, silently skip
  }
}

/**
 * Load the full prompt cache from localStorage.
 * Returns a map of promptHash → { text, timestamp }.
 */
export function loadCache(): Record<string, CachedPrompt> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Look up a prompt by its hash.
 * Returns the prompt text if found, null otherwise.
 */
export function lookupPrompt(
  cache: Record<string, CachedPrompt>,
  promptHash: string
): string | null {
  return cache[promptHash]?.text ?? null;
}
