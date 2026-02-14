/**
 * Model Definitions & Utilities
 *
 * Shared model metadata, display names, and provider mappings.
 * Used by both the page orchestrator and UI components.
 */

export interface ModelInfo {
  id: string;
  label: string;
  description: string;
}

/** All available models for comparison mode */
export const availableModels: ModelInfo[] = [
  { id: "gpt-5-mini", label: "GPT-5 Mini", description: "Quick answers, lightweight tasks, low cost" },
  { id: "gpt-5.2", label: "GPT-5.2", description: "Deep reasoning, complex multi-step problems" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fastest Anthropic model, ideal for simple tasks" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", description: "Strong all-rounder, good balance of speed and depth" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", description: "Highest capability, nuanced analysis, long context" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Low latency, strong at summarization and extraction" },
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro", description: "Multimodal strength, large context window" },
];

/** Map model ID to provider name */
export function getProviderName(modelId: string): string {
  if (modelId.startsWith("gpt-")) return "OpenAI";
  if (modelId.startsWith("claude-")) return "Anthropic";
  if (modelId.startsWith("gemini-")) return "Google";
  return "Unknown";
}

/** Get user-friendly model name from model ID */
export function getFriendlyModelName(modelId: string): string {
  const model = availableModels.find((m) => m.id === modelId);
  return model?.label || modelId;
}

/** Map error codes and types to user-friendly messages */
export function getUserFriendlyError(error: string | null): string {
  if (!error) return "Unexpected error";

  const errorLower = error.toLowerCase();

  if (errorLower.includes("timeout") || error === "timeout") {
    return "Model timed out. Please try again.";
  }
  if (errorLower.includes("rate") || errorLower.includes("429") || error === "rate_limit") {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (errorLower.includes("provider") || error === "provider_error") {
    return "Model error. Please try again.";
  }
  if (errorLower.includes("network") || errorLower.includes("connection")) {
    return "Network error. Check your connection and try again.";
  }
  if (errorLower.includes("unauthorized") || errorLower.includes("401")) {
    return "Authentication error. Please contact support.";
  }

  // Return the original error if it's already user-friendly (short and clear)
  if (error.length < 100 && !error.includes("Error:") && !error.includes("Exception")) {
    return error;
  }

  return "Unexpected error. Please try again.";
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
