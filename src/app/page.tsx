"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { DiffSummary } from "@/lib/diff";
import { FormattedResponse } from "../components/FormattedResponse";
import { FollowUpComposer } from "../components/FollowUpComposer";
import { ModelSelectionCard } from "../components/ModelSelectionCard";
import { validateFiles, getFileValidationErrorMessage } from "@/lib/file-validation";
import type {
  ConversationSession,
  ConversationTurn,
  ModelPanelData,
} from "@/lib/session-types";
import { createTurnId, createSessionId } from "@/lib/session-types";
import { useAuth } from "../components/auth/AuthProvider";
import { UserMenu } from "../components/auth/UserMenu";
import { LoginModal } from "../components/auth/LoginModal";
import { AuthGate } from "../components/auth/AuthGate";
import { UpgradeBanner } from "../components/auth/UpgradeBanner";

/**
 * Map model ID to provider name
 */
function getProviderName(modelId: string): string {
  if (modelId.startsWith("gpt-")) return "OpenAI";
  if (modelId.startsWith("claude-")) return "Anthropic";
  if (modelId.startsWith("gemini-")) return "Google";
  return "Unknown";
}

/**
 * Get user-friendly model name from model ID
 */
function getFriendlyModelName(modelId: string): string {
  const modelMap: Record<string, string> = {
    "gpt-5-mini": "GPT-5 Mini",
    "gpt-5.2": "GPT-5.2",
    "claude-opus-4-6": "Claude Opus 4.6",
    "claude-sonnet-4-5-20250929": "Claude Sonnet 4.5",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "gemini-3-flash-preview": "Gemini 3 Flash",
    "gemini-3-pro-preview": "Gemini 3 Pro",
  };
  return modelMap[modelId] || modelId;
}

/**
 * Map error codes and types to user-friendly messages
 */
