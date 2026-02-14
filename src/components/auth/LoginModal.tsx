"use client";

/**
 * Login / Sign Up Modal
 *
 * Email/password authentication.
 * Matches the existing ModelTriage design language:
 *   - White card with neutral borders
 *   - Blue accent for primary actions
 *   - Clean, minimal typography
 */

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/auth/supabase-browser";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional message shown above the form (e.g., limit-exceeded nudge) */
  message?: string;
}

export function LoginModal({ open, onClose, message }: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const supabase = createSupabaseBrowser();

  if (!open) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        setEmailSent(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onClose();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setEmail("");
    setPassword("");
    setError(null);
    setEmailSent(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => {
          resetState();
          onClose();
        }}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-md mx-4 p-8 animate-enter">
        {/* Close button */}
        <button
          onClick={() => {
            resetState();
            onClose();
          }}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-neutral-900">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h2>
          {message && (
            <p className="text-sm text-neutral-500 mt-2">{message}</p>
          )}
          {!message && (
            <p className="text-sm text-neutral-500 mt-2">
              {mode === "signup"
                ? "Sign up to continue using ModelTriage"
                : "Sign in to your account"}
            </p>
          )}
        </div>

        {emailSent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="text-sm text-neutral-700 font-medium">Check your email</p>
            <p className="text-sm text-neutral-500 mt-1">
              We sent a confirmation link to <strong>{email}</strong>
            </p>
            <button
              onClick={() => {
                resetState();
                onClose();
              }}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Email form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
                />
              </div>
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading
                  ? "Please wait..."
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            {/* Toggle mode */}
            <p className="text-center text-sm text-neutral-500 mt-5">
              {mode === "signup" ? (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Sign up
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
