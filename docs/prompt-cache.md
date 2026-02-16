# Client-Side Prompt Cache

## Overview

ModelTriage stores prompt hashes (SHA-256) in the database for analytics, but never stores raw prompt text server-side. To display prompt text in the dashboard's routing history table, a client-side cache maps hashes back to the original text using `localStorage`.

## Privacy Design

```
User types prompt
  ↓
Client: cachePrompt(text)  →  localStorage (hash → text)
  ↓
Server: SHA-256(normalize(text))  →  PostgreSQL (promptHash column)
  ↓
Dashboard: loadCache() + lookupPrompt(cache, hash)  →  display text or "—"
```

- Raw prompts **never leave the browser** for storage
- The database only stores the SHA-256 hash
- If a user clears localStorage, prompt text is simply unavailable — hashes remain intact

## How It Works

### 1. Caching (on prompt submission)

When the user submits a prompt on the homepage, `cachePrompt(text)` is called. This:

1. Normalizes the text (trims whitespace, lowercases)
2. Computes SHA-256 hash using `crypto.subtle.digest()`
3. Stores `{ hash → text }` in `localStorage` under `mt_prompt_cache`
4. Caps the cache at 200 entries (evicts oldest when full)

### 2. Server-Side Hashing

The API route (`/api/stream`) normalizes and hashes the prompt identically:

```
SHA-256(prompt.trim().toLowerCase())
```

This produces the same hash as the client, enabling lookup.

### 3. Lookup (in dashboard)

The dashboard loads the cache on mount via `loadCache()` and uses `lookupPrompt(cache, promptHash)` to display the original text next to each routing decision.

If the prompt isn't in the cache (e.g., cleared storage, different browser), the cell shows "—".

## API

### `cachePrompt(text: string): Promise<void>`
Hashes and stores the prompt in localStorage. Called from `handleSubmit` and `handleFollowUpSubmit` in `page.tsx`.

### `loadCache(): Record<string, string>`
Reads the entire cache from localStorage. Returns `{}` if empty or missing.

### `lookupPrompt(cache: Record<string, string>, hash: string): string | null`
Returns the cached prompt text for a given hash, or `null` if not found.

## Storage Details

- **Key:** `mt_prompt_cache`
- **Format:** JSON object `{ [sha256Hash]: promptText }`
- **Max entries:** 200 (oldest evicted first)
- **Persistence:** survives page reloads, cleared on explicit localStorage clear

## Implementation Files

- `lib/prompt-cache.ts` — `cachePrompt()`, `loadCache()`, `lookupPrompt()`, hashing utilities
- `src/app/page.tsx` — calls `cachePrompt()` on submit
- `src/app/dashboard/page.tsx` — calls `loadCache()` and `lookupPrompt()` to display prompt text

## Edge Cases

- **Multiple browsers/devices:** Cache is per-browser; prompts from other devices won't display text
- **Incognito mode:** Cache is lost when the window closes
- **Cache eviction:** After 200 prompts, the oldest entries are removed
- **Hash collisions:** Extremely unlikely with SHA-256 (2^256 space)
- **Normalization mismatch:** Both client and server use identical `trim().toLowerCase()` to ensure matching
