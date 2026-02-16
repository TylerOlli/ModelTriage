/**
 * Supabase Auth Callback
 *
 * Handles the OAuth redirect after a user signs in with a provider
 * (e.g., Google). Supabase redirects here with a `code` query param.
 * We exchange the code for a session and redirect to the app.
 *
 * Also handles email confirmation links (magic links).
 */

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If no code or exchange failed, redirect to home
  return NextResponse.redirect(`${origin}/`);
}
