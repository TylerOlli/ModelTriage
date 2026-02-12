/**
 * Conversation session types
 *
 * A ConversationSession tracks multi-turn interactions in both
 * Auto-Select and Compare modes. Sessions live in memory only —
 * localStorage is reserved for prompt history and preferences.
 */

import type { DiffSummary } from "@/lib/diff";

// ─── Metadata ───────────────────────────────────────────────────

export interface ResponseMetadata {
  model: string;
  provider: string;
  latency: number;
  tokenUsage?: { total: number };
  finishReason?: string;
}

// ─── Model Panel (Both modes) ───────────────────────────────────
//
// Unified panel data used for BOTH Auto-select and Compare modes.
// Auto-select stores a single panel; Compare stores N panels.

export interface ModelPanelData {
  modelId: string;
  routing: {
    mode?: "auto" | "manual";
    model: string;
    reason: string;
    confidence?: number | string;
    chosenModel?: string;
    intent?: string;
    category?: string;
  } | null;
  response: string;
  metadata: ResponseMetadata | null;
  error: string | null;
  showRunDetails?: boolean;
  isExpanded?: boolean;
}

// ─── Conversation Turn ──────────────────────────────────────────
//
// Unified: every turn stores its results in `modelPanels`.
// Auto-select turns have 1 panel; Compare turns have N panels.

export interface ConversationTurn {
  id: string;
  prompt: string;
  isFollowUp: boolean;
  timestamp: number;

  modelPanels: Record<string, ModelPanelData>;
  diffSummary: DiffSummary | null;
}

// ─── Conversation Session ───────────────────────────────────────

export interface ConversationSession {
  id: string;
  mode: "auto" | "compare";
  turns: ConversationTurn[];
  createdAt: number;
}

// ─── Helpers ────────────────────────────────────────────────────

export function createTurnId(): string {
  return `turn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function createSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
