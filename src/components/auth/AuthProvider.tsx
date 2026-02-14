"use client";

/**
 * Auth Context Provider
 *
 * Wraps the app with auth state. Listens for Supabase auth state
 * changes and exposes the current user, role, and usage info
 * via the `useAuth()` hook.
 *
 * Placed in layout.tsx so auth state is available everywhere
 * without prop drilling or adding state to page.tsx.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createSupabaseBrowser } from "@/lib/auth/supabase-browser";
import type { User } from "@supabase/supabase-js";

interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  period: "lifetime" | "daily";
  label: string;
}

interface AuthContextValue {
  user: User | null;
  role: "free" | "pro" | null;
  usage: UsageInfo | null;
  loading: boolean;
  /** Refresh usage info from the server */
  refreshUsage: () => Promise<void>;
  /** Sign out the current user */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  usage: null,
  loading: true,
  refreshUsage: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"free" | "pro" | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createSupabaseBrowser();

  // Fetch usage info from the API
  const refreshUsage = useCallback(async () => {
    try {
      // Build fingerprint for anonymous users
      let url = "/api/usage";
      if (!user) {
        const anonymousId = localStorage.getItem("mt_anonymous_id");
        if (anonymousId) {
          // We can't hash client-side the same way as the server,
          // so we pass the anonymousId and let the server handle fingerprinting
          // Actually, the usage API expects a pre-hashed fingerprint.
          // For simplicity, we'll pass the raw anonymousId as a query param
          // and create a separate endpoint or adjust usage route.
          // For now, skip anonymous usage display — the API enforces it anyway.
        }
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRole(data.role ?? null);
        setUsage({
          used: data.used,
          limit: data.limit,
          remaining: data.remaining,
          period: data.period,
          label: data.label,
        });
      }
    } catch {
      // Non-critical — usage display is best-effort
    }
  }, [user]);

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      const {
        data: { user: initialUser },
      } = await supabase.auth.getUser();
      setUser(initialUser);
      setLoading(false);
    };

    initAuth();

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setRole(null);
        setUsage(null);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch usage whenever user changes
  useEffect(() => {
    if (!loading) {
      refreshUsage();
    }
  }, [user, loading, refreshUsage]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setUsage(null);
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{ user, role, usage, loading, refreshUsage, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
