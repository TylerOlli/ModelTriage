/**
 * Conversation session types
 *
 * A ConversationSession tracks multi-turn interactions in both
 * Auto-Select and Compare modes. Sessions live in memory only —
 * localStorage is reserved for prompt history and preferences.
 */

import type { DiffSummary } from "@/lib/diff";

// ─── Routing & Metadata ─────────────────────────────────────────

export interface RoutingInfo {
  mode: "auto" | "manual";
  intent?: string;
  category?: string;
  chosenModel?: string;
  confidence?: number;
  reason?: string;
}

export interface ResponseMetadata {
  model: string;
  provider: string;
  latency: number;
  tokenUsage?: { total: number };
  finishReason?: string;
}

// ─── Model Panel (Compare mode) ─────────────────────────────────

export interface ModelPanelData {
  modelId: string;
  routing: {
    model: string;
    reason: string;
    confidence: string;
  } | null;
  response: string;
  metadata: ResponseMetadata | null;
  error: string | null;
  showRunDetails?: boolean;
  isExpanded?: boolean;
}

// ─── Conversation Turn ──────────────────────────────────────────

export interface ConversationTurn {
  id: string;
  prompt: string;
  isFollowUp: boolean;
  timestamp: number;

  // Auto-select mode results
  response: string;
  routing: RoutingInfo | null;
  metadata: ResponseMetadata | null;
  error: string | null;

  // Compare mode results
  modelPanels: Record<string, ModelPanelData> | null;
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
