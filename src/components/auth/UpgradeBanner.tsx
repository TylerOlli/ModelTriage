"use client";

/**
 * Upgrade Banner
 *
 * Shown inline when a logged-in free user is approaching their
 * daily limit (e.g., 3 or fewer remaining). Appears above the
 * prompt composer as a subtle, dismissible nudge.
 */

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function UpgradeBanner() {
  const { user, role, usage } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Only show for logged-in free users approaching their limit
  if (
    !user ||
    role !== "free" ||
    !usage ||
    usage.remaining > 3 ||
    dismissed
  ) {
    return null;
  }

  return (
    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-enter">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-2 h-2 bg-amber-400 rounded-full" />
        <p className="text-sm text-amber-800">
          {usage.remaining === 0 ? (
            <>You&apos;ve reached your daily limit. Resets at midnight UTC.</>
          ) : (
            <>
              {usage.remaining} request{usage.remaining !== 1 ? "s" : ""}{" "}
              remaining today.{" "}
              <Link href="/pricing" className="font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700">
                Upgrade to Pro
              </Link>
            </>
          )}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