function getUserFriendlyError(error: string | null): string {
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

// ModelPanel type alias — canonical definition lives in lib/session-types.ts
type ModelPanel = ModelPanelData;

/**
 * Get or create an anonymous user ID for routing analytics.
 * Stored in localStorage — not linked to any account.
 * Used to correlate routing decisions from the same browser
 * for outcome analysis and calibration.
 */
function getAnonymousId(): string {
  const STORAGE_KEY = "mt_anonymous_id";
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}

/**
 * Helper to detect if a routing reason is generic/fallback text
 */
function isGenericReason(reason: string | undefined): boolean {
  if (!reason) return true;
  
  const genericPhrases = [
    "balanced capabilities",
    "best match for this request",
    "best match for your request",
    "selected as the best",
    "chosen because it is",
  ];
  
  return genericPhrases.some(phrase => reason.toLowerCase().includes(phrase));
}

/**
 * Helper to determine if one reason is more descriptive than another
 */
function isMoreDescriptive(newReason: string | undefined, existingReason: string | undefined): boolean {
  if (!existingReason) return !!newReason;
  if (!newReason) return false;
  
  // Descriptive reasons mention attachments or are longer and specific
  const hasAttachmentContext = 
    newReason.includes("screenshot") ||
    newReason.includes("image") ||
    newReason.includes("uploaded") ||
    newReason.includes("terminal") ||
    newReason.includes("error output") ||
    newReason.includes("UI") ||
    newReason.includes("interface") ||
    newReason.includes("diagram");
  
  if (hasAttachmentContext) return true;
  
  // If new reason is generic but existing is not, keep existing
  if (isGenericReason(newReason) && !isGenericReason(existingReason)) {
    return false;
  }
  
  // Prefer longer, more specific reasons
  return newReason.length > existingReason.length && !isGenericReason(newReason);
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  
  // ── Auth & Usage State ────────────────────────────────────
  const { refreshUsage } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalMessage, setLoginModalMessage] = useState<string | undefined>();
  // Usage limit exceeded state — shown via AuthGate component
  const [usageLimitExceeded, setUsageLimitExceeded] = useState<{
    requiresAuth: boolean;
    used: number;
    limit: number;
  } | null>(null);

  // Unified follow-up input (shared between both modes)
  const [followUpInput, setFollowUpInput] = useState("");

  // Conversation session — tracks multi-turn history in memory
  const [session, setSession] = useState<ConversationSession | null>(null);
  // Which previous turns are expanded (accordion state)
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({});
  // The active follow-up prompt text (shown above response when in follow-up)
  const [activeFollowUpPrompt, setActiveFollowUpPrompt] = useState<string | null>(null);
  // File attachment state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0); // Track nested drag events
  
  // Track if IMAGE_GIST has upgraded routing.reason (prevent overwrites)
  const imageGistUpgradedRef = useRef(false);
  // Track model streaming start time for response time analytics
  const streamingStartRef = useRef<number | null>(null);

  // Streaming stage tracking
  /**
   * LATENCY OPTIMIZATION: Collapsed loading states.
   * Previously: "routing" → "connecting" → "contacting" → "streaming" (3-4 visible steps)
   * Now: "selecting" → "streaming" (1 brief state, then immediate content)
   *
   * "selecting" replaces the old routing/connecting/contacting steps with a single
   * "Selecting model..." indicator. As soon as the first chunk arrives, we transition
   * directly to "streaming" and show content.
   *
   * Legacy values ("routing", "connecting", "contacting") are kept in the type
   * for backward compatibility with Compare mode, which still uses them.
   */
  const [streamingStage, setStreamingStage] = useState<
    "selecting" | "connecting" | "routing" | "contacting" | "streaming" | null
  >(null);

  // Model selection state
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "gpt-5-mini",
    "gpt-5.2",
  ]);

  const availableModels = [
    { id: "gpt-5-mini", label: "GPT-5 Mini", description: "Quick answers, lightweight tasks, low cost" },
    { id: "gpt-5.2", label: "GPT-5.2", description: "Deep reasoning, complex multi-step problems" },
    {
      id: "claude-haiku-4-5-20251001",
      label: "Claude Haiku 4.5",
      description: "Fastest Anthropic model, ideal for simple tasks",
    },
    {
      id: "claude-sonnet-4-5-20250929",
      label: "Claude Sonnet 4.5",
      description: "Strong all-rounder, good balance of speed and depth",
    },
    {
      id: "claude-opus-4-6",
      label: "Claude Opus 4.6",
      description: "Highest capability, nuanced analysis, long context",
    },
    {
      id: "gemini-3-flash-preview",
      label: "Gemini 3 Flash",
      description: "Low latency, strong at summarization and extraction",
    },
    {
      id: "gemini-3-pro-preview",
      label: "Gemini 3 Pro",
      description: "Multimodal strength, large context window",
    },
  ];

  // Prompt history state
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  
  // Reset confirmation state
  const [resetConfirming, setResetConfirming] = useState(false);
  const [lastClearedPrompt, setLastClearedPrompt] = useState("");
  const [showUndoToast, setShowUndoToast] = useState(false);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Draft prompt persistence toggle (default OFF for production)
  const [rememberDrafts, setRememberDrafts] = useState(false);
  

  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Unified Response State ──────────────────────────────────
  // Both modes store results in modelPanels. Auto-select mode has
  // a single panel entry; Compare mode has N panels. This replaces
  // the previously separate response/error/routing/metadata states.
  const [modelPanels, setModelPanels] = useState<Record<string, ModelPanel>>({});
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // ─── Derived Values ──────────────────────────────────────────
  // For auto mode: convenient access to the single panel's data
  const autoPanel = !comparisonMode ? Object.values(modelPanels)[0] ?? null : null;

  /** Update a single field on a panel (works for both modes). */
  const updatePanel = useCallback((modelId: string, updates: Partial<ModelPanel>) => {
    setModelPanels(prev => ({
      ...prev,
      [modelId]: { ...prev[modelId], ...updates },
    }));
  }, []);

  // Load persisted state on mount
  useEffect(() => {
    const persistedComparisonMode = localStorage.getItem("comparisonMode");
    const persistedDraftToggle = localStorage.getItem("rememberDrafts");
    const persistedPrompt = localStorage.getItem("lastPrompt");

    if (persistedComparisonMode !== null) {
      setComparisonMode(persistedComparisonMode === "true");
    }
    
    // Load draft toggle preference (default OFF for production)
    const shouldRememberDrafts = persistedDraftToggle === "true";
    setRememberDrafts(shouldRememberDrafts);
    
    // Only restore draft prompt if toggle is enabled
    if (shouldRememberDrafts && persistedPrompt) {
      setPrompt(persistedPrompt);
    } else {
      // Clear any old draft on load if toggle is OFF
      localStorage.removeItem("lastPrompt");
    }
  }, []);

  // Persist Comparison Mode state
  useEffect(() => {
    localStorage.setItem("comparisonMode", comparisonMode.toString());
  }, [comparisonMode]);

  // Load persisted model selection
  useEffect(() => {
    const persistedModels = localStorage.getItem("selectedModels");
    if (persistedModels) {
      try {
        const parsed = JSON.parse(persistedModels);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter to only include valid model IDs that exist in availableModels
          const validModelIds = availableModels.map((m) => m.id);
          const validPersistedModels = parsed.filter((id) =>
            validModelIds.includes(id)
          );
          if (validPersistedModels.length > 0) {
            setSelectedModels(validPersistedModels);
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Persist model selection
  useEffect(() => {
    localStorage.setItem("selectedModels", JSON.stringify(selectedModels));
  }, [selectedModels]);

  // Load prompt history
  useEffect(() => {
    const savedHistory = localStorage.getItem("promptHistory");
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          setPromptHistory(parsed);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Persist prompt history
  useEffect(() => {
    localStorage.setItem("promptHistory", JSON.stringify(promptHistory));
  }, [promptHistory]);

  // Persist prompt (debounced to avoid excessive writes)
  // ONLY saves draft if "Remember drafts" toggle is enabled (default OFF for production)
  useEffect(() => {
    if (!rememberDrafts) {
      // Toggle is OFF - do not save drafts
      return;
    }
    
    const timeoutId = setTimeout(() => {
      if (prompt.trim()) {
        localStorage.setItem("lastPrompt", prompt);
      } else {
        localStorage.removeItem("lastPrompt");
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [prompt, rememberDrafts]);
  
  // Persist draft toggle preference
  useEffect(() => {
    localStorage.setItem("rememberDrafts", rememberDrafts.toString());
    
    // If toggled OFF, immediately clear any saved draft
    if (!rememberDrafts) {
      localStorage.removeItem("lastPrompt");
    }
  }, [rememberDrafts]);

  // Generate diff summary after streaming completes with multiple models
  useEffect(() => {
    // Only run when streaming completes and we have multiple model panels
    if (!isStreaming && Object.keys(modelPanels).length > 1) {
      const generateSummary = async () => {
        try {
          // Only use successfully completed panels (no error, has response, has metadata)
          const successfulPanels = Object.values(modelPanels).filter(
            (p) => !p.error && p.response.length > 0 && p.metadata
          );

          if (successfulPanels.length >= 2) {
            const finalResponses = successfulPanels.map((p) => ({
              model: p.routing?.model || p.modelId,
              content: p.response,
            }));
            
            // Clear previous summary and show loading state
            setDiffSummary(null);
            setDiffError(null);
            
            // Call server-side API to generate summary (can't call LLM providers from client)
            // Include anonymousId, prompt, and response timing for database persistence.
            const responseTimeMs = streamingStartRef.current
              ? Date.now() - streamingStartRef.current
              : null;
            const res = await fetch("/api/compare", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                responses: finalResponses,
                anonymousId: getAnonymousId(),
                prompt: prompt,
                responseTimeMs,
              }),
            });

            if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.error || "Failed to generate summary");
            }

            const data = await res.json();
            setDiffSummary(data.summary);
          } else if (successfulPanels.length === 1) {
            // Not enough panels for comparison, but don't show error
            setDiffSummary(null);
          }
        } catch (err) {
          console.error("Diff summary generation error:", err);
          setDiffError("Could not generate comparison summary");
        }
      };

      generateSummary();
    }
  }, [isStreaming, modelPanels]);

  // Add prompt to history (dedupe consecutive duplicates, keep last 10)
  const addToHistory = (submittedPrompt: string) => {
    const trimmed = submittedPrompt.trim();
    if (!trimmed) return;

    setPromptHistory((prev) => {
      // Don't add if it's the same as the most recent entry
      if (prev.length > 0 && prev[0] === trimmed) {
        return prev;
      }

      // Add to front, remove duplicates from rest, keep last 10
      const filtered = prev.filter((p) => p !== trimmed);
      return [trimmed, ...filtered].slice(0, 10);
    });
  };

  const clearHistory = () => {
    setPromptHistory([]);
    localStorage.removeItem("promptHistory");
  };

  /**
   * Get the previous turn's context for follow-up requests.
   * Returns { previousPrompt, previousResponse } from the last completed turn
   * in the current session, or from the active (current) turn state.
   */
  const getFollowUpContext = useCallback((): {
    previousPrompt: string;
    previousResponse: string;
  } => {
    // If session has completed turns, use the last one
    if (session && session.turns.length > 0) {
      const lastTurn = session.turns[session.turns.length - 1];
      const prevResponse = Object.values(lastTurn.modelPanels).find((p) => p.response)?.response || "";
      return {
        previousPrompt: lastTurn.prompt,
        previousResponse: prevResponse,
      };
    }
    // Fallback: use current active state (first turn, not yet pushed to session)
    if (Object.keys(modelPanels).length > 0) {
      const firstResponse = Object.values(modelPanels).find((p) => p.response)?.response || "";
      return { previousPrompt: prompt, previousResponse: firstResponse };
    }
    return { previousPrompt: "", previousResponse: "" };
  }, [session, prompt, modelPanels]);

  /**
   * Push the current active turn into the session history.
   * Called before starting a new follow-up turn.
   */
  const pushCurrentTurnToSession = useCallback(
    (turnPrompt: string) => {
      const completedTurn: ConversationTurn = {
        id: createTurnId(),
        prompt: turnPrompt,
        isFollowUp: session !== null && session.turns.length > 0,
        timestamp: Date.now(),
        modelPanels: { ...modelPanels },
        diffSummary: comparisonMode ? diffSummary : null,
      };

      setSession((prev) => {
        if (!prev) {
          return {
            id: createSessionId(),
            mode: comparisonMode ? "compare" : "auto",
            turns: [completedTurn],
            createdAt: Date.now(),
          };
        }
        return { ...prev, turns: [...prev.turns, completedTurn] };
      });
    },
    [session, comparisonMode, modelPanels, diffSummary]
  );

  /**
   * Parse SSE stream from fetch response
   */
  async function* parseSSE(response: Response): AsyncGenerator<{
    event: string;
    data: any;
  }> {
    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        let currentEvent = "";
        let currentData = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.substring(6).trim();
          } else if (line.startsWith("data:")) {
            currentData = line.substring(5).trim();
          } else if (line === "" && currentEvent && currentData) {
            // End of event
            try {
              yield {
                event: currentEvent,
                data: JSON.parse(currentData),
              };
            } catch (e) {
              console.error("Failed to parse SSE data:", currentData);
            }
            currentEvent = "";
            currentData = "";
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) return;

    // Add to history before submitting
    addToHistory(prompt);

    // Prevent concurrent runs - defensive guard in addition to button disabled state
    if (isStreaming || abortControllerRef.current) {
      console.warn("Run already in progress, ignoring duplicate submit");
      return;
    }

    // Validate prompt length (4,000 character limit per spec)
    if (prompt.length > 4000) {
      setModelPanels({
        _validation: {
          modelId: "_validation",
          routing: null,
          response: "",
          metadata: null,
          error: "Prompt exceeds maximum length of 4,000 characters",
          showRunDetails: false,
          isExpanded: false,
        },
      });
      return;
    }

    // Submitting from the main prompt box starts a fresh session
    setSession(null);
    setFollowUpInput("");
    setExpandedTurns({});
    setActiveFollowUpPrompt(null);
    setUsageLimitExceeded(null); // Clear any previous limit-exceeded state

    await handleStreamSubmit();
  };

  /**
   * Unified stream handler — drives both Auto-select and Compare modes.
   *
   * Auto-select: single-model SSE with IMAGE_GIST parsing, one panel.
   * Compare:     multi-model SSE, N panels, diff summary via useEffect.
   */
  const handleStreamSubmit = async (overridePrompt?: string) => {
    const submittedPrompt = overridePrompt || prompt;
    const isCompare = comparisonMode;
    
    // ── Reset state & initialise panels ──────────────────────────
    if (isCompare) {
      const initialPanels: Record<string, ModelPanel> = {};
      selectedModels.forEach((modelId) => {
        initialPanels[modelId] = {
          modelId,
          routing: null,
          response: "",
          metadata: null,
          error: null,
          showRunDetails: false,
          isExpanded: false,
        };
      });
      setModelPanels(initialPanels);
    } else {
      // Auto mode: panel created once model is known (meta event)
      setModelPanels({});
    }

    setDiffSummary(null);
    setDiffError(null);
    setIsStreaming(true);
    // Auto: single "selecting" state. Compare: multi-step pipeline.
    setStreamingStage(isCompare ? "routing" : "selecting");
    imageGistUpgradedRef.current = false;
    streamingStartRef.current = Date.now();

    abortControllerRef.current = new AbortController();

    // Follow-up context
    const followUpCtx = getFollowUpContext();
    const isFollowUp = !!(followUpCtx.previousPrompt && followUpCtx.previousResponse);

    try {
      const { body, headers } = buildRequest({
        prompt: submittedPrompt,
        stream: true,
        ...(isCompare && { models: selectedModels }),
        previousPrompt: isFollowUp ? followUpCtx.previousPrompt : undefined,
        previousResponse: isFollowUp ? followUpCtx.previousResponse : undefined,
        isFollowUp,
      });

      const res = await fetch("/api/stream", {
        method: "POST",
        headers,
        body,
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errorData = await res.json();
        
        // Handle usage limit exceeded — show AuthGate instead of error
        if (errorData.error === "usage_limit_exceeded") {
          setUsageLimitExceeded({
            requiresAuth: errorData.requiresAuth ?? false,
            used: errorData.used ?? 0,
            limit: errorData.limit ?? 0,
          });
          setIsStreaming(false);
          setStreamingStage(null);
          return;
        }
        
        throw new Error(errorData.error || "Request failed");
      }

      // ── Per-model text buffers ───────────────────────────────
      const textBuffers: Record<string, string> = {};
      if (isCompare) {
        selectedModels.forEach((m) => { textBuffers[m] = ""; });
      }

      let hasReceivedChunk = false;
      let currentAutoModel: string | null = null;

      // IMAGE_GIST parsing state (auto mode only)
      let gistBuffer = "";
      let gistParsed = isCompare; // skip in compare mode
      let gistLineFullyConsumed = false;

      // ── SSE loop ─────────────────────────────────────────────
      for await (const { event, data } of parseSSE(res)) {
        if (event === "meta") {
          if (isCompare) {
            setStreamingStage("connecting");
          } else {
            // Auto mode: identify model & store routing
            if (data.models?.[0]) {
              currentAutoModel = data.models[0];
              textBuffers[currentAutoModel!] = "";
            }

            if (data.routing && currentAutoModel) {
              console.log("[STREAM] meta routing reason:", data.routing.reason);
              if (!imageGistUpgradedRef.current) {
                setModelPanels({
                  [currentAutoModel]: {
                    modelId: currentAutoModel,
                    routing: {
                      mode: data.routing.mode || "auto",
                      model: currentAutoModel,
                      reason: data.routing.reason || "",
                      confidence: data.routing.confidence,
                      chosenModel: data.routing.chosenModel || currentAutoModel,
                      intent: data.routing.intent,
                      category: data.routing.category,
                      fitBreakdown: data.routing.fitBreakdown,
                      scoring: data.routing.scoring,
                    },
                    response: "",
                    metadata: null,
                    error: null,
                    showRunDetails: false,
                    isExpanded: false,
                  },
                });
                console.log("[STREAM] Set routing from meta (IMAGE_GIST not yet parsed)");
              } else {
                console.log("[STREAM] Skipping meta routing update - IMAGE_GIST has already upgraded reason");
              }
            } else if (currentAutoModel) {
              // No routing yet — create skeleton panel
              setModelPanels((prev) => {
                if (Object.keys(prev).length === 0) {
                  return {
                    [currentAutoModel!]: {
                      modelId: currentAutoModel!,
                      routing: null,
                      response: "",
                      metadata: null,
                      error: null,
                      showRunDetails: false,
                      isExpanded: false,
                    },
                  };
                }
                return prev;
              });
            }
          }
        } else if (event === "model_start") {
          // Model starting — no action needed
        } else if (event === "routing_update" && !isCompare) {
          // Auto only: IMAGE_GIST-derived routing update
          console.log("Received routing_update event:", data);
          if (data.routing) {
            console.log("Updating routing with IMAGE_GIST-derived reason:", data.routing.reason);
            if (data.imageGist) {
              console.log("IMAGE_GIST metadata:", data.imageGist);
            }
            setModelPanels((prev) => {
              const key = Object.keys(prev)[0];
              if (!key || !prev[key]) return prev;
              return {
                ...prev,
                [key]: {
                  ...prev[key],
                  routing: { ...prev[key].routing, ...data.routing, model: prev[key].routing?.model || key } as ModelPanel["routing"],
                },
              };
            });
          }
        } else if (event === "routing_reason" && !isCompare) {
          // Auto only: routing reason update (non-IMAGE_GIST)
          console.log("Received routing_reason event:", data);
          if (data.reason) {
            console.log("Evaluating routing reason update:", data.reason, data.forceUpdate ? "(forceUpdate)" : "");
            setModelPanels((prev) => {
              const key = Object.keys(prev)[0];
              if (!key || !prev[key]?.routing) return prev;
              const panel = prev[key];

              if (data.forceUpdate) {
                console.log("✓ Force-updating routing reason (follow-up):", data.reason);
                return { ...prev, [key]: { ...panel, routing: { ...panel.routing!, reason: data.reason } } };
              }

              const existingReason = panel.routing!.reason;
              console.log("Previous routing reason:", existingReason);

              if (isMoreDescriptive(data.reason, existingReason)) {
                console.log("✓ Updating to more descriptive reason:", data.reason);
                return { ...prev, [key]: { ...panel, routing: { ...panel.routing!, reason: data.reason } } };
              }
              console.log("✗ Keeping existing reason (new one is generic or less descriptive)");
              return prev;
            });
          }
        } else if (event === "ping") {
          // Keep-alive, ignore
        } else if (event === "chunk") {
          if (!hasReceivedChunk) {
            setStreamingStage("streaming");
            hasReceivedChunk = true;
          }

          if (isCompare) {
            // ── Compare mode: route chunk to the correct model panel
            const modelId = data.model;
            textBuffers[modelId] = (textBuffers[modelId] || "") + data.delta;
            setModelPanels((prev) => ({
              ...prev,
              [modelId]: { ...prev[modelId], response: textBuffers[modelId] },
            }));
          } else {
            // ── Auto mode: single buffer with IMAGE_GIST parsing
            const modelId = currentAutoModel || Object.keys(textBuffers)[0];
            console.log("[STREAM] chunk delta head:", data.delta.slice(0, 80));

            if (!gistParsed) {
              if (gistBuffer.length < 800) {
                gistBuffer += data.delta;

                if (gistBuffer.includes("IMAGE_GIST:") && gistBuffer.includes("\n")) {
                  const gistLineStart = gistBuffer.indexOf("IMAGE_GIST:");
                  const gistLineEnd = gistBuffer.indexOf("\n", gistLineStart);

                  if (gistLineEnd !== -1) {
                    const gistLine = gistBuffer.substring(gistLineStart, gistLineEnd);
                    const jsonPart = gistLine.substring("IMAGE_GIST:".length).trim();

                    try {
                      const gist = JSON.parse(jsonPart);
                      console.log("[STREAM] parsed IMAGE_GIST:", gist);

                      const promptLower = submittedPrompt.toLowerCase();
                      let userIntent = "analyze the code";
                      if (promptLower.match(/improve|optimize|refactor|enhance|better/)) {
                        userIntent = "suggest improvements";
                      } else if (promptLower.match(/explain|describe|what does|how does|understand/)) {
                        userIntent = "explain what it does";
                      } else if (promptLower.match(/fix|debug|error|issue|problem|bug|wrong/)) {
                        userIntent = "identify issues and fixes";
                      }

                      const modelDisplayName = "Gemini 3 Flash";
                      let newReason = "";
                      if (gist.certainty === "high" && gist.language && gist.language !== "unknown" && gist.purpose && gist.purpose !== "unknown") {
                        newReason = `This screenshot shows ${gist.language} code that ${gist.purpose}, so ${modelDisplayName} is a strong fit to accurately read code from images and ${userIntent}.`;
                      } else if (gist.language && gist.language !== "unknown") {
                        newReason = `This screenshot shows ${gist.language} code, so ${modelDisplayName} is a strong fit to accurately read code from images and ${userIntent}.`;
                      } else {
                        newReason = `This screenshot contains code, so ${modelDisplayName} is a strong fit to accurately read code from images and ${userIntent}.`;
                      }

                      console.log("[STREAM] updated routing.reason:", newReason);
                      imageGistUpgradedRef.current = true;
                      console.log("[STREAM] IMAGE_GIST upgrade flag set - preventing future meta overwrites");

                      setModelPanels((prev) => {
                        const key = Object.keys(prev)[0];
                        if (!key || !prev[key]) return prev;
                        return {
                          ...prev,
                          [key]: {
                            ...prev[key],
                            routing: prev[key].routing ? { ...prev[key].routing!, reason: newReason } : prev[key].routing,
                          },
                        };
                      });

                      gistParsed = true;
                      const textAfterGist = gistBuffer.substring(gistLineEnd + 1);
                      gistBuffer = "";
                      gistLineFullyConsumed = true;

                      textBuffers[modelId] = textAfterGist;
                      setModelPanels((prev) => {
                        const key = Object.keys(prev)[0];
                        if (!key) return prev;
                        return { ...prev, [key]: { ...prev[key], response: textBuffers[modelId] } };
                      });
                    } catch (e) {
                      console.warn("[UI] Failed to parse IMAGE_GIST:", e);
                      gistParsed = true;
                      gistLineFullyConsumed = true;
                      textBuffers[modelId] = (textBuffers[modelId] || "") + gistBuffer;
                      gistBuffer = "";
                      setModelPanels((prev) => {
                        const key = Object.keys(prev)[0];
                        if (!key) return prev;
                        return { ...prev, [key]: { ...prev[key], response: textBuffers[modelId] } };
                      });
                    }
                  }
                }
              } else {
                // No IMAGE_GIST in first 800 chars — flush buffer
                console.log("[STREAM] No IMAGE_GIST found in first 800 chars - treating as normal response");
                gistParsed = true;
                textBuffers[modelId] = (textBuffers[modelId] || "") + gistBuffer;
                gistBuffer = "";
                textBuffers[modelId] += data.delta;
                setModelPanels((prev) => {
                  const key = Object.keys(prev)[0];
                  if (!key) return prev;
                  return { ...prev, [key]: { ...prev[key], response: textBuffers[modelId] } };
                });
              }
            } else {
              // Normal chunk (gist already parsed)
              textBuffers[modelId] = (textBuffers[modelId] || "") + data.delta;
              setModelPanels((prev) => {
                const key = Object.keys(prev)[0];
                if (!key) return prev;
                return { ...prev, [key]: { ...prev[key], response: textBuffers[modelId] } };
              });
            }
          }
        } else if (event === "done") {
          const modelId = isCompare ? data.model : (currentAutoModel || Object.keys(textBuffers)[0]);
          setModelPanels((prev) => ({
            ...prev,
            [modelId]: {
              ...prev[modelId],
              metadata: {
                model: data.model,
                provider: getProviderName(data.model),
                latency: data.latencyMs || 0,
                tokenUsage: data.tokenUsage
                  ? { total: data.tokenUsage.totalTokens }
                  : undefined,
                finishReason: data.finishReason,
              },
            },
          }));
        } else if (event === "error") {
          if (isCompare) {
            const modelId = data.model;
            setModelPanels((prev) => ({
              ...prev,
              [modelId]: { ...prev[modelId], error: data.message || "Stream error" },
            }));
          } else {
            throw new Error(data.message || "Stream error");
          }
        } else if (event === "complete") {
          // Flush remaining gist buffer (auto mode)
          if (!isCompare && gistBuffer.length > 0 && !gistParsed) {
            const modelId = currentAutoModel || Object.keys(textBuffers)[0];
            console.log("[STREAM] Stream complete - flushing remaining buffer:", gistBuffer.length, "chars");
            textBuffers[modelId] = (textBuffers[modelId] || "") + gistBuffer;
            gistBuffer = "";
            setModelPanels((prev) => {
              const key = Object.keys(prev)[0];
              if (!key) return prev;
              return { ...prev, [key]: { ...prev[key], response: textBuffers[modelId] } };
            });
          }
          break;
        }
      }

      // Auto mode: verify we received content
      if (!isCompare) {
        const modelId = currentAutoModel || Object.keys(textBuffers)[0];
        if (modelId && !textBuffers[modelId]) {
          throw new Error("No response received");
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          // Handled by handleCancel — do nothing
        } else {
          // Set error on all panels (or create a placeholder if none exist)
          setModelPanels((prev) => {
            if (Object.keys(prev).length === 0) {
              return {
                _error: {
                  modelId: "_error",
                  routing: null,
                  response: "",
                  metadata: null,
                  error: (err as Error).message,
                  showRunDetails: false,
                  isExpanded: false,
                },
              };
            }
            const updated = { ...prev };
            Object.keys(updated).forEach((id) => {
              updated[id] = { ...updated[id], error: (err as Error).message };
            });
            return updated;
          });
        }
      } else {
        setModelPanels((prev) => {
          const errMsg = "An unknown error occurred";
          if (Object.keys(prev).length === 0) {
            return {
              _error: { modelId: "_error", routing: null, response: "", metadata: null, error: errMsg, showRunDetails: false, isExpanded: false },
            };
          }
          const updated = { ...prev };
          Object.keys(updated).forEach((id) => {
            updated[id] = { ...updated[id], error: errMsg };
          });
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      setStreamingStage(null);
      abortControllerRef.current = null;
      // Refresh usage counter after request completes
      refreshUsage();
    }
  };

  const handleCancel = () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();

        // Mark all unfinished panels as cancelled (both modes)
        const cancelMessage = comparisonMode ? "Cancelled by user" : "Stream cancelled";
        setModelPanels((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((id) => {
            if (!updated[id].metadata) {
              updated[id] = { ...updated[id], error: cancelMessage };
            }
          });
          return updated;
        });
      }
    } catch (err) {
      console.error("Error during cancel:", err);
    } finally {
      setIsStreaming(false);
      setStreamingStage(null);
      abortControllerRef.current = null;
    }
  };

  const handleClear = () => {
    // Reset unified response state
    setModelPanels({});
    setDiffSummary(null);
    setDiffError(null);

    // Clear conversation session
    setSession(null);
    setFollowUpInput("");
    setExpandedTurns({});
    setActiveFollowUpPrompt(null);

    // Clear attached files
    setAttachedFiles([]);

    // Clear prompt text and remove from localStorage
    setPrompt("");
    localStorage.removeItem("lastPrompt");
  };

  const handleResetPrompt = () => {
    if (!prompt.trim()) return;
    
    if (!resetConfirming) {
      // First click - enter confirmation mode
      setResetConfirming(true);
      
      // Auto-revert after 2 seconds
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      resetTimeoutRef.current = setTimeout(() => {
        setResetConfirming(false);
      }, 2000);
    } else {
      // Second click - clear the prompt
      setLastClearedPrompt(prompt);
      setPrompt("");
      setResetConfirming(false);
      
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      
      // Show undo toast
      setShowUndoToast(true);
      setTimeout(() => {
        setShowUndoToast(false);
      }, 5000);
    }
  };
  
  const handleUndoClear = () => {
    setPrompt(lastClearedPrompt);
    setShowUndoToast(false);
  };
  
  // ─── Mode Switching ──────────────────────────────────────────

  const handleModeSwitch = (newMode: boolean) => {
    const targetMode = newMode ? "compare" : "auto";
    const currentMode = comparisonMode ? "compare" : "auto";
    if (targetMode === currentMode) return;

    // Clear results but preserve the prompt — it's shared between modes
    setModelPanels({});
    setDiffSummary(null);
    setDiffError(null);
    setSession(null);
    setFollowUpInput("");
    setExpandedTurns({});
    setActiveFollowUpPrompt(null);
    setComparisonMode(newMode);
  };


  // ─── Unified Follow-Up Handler ────────────────────────────────

  const handleFollowUpSubmit = () => {
    const followUpText = followUpInput.trim();
    if (!followUpText || isStreaming) return;

    // Push current active state into session as a completed turn
    pushCurrentTurnToSession(prompt);

    // Track what the user asked so we can display it above the response
    setActiveFollowUpPrompt(followUpText);

    // Clear active state for the new turn
    setModelPanels({});
    setDiffSummary(null);
    setDiffError(null);

    // Add follow-up to history
    addToHistory(followUpText);

    // Clear the input
    setFollowUpInput("");

    // Submit the follow-up via the unified handler
    handleStreamSubmit(followUpText);
  };

  // File attachment handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Limit to 3 files max
    if (attachedFiles.length + files.length > 3) {
      alert("Maximum 3 files allowed");
      return;
    }

    // Validate files using denylist approach
    const { validFiles, invalidFiles } = validateFiles(files);

    // Show error for invalid files
    if (invalidFiles.length > 0) {
      alert(getFileValidationErrorMessage(invalidFiles));
    }

    // Add valid files
    if (validFiles.length > 0) {
      setAttachedFiles([...attachedFiles, ...validFiles]);
    }

    // Reset input so same file can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  // Drag-and-drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent drag state if streaming or max files reached
    if (isStreaming || attachedFiles.length >= 3) {
      return;
    }
    
    dragCounterRef.current += 1;
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current -= 1;
    
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggingOver(false);
    dragCounterRef.current = 0;
    
    // Prevent drop if streaming
    if (isStreaming) {
      return;
    }
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    // Validate files using denylist approach
    const { validFiles, invalidFiles } = validateFiles(droppedFiles);
    
    // Show error for invalid files
    if (invalidFiles.length > 0) {
      alert(getFileValidationErrorMessage(invalidFiles));
    }
    
    // Check total file count
    if (attachedFiles.length + validFiles.length > 3) {
      alert(`Maximum 3 files allowed. You have ${attachedFiles.length} file(s) attached and tried to add ${validFiles.length} more.`);
      return;
    }
    
    // Add valid files
    if (validFiles.length > 0) {
      setAttachedFiles([...attachedFiles, ...validFiles]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Build request for API (handles both JSON and multipart/form-data)
  // Includes anonymousId for routing analytics persistence.
  const buildRequest = (params: {
    prompt: string;
    stream: boolean;
    models?: string[];
    previousPrompt?: string;
    previousResponse?: string;
    isFollowUp?: boolean;
  }): { body: string | FormData; headers: Record<string, string> } => {
    const hasFiles = attachedFiles.length > 0;
    const anonymousId = getAnonymousId();

    if (hasFiles) {
      // Use multipart/form-data
      const formData = new FormData();
      formData.append("prompt", params.prompt);
      formData.append("stream", String(params.stream));
      formData.append("anonymousId", anonymousId);
      if (params.models) {
        formData.append("models", JSON.stringify(params.models));
      }
      if (params.previousPrompt) {
        formData.append("previousPrompt", params.previousPrompt);
      }
      if (params.previousResponse) {
        formData.append("previousResponse", params.previousResponse);
      }
      if (params.isFollowUp) {
        formData.append("isFollowUp", "true");
      }
      
      // Attach files
      attachedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      return {
        body: formData,
        headers: {}, // No Content-Type header - browser sets it with boundary
      };
    } else {
      // Use JSON
      return {
        body: JSON.stringify({
          prompt: params.prompt,
          stream: params.stream,
          anonymousId,
          ...(params.models && { models: params.models }),
          ...(params.previousPrompt && { previousPrompt: params.previousPrompt }),
          ...(params.previousResponse && { previousResponse: params.previousResponse }),
          ...(params.isFollowUp && { isFollowUp: true }),
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }
  };

  const characterCount = prompt.length;
  const isOverLimit = characterCount > 4000;
  
  // Check if we have any results to show
  const hasResults = Object.keys(modelPanels).length > 0;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-3xl mx-auto px-4 pt-12 pb-16 transition-all duration-300" style={{ maxWidth: comparisonMode && hasResults ? '80rem' : '48rem' }}>
        {/* Identity Bar */}
        <header className={`mb-10 transition-all duration-300 ${hasResults ? 'text-left' : 'text-center pt-8'}`}>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Model<span className="text-blue-600">Triage</span>
            </h1>
            <UserMenu onSignInClick={() => {
              setLoginModalMessage(undefined);
              setShowLoginModal(true);
            }} />
          </div>
          {!hasResults && !isStreaming && (
            <p className={`text-base text-neutral-500 mt-1 ${hasResults ? '' : 'text-center'}`}>
              Right LLM. Every time.
            </p>
          )}
        </header>

        {/* Usage limit warning banner */}
        <UpgradeBanner />

        {/* Login / Sign Up Modal */}
        <LoginModal
          open={showLoginModal}
          onClose={() => {
            setShowLoginModal(false);
            setLoginModalMessage(undefined);
            // Refresh usage after login in case user just signed up
            refreshUsage();
          }}
          message={loginModalMessage}
        />

        {/* Prompt Composer */}
        <form onSubmit={handleSubmit} className="mb-10">
          <div 
            className={`relative bg-white rounded-2xl border transition-all duration-200 ${
              isDraggingOver
                ? "border-blue-400 ring-4 ring-blue-500/10"
                : isOverLimit
                  ? "border-red-300 shadow-sm"
                  : "border-neutral-200/80 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_1px_6px_rgba(0,0,0,0.04)] focus-within:border-neutral-300 focus-within:shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_12px_rgba(0,0,0,0.06)]"
            }`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag-and-drop overlay */}
            {isDraggingOver && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/80 rounded-2xl border-2 border-blue-400 border-dashed pointer-events-none">
                <div className="text-center">
                  <svg className="w-8 h-8 text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <div className="text-sm font-medium text-blue-700">Drop files to attach</div>
                  {attachedFiles.length > 0 && (
                    <div className="text-sm text-blue-500 mt-1">{3 - attachedFiles.length} more allowed</div>
                  )}
                </div>
              </div>
            )}

            {/* Conversation active indicator */}
            {session && session.turns.length > 0 && (
              <div className="px-5 pt-3 pb-0">
                <span className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Conversation active &middot; {session.turns.length} turn{session.turns.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            
            {/* Textarea */}
            <textarea
              ref={promptInputRef}
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What do you want to ask?"
              className="w-full px-5 pt-4 pb-2 border-0 outline-none resize-none bg-transparent text-[15px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 disabled:text-neutral-400"
              rows={4}
              disabled={isStreaming}
              aria-describedby="character-count"
            />

            {/* File Attachments */}
            {attachedFiles.length > 0 && (
              <div className="px-5 pb-2">
                <div className="flex flex-wrap gap-2">
                  {attachedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm"
                    >
                      <span className="text-neutral-500">
                        {file.type.startsWith("image/") ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        )}
                      </span>
                      <span className="text-neutral-700 font-medium truncate max-w-[200px]">{file.name}</span>
                      <span className="text-neutral-400 text-sm">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        disabled={isStreaming}
                        className="ml-0.5 text-neutral-400 hover:text-neutral-600 disabled:opacity-50 transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-amber-600 mt-2">
                  Attachments are sent to the model. Avoid sensitive data.
                </p>
              </div>
            )}
            
            {/* Action Bar — mode toggle, utilities, submit */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-neutral-100">
              {/* Left: Mode toggle + utilities */}
              <div className="flex items-center gap-3">
                {/* Pill toggle */}
                <div className="inline-flex rounded-lg bg-neutral-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch(false)}
                    disabled={isStreaming}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
                      !comparisonMode
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700"
                    } ${isStreaming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    Auto-select
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch(true)}
                    disabled={isStreaming}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
                      comparisonMode
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700"
                    } ${isStreaming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    Compare
                  </button>
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-neutral-200" />

                {/* Attach */}
                <input ref={fileInputRef} type="file" onChange={handleFileSelect} multiple className="hidden" disabled={isStreaming} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || attachedFiles.length >= 3}
                  className="text-sm text-neutral-400 hover:text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <span className="hidden sm:inline">Attach</span>
                </button>

                {/* History */}
                {promptHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors duration-150 flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="hidden sm:inline">History</span>
                  </button>
                )}

                {/* Reset */}
                {prompt.trim() && (
                  <button
                    type="button"
                    onClick={handleResetPrompt}
                    disabled={isStreaming}
                    className={`text-sm transition-colors duration-150 ${
                      resetConfirming
                        ? "text-amber-600 font-medium"
                        : "text-neutral-400 hover:text-neutral-600"
                    }`}
                  >
                    {resetConfirming ? "Confirm clear" : "Reset"}
                  </button>
                )}
              </div>

              {/* Right: char count + submit */}
              <div className="flex items-center gap-3">
                <span
                  id="character-count"
                  className={`text-sm tabular-nums ${isOverLimit ? "text-red-500 font-medium" : "text-neutral-400"}`}
                >
                  {characterCount > 0 ? `${characterCount} / 4,000` : ""}
                </span>

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-1.5 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors duration-150"
                  >
                    Cancel
                  </button>
                ) : hasResults ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-4 py-1.5 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors duration-150"
                  >
                    Clear
                  </button>
                ) : null}

                <button
                  type="submit"
                  disabled={isStreaming || !prompt.trim() || isOverLimit}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 active:scale-95 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed transition-all duration-150"
                  aria-label="Submit prompt"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Model Selection Chips (Compare mode) — slides in below action bar */}
            <div className={`transition-all duration-200 ease-out ${
              comparisonMode ? "opacity-100" : "max-h-0 opacity-0 overflow-hidden"
            }`}>
              {comparisonMode && (
                <div className="px-5 pb-4 pt-2 border-t border-neutral-100 overflow-visible">
                  <div className="flex flex-wrap gap-2">
                    {availableModels.map((model) => {
                      const isSelected = selectedModels.includes(model.id);
                      return (
                        <div key={model.id} className="relative group/chip">
                          <button
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (selectedModels.length > 1) {
                                  setSelectedModels(selectedModels.filter((id) => id !== model.id));
                                }
                              } else {
                                setSelectedModels([...selectedModels, model.id]);
                              }
                            }}
                            disabled={isStreaming}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                              isSelected
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-white text-neutral-500 border border-neutral-200 hover:border-neutral-300 hover:text-neutral-700"
                            } ${isStreaming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 inline mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            )}
                            {model.label}
                          </button>
                          {/* Tooltip */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2.5 py-1 bg-neutral-700 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/chip:opacity-90 transition-opacity duration-300 delay-300 z-10">
                            {model.description}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-neutral-700" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-sm text-neutral-400 mt-2">
                    {selectedModels.length} model{selectedModels.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Prompt History Popover */}
          {showHistory && promptHistory.length > 0 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowHistory(false)} />
              <div className="relative z-20 mt-2 animate-enter">
                <div className="bg-white rounded-xl border border-neutral-200 shadow-lg overflow-visible">
                  <div className="px-4 py-3 border-b border-neutral-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-neutral-900">Recent prompts</h4>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowHistoryMenu(!showHistoryMenu); }}
                          className="p-1 text-neutral-400 hover:text-neutral-600 rounded-md transition-colors duration-150"
                          aria-label="History options"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        {showHistoryMenu && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowHistoryMenu(false)} />
                            <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-lg border border-neutral-200 shadow-lg py-1 min-w-[180px] animate-enter">
                              <button type="button" onClick={() => { clearHistory(); setShowHistoryMenu(false); setShowHistory(false); }} className="w-full text-left px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">Clear history</button>
                              <div className="h-px bg-neutral-100 my-1" />
                              <button type="button" onClick={() => { setRememberDrafts(!rememberDrafts); setShowHistoryMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors flex items-center justify-between gap-2">
                                <span>Remember drafts</span>
                                <div className={`w-8 h-4 rounded-full transition-colors duration-200 ${rememberDrafts ? 'bg-blue-600' : 'bg-neutral-300'}`}>
                                  <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5 ${rememberDrafts ? 'ml-4' : 'ml-0.5'}`} />
                                </div>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {rememberDrafts && <p className="text-sm text-blue-600 mt-1">Draft auto-saved on this device</p>}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {promptHistory.map((historyItem, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => { setPrompt(historyItem); setShowHistory(false); }}
                        className="w-full text-left px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors duration-150 border-b border-neutral-50 last:border-b-0 group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex-1 truncate">{historyItem}</span>
                          <span className="text-sm text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">Reuse</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </form>

        {/* Undo Toast */}
        {showUndoToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-enter">
            <div className="bg-neutral-900 text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-3">
              <span className="text-sm">Prompt cleared</span>
              <button type="button" onClick={handleUndoClear} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">Undo</button>
            </div>
          </div>
        )}

        {/* Previous Conversation Turns (Accordion) */}
        {session && session.turns.length > 0 && (
          <div className="space-y-2 mb-8">
            {session.turns.map((turn) => {
              const isExpanded = expandedTurns[turn.id] || false;
              const panelEntries = Object.entries(turn.modelPanels);
              const isAutoTurn = panelEntries.length === 1 && panelEntries[0][1]?.routing?.mode === "auto";
              const isCompareTurn = panelEntries.length > 1;
              const autoTurnPanel = isAutoTurn ? panelEntries[0][1] : null;

              const modelLabel = isAutoTurn && autoTurnPanel?.routing?.chosenModel
                ? getFriendlyModelName(autoTurnPanel.routing.chosenModel)
                : isCompareTurn
                  ? Object.keys(turn.modelPanels).map(getFriendlyModelName).join(", ")
                  : "";
              const promptPreview = turn.prompt.length > 120
                ? turn.prompt.substring(0, 120) + "\u2026"
                : turn.prompt;

              return (
                <div key={turn.id} className="animate-enter">
                  <button
                    type="button"
                    onClick={() => setExpandedTurns((prev) => ({ ...prev, [turn.id]: !prev[turn.id] }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 group ${
                      isExpanded
                        ? "bg-white border-neutral-200 shadow-sm"
                        : "bg-neutral-50 border-neutral-200/60 hover:bg-white hover:border-neutral-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <svg className={`w-3.5 h-3.5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className={`text-sm font-medium flex-shrink-0 ${turn.isFollowUp ? "text-blue-600" : "text-neutral-500"}`}>
                        {turn.isFollowUp ? "Follow-up" : "Previous"}
                      </span>
                      <p className="text-sm text-neutral-700 truncate flex-1 min-w-0">{promptPreview}</p>
                      {modelLabel && (
                        <span className="text-sm text-neutral-400 font-mono flex-shrink-0 hidden sm:inline">{modelLabel}</span>
                      )}
                    </div>
                  </button>

                  <div className={`overflow-hidden transition-all duration-200 ease-out ${isExpanded ? "max-h-[2000px] opacity-100 mt-3" : "max-h-0 opacity-0"}`}>
                    {isAutoTurn && autoTurnPanel && (
                      <div className="pl-8">
                        {autoTurnPanel.routing && autoTurnPanel.routing.mode === "auto" && (
                          <ModelSelectionCard
                            modelName={autoTurnPanel.routing.chosenModel ? getFriendlyModelName(autoTurnPanel.routing.chosenModel) : ""}
                            reason={autoTurnPanel.routing.reason || ""}
                          />
                        )}
                        <div className="text-[15px] leading-relaxed text-neutral-700">
                          <FormattedResponse response={autoTurnPanel.response} />
                        </div>
                      </div>
                    )}

                    {isCompareTurn && (
                      <div className="grid gap-4 md:grid-cols-2 items-start">
                        {Object.entries(turn.modelPanels).map(([mId, panel]) => (
                          <div key={mId} className="bg-white rounded-xl border border-neutral-200 p-5 border-l-2 border-l-blue-500">
                            <div className="flex items-baseline gap-2 mb-3">
                              <span className="text-sm font-semibold text-neutral-900 font-mono">{getFriendlyModelName(mId)}</span>
                              {panel.routing?.reason && (
                                <>
                                  <span className="text-neutral-300">&mdash;</span>
                                  <span className="text-sm text-neutral-500">{panel.routing.reason}</span>
                                </>
                              )}
                            </div>
                            <div className="text-sm leading-relaxed text-neutral-700">
                              <FormattedResponse response={panel.response} mode="compare" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Follow-Up Question Label */}
        {activeFollowUpPrompt && (isStreaming || Object.keys(modelPanels).length > 0) && (
          <div className="flex items-start gap-2.5 mb-6 animate-enter">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-blue-600">Follow-up</span>
              <p className="text-sm text-neutral-700 leading-relaxed mt-0.5">{activeFollowUpPrompt}</p>
            </div>
          </div>
        )}

        {/* Usage Limit Exceeded Gate */}
        {usageLimitExceeded && (
          <div className="mb-8">
            <AuthGate
              requiresAuth={usageLimitExceeded.requiresAuth}
              used={usageLimitExceeded.used}
              limit={usageLimitExceeded.limit}
              onSignIn={() => {
                setLoginModalMessage(
                  "Create a free account to get 15 requests per day."
                );
                setShowLoginModal(true);
              }}
            />
          </div>
        )}

        {/* Loading State (Auto mode) */}
        {isStreaming && streamingStage && !comparisonMode && !Object.values(modelPanels).some(p => p.response) && (
          <div className="animate-enter">
            <div className="flex items-center gap-3 mb-6">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="text-base font-medium text-neutral-700">
                {(() => {
                  if (streamingStage === "streaming") return "Starting response\u2026";
                  const chosen = autoPanel?.routing?.chosenModel;
                  if (chosen) return `Routing to ${getFriendlyModelName(chosen)}\u2026`;
                  return "Selecting model\u2026";
                })()}
              </span>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-neutral-100 rounded w-full animate-pulse" />
              <div className="h-4 bg-neutral-100 rounded w-[95%] animate-pulse" />
              <div className="h-4 bg-neutral-100 rounded w-[80%] animate-pulse" />
              <div className="h-4 bg-neutral-100 rounded w-[90%] animate-pulse" />
              <div className="h-4 bg-neutral-100 rounded w-[65%] animate-pulse" />
            </div>
          </div>
        )}

        {/* Single-Answer Mode Display */}
        {!comparisonMode && (
          <>
            {(autoPanel?.response || autoPanel?.error || autoPanel?.metadata) && (
              <div className="animate-enter">
                {autoPanel?.response && (
                  <div>
                    {/* Model routing bar */}
                    {autoPanel.routing && autoPanel.routing.mode === "auto" && (
                      <ModelSelectionCard
                        modelName={autoPanel.routing.chosenModel ? getFriendlyModelName(autoPanel.routing.chosenModel) : ""}
                        reason={autoPanel.routing.reason || (isStreaming ? "Selecting the best model for your request\u2026" : "Analyzing your request\u2026")}
                        isStreaming={isStreaming}
                      />
                    )}
                    
                    {/* Response content — direct on surface */}
                    <div className="text-[15px] leading-relaxed text-neutral-700">
                      <FormattedResponse response={autoPanel.response} />
                    </div>

                    {/* Run metadata — single muted line */}
                    {autoPanel.metadata && (
                      <div className="mt-8 pt-4 border-t border-neutral-200/60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-neutral-400">
                            <span className="font-mono">{getFriendlyModelName(autoPanel.metadata.model)}</span>
                            <span>&middot;</span>
                            <span>{autoPanel.metadata.provider}</span>
                            {autoPanel.showRunDetails && (
                              <>
                                <span>&middot;</span>
                                <span className="font-mono tabular-nums">{(autoPanel.metadata.latency / 1000).toFixed(1)}s</span>
                                <span>&middot;</span>
                                <span className="font-mono tabular-nums">{autoPanel.metadata.tokenUsage?.total || "N/A"} tokens</span>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => autoPanel && updatePanel(autoPanel.modelId, { showRunDetails: !autoPanel.showRunDetails })}
                            className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors duration-150"
                          >
                            {autoPanel.showRunDetails ? "Less" : "Details"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Follow-up */}
                    {!isStreaming && !autoPanel.error && autoPanel.response && (
                      <FollowUpComposer
                        value={followUpInput}
                        onChange={setFollowUpInput}
                        onSubmit={handleFollowUpSubmit}
                        isLoading={isStreaming}
                        placeholder="Ask a follow-up question\u2026"
                      />
                    )}
                  </div>
                )}

                {/* Empty Response Warning */}
                {!autoPanel?.response && !autoPanel?.error && autoPanel?.metadata && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                    <p className="text-sm text-amber-800">
                      <span className="font-semibold">Empty response.</span> The model completed but returned no text. Try a simpler prompt.
                    </p>
                  </div>
                )}

                {/* Token Limit Warning */}
                {autoPanel?.metadata?.finishReason === "length" && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mt-4">
                    <p className="text-sm text-amber-800">
                      <span className="font-semibold">Response truncated.</span> The model reached its token limit. Consider a model with higher capacity for complex queries.
                    </p>
                  </div>
                )}

                {/* Error */}
                {autoPanel?.error && (
                  <div className="bg-red-50 rounded-xl border border-red-200 p-4 flex items-center justify-between gap-4">
                    <p className="text-sm text-red-700">
                      <span className="font-semibold">Error:</span> {getUserFriendlyError(autoPanel.error)}
                    </p>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-4 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors duration-150 flex-shrink-0"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* How it works — shown when no results */}
            {!autoPanel?.response && !isStreaming && !autoPanel?.error && (
              <div className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900 mb-2">Auto-select</h4>
                    <p className="text-sm text-neutral-500 leading-relaxed">
                      Submit a prompt and we route it to the best model. Fast, cost-effective, and accurate for most requests.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900 mb-2">Compare</h4>
                    <p className="text-sm text-neutral-500 leading-relaxed">
                      Run the same prompt across multiple models side-by-side. Ideal for critical decisions and verification.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Compare Mode Response Display */}
        {comparisonMode && Object.keys(modelPanels).length > 0 && (
          <>
            {/* Response Cards Grid */}
            <div className="grid gap-5 mb-8 md:grid-cols-2 items-start">
              {Object.entries(modelPanels).map(([modelId, panel], idx) => (
                <div
                  key={modelId}
                  className="animate-enter"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden flex flex-col border-l-2 border-l-blue-500 shadow-sm">
                    {/* Model header */}
                    <div className="px-5 pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-neutral-900 font-mono">
                          {getFriendlyModelName(modelId)}
                        </h3>
                        {isStreaming && !panel.metadata && !panel.error && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                          </span>
                        )}
                      </div>
                      {panel.routing?.reason && (
                        <p className="text-sm text-neutral-500 leading-relaxed">{panel.routing.reason}</p>
                      )}
                    </div>
                    
                    {/* Response content */}
                    <div className="px-5 pb-4 flex-1">
                      {panel.error ? (
                        <div className="bg-red-50 rounded-lg border border-red-200 p-3">
                          <p className="text-sm text-red-700"><span className="font-semibold">Error:</span> {getUserFriendlyError(panel.error)}</p>
                        </div>
                      ) : !panel.response && panel.metadata ? (
                        <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                          <p className="text-sm text-amber-800"><span className="font-semibold">Empty response.</span> Model returned no text.</p>
                        </div>
                      ) : panel.response ? (
                        <div className="text-sm leading-relaxed text-neutral-700">
                          <FormattedResponse response={panel.response} mode="compare" />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="h-3 bg-neutral-100 rounded w-full animate-pulse" />
                          <div className="h-3 bg-neutral-100 rounded w-[90%] animate-pulse" />
                          <div className="h-3 bg-neutral-100 rounded w-[75%] animate-pulse" />
                        </div>
                      )}

                      {panel.metadata?.finishReason === "length" && (
                        <p className="text-sm text-amber-700 mt-3">Response truncated due to token limit.</p>
                      )}
                    </div>

                    {/* Metadata footer */}
                    {panel.metadata && (
                      <div className="px-5 py-3 border-t border-neutral-100">
                        <div className="flex items-center justify-between text-sm text-neutral-400">
                          <span>{panel.metadata.provider} &middot; {(panel.metadata.latency / 1000).toFixed(1)}s &middot; {panel.metadata.tokenUsage?.total || "N/A"} tokens</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Comparison Summary */}
            {!isStreaming && diffSummary && (
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden animate-enter">
                <div className="px-6 pt-5 pb-4">
                  <h3 className="text-base font-semibold text-neutral-900 tracking-tight mb-1">
                    Comparison Summary
                  </h3>
                  <p className="text-sm text-neutral-500">
                    AI synthesis across selected models
                  </p>
                </div>

                <div className="px-6 pb-6 space-y-5">
                  {/* Verdict */}
                  {diffSummary.verdict && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Verdict</p>
                      <p className="text-sm text-blue-800 leading-relaxed">{diffSummary.verdict}</p>
                    </div>
                  )}

                  {/* Summary cards */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {diffSummary.commonGround.length > 0 && (
                      <div className="bg-neutral-50 rounded-xl p-4">
                        <p className="text-sm font-semibold text-neutral-900 mb-2">Common Ground</p>
                        <ul className="space-y-1.5">
                          {diffSummary.commonGround.map((item, idx) => (
                            <li key={idx} className="text-sm text-neutral-600 leading-relaxed flex items-start gap-2">
                              <span className="text-green-500 mt-0.5 flex-shrink-0">&bull;</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {diffSummary.keyDifferences.length > 0 && (
                      <div className="bg-neutral-50 rounded-xl p-4">
                        <p className="text-sm font-semibold text-neutral-900 mb-2">Key Differences</p>
                        <div className="space-y-2">
                          {diffSummary.keyDifferences.map((diff, idx) => (
                            <div key={idx}>
                              <p className="text-sm font-medium text-neutral-700">{diff.model}</p>
                              <ul className="space-y-1 mt-1">
                                {diff.points.map((point, pIdx) => (
                                  <li key={pIdx} className="text-sm text-neutral-600 leading-relaxed flex items-start gap-2">
                                    <span className="text-amber-500 mt-0.5 flex-shrink-0">&bull;</span>
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {diffSummary.notableGaps.length > 0 && (
                      <div className="bg-neutral-50 rounded-xl p-4">
                        <p className="text-sm font-semibold text-neutral-900 mb-2">Notable Gaps</p>
                        <ul className="space-y-1.5">
                          {diffSummary.notableGaps.map((item, idx) => (
                            <li key={idx} className="text-sm text-neutral-600 leading-relaxed flex items-start gap-2">
                              <span className="text-neutral-400 mt-0.5 flex-shrink-0">&bull;</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Follow-up */}
                {!isStreaming && (
                  <div className="px-6 pb-5">
                    <FollowUpComposer
                      value={followUpInput}
                      onChange={setFollowUpInput}
                      onSubmit={handleFollowUpSubmit}
                      isLoading={isStreaming}
                      placeholder="Ask a follow-up about this comparison\u2026"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Loading summary */}
            {!isStreaming && !diffSummary && !diffError && Object.keys(modelPanels).length >= 2 && (
              (() => {
                const successfulCount = Object.values(modelPanels).filter(
                  (p) => !p.error && p.response.length > 0 && p.metadata
                ).length;
                
                if (successfulCount >= 2) {
                  return (
                    <div className="animate-enter">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                        <span className="text-base font-medium text-neutral-700">Comparing responses&hellip;</span>
                      </div>
                      <div className="space-y-3">
                        <div className="h-3 bg-neutral-100 rounded w-full animate-pulse" />
                        <div className="h-3 bg-neutral-100 rounded w-[90%] animate-pulse" />
                        <div className="h-3 bg-neutral-100 rounded w-[75%] animate-pulse" />
                      </div>
                    </div>
                  );
                }
                return null;
              })()
            )}

            {diffError && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                <p className="text-sm text-amber-800">Note: {diffError}</p>
              </div>
            )}

            {!isStreaming && !diffSummary && !diffError && Object.keys(modelPanels).length > 0 && (
              (() => {
                const successfulCount = Object.values(modelPanels).filter(
                  (p) => !p.error && p.response.length > 0 && p.metadata
                ).length;
                const errorCount = Object.values(modelPanels).filter((p) => p.error).length;
                
                if (errorCount > 0 && successfulCount < 2) {
                  return (
                    <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
                      <p className="text-sm text-neutral-600">
                        Comparison requires at least 2 successful responses.
                        {successfulCount === 1 ? " Only 1 model completed." : " No models completed."}
                      </p>
                    </div>
                  );
                }
                return null;
              })()
            )}
          </>
        )}
      </div>
    </div>
  );
}
