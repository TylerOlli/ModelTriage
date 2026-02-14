"use client";

/**
 * Login / Sign Up Modal
 *
 * Email/password authentication with forgot-password support.
 * Matches the existing ModelTriage design language:
 *   - White card with neutral borders
 *   - Blue accent for primary actions
 *   - Clean, minimal typography
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { createSupabaseBrowser } from "@/lib/auth/supabase-browser";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional message shown above the form (e.g., limit-exceeded nudge) */
  message?: string;
}

// ─── Password Strength ────────────────────────────────────────
interface PasswordCheck {
  label: string;
  met: boolean;
}

function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains uppercase & lowercase", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
  ];
}

function isPasswordStrong(password: string): boolean {
  return getPasswordChecks(password).every((c) => c.met);
}

export function LoginModal({ open, onClose, message }: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resetState();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Autofocus email input when modal opens
  useEffect(() => {
    if (open) {
      // Small delay to let the modal animate in
      const timer = setTimeout(() => emailInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open, mode]);

  if (!open) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Enforce password strength on signup
      if (mode === "signup" && !isPasswordStrong(password)) {
        setError("Please meet all password requirements before continuing.");
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;

        // If the session exists immediately, email confirmation is disabled —
        // close the modal directly instead of showing "check your email".
        if (data.session) {
          resetState();
          onClose();
        } else {
          setEmailSent(true);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        resetState();
        onClose();
      }
    } catch (err: unknown) {
      let errMessage =
        err instanceof Error ? err.message : "Authentication failed";

      // Friendlier message for "already registered" edge case
      if (mode === "signup" && errMessage.toLowerCase().includes("already registered")) {
        errMessage = "This email is already registered. Try signing in instead.";
      }

      setError(errMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/auth/callback` }
      );
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error ? err.message : "Failed to send reset email";
      setError(errMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setEmail("");
    setPassword("");
    setError(null);
    setEmailSent(false);
    setResetSent(false);
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
            {mode === "forgot"
              ? "Reset your password"
              : mode === "signup"
                ? "Create your account"
                : "Welcome back"}
          </h2>
          {message && (
            <p className="text-sm text-neutral-500 mt-2">{message}</p>
          )}
          {!message && (
            <p className="text-sm text-neutral-500 mt-2">
              {mode === "forgot"
                ? "Enter your email and we\u2019ll send a reset link"
                : mode === "signup"
                  ? "Sign up to continue using ModelTriage"
                  : "Sign in to your account"}
            </p>
          )}
        </div>

        {/* Email confirmation sent */}
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

        /* Password reset sent */
        ) : resetSent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <p className="text-sm text-neutral-700 font-medium">Reset link sent</p>
            <p className="text-sm text-neutral-500 mt-1">
              Check <strong>{email}</strong> for a password reset link
            </p>
            <button
              onClick={() => {
                resetState();
                setMode("login");
              }}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Back to sign in
            </button>
          </div>

        /* Forgot password form */
        ) : mode === "forgot" ? (
          <>
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div>
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
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
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <p className="text-center text-sm text-neutral-500 mt-5">
              <button
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Back to sign in
              </button>
            </p>
          </>

        /* Login / Signup form */
        ) : (
          <>
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <input
                  ref={emailInputRef}
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
                  minLength={8}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
                />
              </div>

              {/* Password strength indicator (signup only) */}
              {mode === "signup" && password.length > 0 && (
                <div className="space-y-1 px-1">
                  {getPasswordChecks(password).map((check) => (
                    <div key={check.label} className="flex items-center gap-2 text-xs">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={check.met ? "#22c55e" : "#d4d4d4"}
                        strokeWidth="2.5"
                      >
                        {check.met ? (
                          <path d="M20 6L9 17l-5-5" />
                        ) : (
                          <circle cx="12" cy="12" r="8" />
                        )}
                      </svg>
                      <span className={check.met ? "text-green-600" : "text-neutral-400"}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || (mode === "signup" && !isPasswordStrong(password))}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading
                  ? "Please wait..."
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            {/* Forgot password (login mode only) */}
            {mode === "login" && (
              <p className="text-center text-sm mt-3">
                <button
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                  }}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  Forgot password?
                </button>
              </p>
            )}

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
