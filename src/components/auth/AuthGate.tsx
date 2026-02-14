"use client";

/**
 * Auth Gate
 *
 * Inline component shown when a user hits their usage limit.
 * For anonymous users: prompts signup.
 * For free users: shows upgrade CTA.
 *
 * Designed to appear in place of the normal response area
 * when the API returns a 429 with `usage_limit_exceeded`.
 */

interface AuthGateProps {
  /** Whether the user needs to sign up (anonymous) or upgrade (free) */
  requiresAuth: boolean;
  /** Number of requests used */
  used: number;
  /** The limit that was exceeded */
  limit: number;
  /** Callback to open the login modal */
  onSignIn: () => void;
}

export function AuthGate({
  requiresAuth,
  used,
  limit,
  onSignIn,
}: AuthGateProps) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center animate-enter">
      {/* Icon */}
      <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      </div>

      {requiresAuth ? (
        <>
          <h3 className="text-lg font-semibold text-neutral-900 mb-1">
            You&apos;ve used all {limit} free requests
          </h3>
          <p className="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
            Create a free account to continue using ModelTriage. You&apos;ll get{" "}
            15 requests per day — no credit card required.
          </p>
          <button
            onClick={onSignIn}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Sign up free
          </button>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-neutral-900 mb-1">
            Daily limit reached
          </h3>
          <p className="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
            You&apos;ve used {used} of {limit} requests today.
            Your limit resets at midnight UTC.
          </p>
          <div className="text-sm text-neutral-500">
            Need more?{" "}
            <span className="text-blue-600 font-medium">
              Pro plan coming soon
            </span>
          </div>
        </>
      )}
    </div>
  );
}
