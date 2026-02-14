/**
 * Supabase Client — Server (API Routes, Server Components, Middleware)
 *
 * Creates a Supabase client that reads/writes auth cookies via
 * Next.js `cookies()`. Must be called inside a server context
 * (API route handler, Server Component, or middleware).
 *
 * Each request gets its own client instance — do NOT cache this
 * across requests.
 *
 * Usage:
 *   import { createSupabaseServer } from "@/lib/auth/supabase-server";
 *   const supabase = await createSupabaseServer();
 *   const { data: { user } } = await supabase.auth.getUser();
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Support both the legacy name (ANON_KEY) and the new Supabase dashboard name (PUBLISHABLE_DEFAULT_KEY)
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  "";

export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` can fail in Server Components (read-only context).
            // This is expected — the middleware handles cookie refresh.
          }
        },
      },
    }
  );
}
