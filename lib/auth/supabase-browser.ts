/**
 * Supabase Client — Browser (Client Components)
 *
 * Singleton Supabase client for use in React client components.
 * Uses `createBrowserClient` from @supabase/ssr which automatically
 * manages auth cookies in the browser environment.
 *
 * Usage:
 *   import { supabaseBrowser } from "@/lib/auth/supabase-browser";
 *   const { data: { user } } = await supabaseBrowser.auth.getUser();
 */

import { createBrowserClient } from "@supabase/ssr";

// Support both the legacy name (ANON_KEY) and the new Supabase dashboard name (PUBLISHABLE_DEFAULT_KEY)
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  "";

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey
  );
}
