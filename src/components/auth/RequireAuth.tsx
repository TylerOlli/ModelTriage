"use client";

/**
 * Route Guard — RequireAuth
 *
 * Wraps page content that requires authentication.
 * Shows a loading spinner while auth state is initializing,
 * then redirects to the homepage if no user is found.
 *
 * Usage:
 *   export default function ProtectedPage() {
 *     return (
 *       <RequireAuth>
 *         {page content}
 *       </RequireAuth>
 *     );
 *   }
 */

import { useAuth } from "./AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
