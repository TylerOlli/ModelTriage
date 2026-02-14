/**
 * Centralized Error Reporting
 *
 * Lightweight error logging that captures structured context.
 * Currently logs to console with structured metadata.
 *
 * To upgrade to Sentry, Axiom, or another service later:
 *   1. Install the SDK
 *   2. Replace the `reportError` body with the SDK's capture call
 *   3. Everything else stays the same — all callsites use this module
 *
 * Usage:
 *   import { reportError } from "@/lib/errors";
 *   reportError(err, { context: "stream-api", userId });
 */

interface ErrorContext {
  /** Where the error occurred (e.g., "stream-api", "usage-check") */
  context: string;
  /** Authenticated user ID, if available */
  userId?: string | null;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Report an error with structured context.
 * Non-throwing — safe to call in catch blocks without
 * worrying about cascading failures.
 */
export function reportError(error: unknown, meta: ErrorContext): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const timestamp = new Date().toISOString();

    // Structured log for production (parseable by log aggregators)
    console.error(
      JSON.stringify({
        level: "error",
        timestamp,
        message: err.message,
        stack: err.stack?.split("\n").slice(0, 5).join("\n"),
        ...meta,
      })
    );
  } catch {
    // Last resort — never throw from the error reporter
    console.error("Error reporter failed:", error);
  }
}

/**
 * Report a warning (non-fatal issue worth investigating).
 */
export function reportWarning(message: string, meta: ErrorContext): void {
  try {
    const timestamp = new Date().toISOString();
    console.warn(
      JSON.stringify({
        level: "warn",
        timestamp,
        message,
        ...meta,
      })
    );
  } catch {
    console.warn("Warning reporter failed:", message);
  }
}
