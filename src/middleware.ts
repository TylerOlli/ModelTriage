/**
 * Next.js Middleware — Supabase Auth Session Refresh
 *
 * This middleware runs on every matched request to keep the
 * Supabase auth cookie alive. It does NOT perform any business
 * logic, database calls, or limit enforcement.
 *
 * Why middleware? Supabase Auth uses short-lived JWTs stored in
 * cookies. The middleware calls `getUser()` which triggers a
 * token refresh if the JWT is expired. Without this, users would
 * get silently logged out when their token expires.
 *
 * Limit enforcement happens in the API route handlers (not here)
 * because middleware runs on the Edge Runtime by default where
 * Prisma doesn't work well.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Support both the legacy name (ANON_KEY) and the new Supabase dashboard name (PUBLISHABLE_DEFAULT_KEY)
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  "";

export async function middleware(request: NextRequest) {
  // Dev bypass — skip auth session refresh entirely when auth is disabled.
  // Avoids a wasted round-trip to Supabase on every request during development.
  if (process.env.AUTH_DISABLED === "true") {
    return NextResponse.next({ request });
  }

  // Skip middleware for API routes — they validate auth independently
  // using local JWT validation (getSession). No need to refresh the
  // session twice. This saves ~100-200ms on every API call.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Forward cookie changes to the request (for downstream handlers)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Also set on response (so the browser gets updated cookies)
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session — this is the only purpose of this middleware.
  // Do NOT use getSession() here — getUser() validates the JWT server-side.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icons, manifest (static assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon-.*|apple-touch-icon|manifest).*)",
  ],
};
