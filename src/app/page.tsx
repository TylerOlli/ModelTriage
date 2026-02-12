"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { DiffSummary } from "@/lib/diff";
import { FormattedResponse } from "../components/FormattedResponse";
import { FollowUpComposer } from "../components/FollowUpComposer";
import { ModeSwitchModal } from "../components/ModeSwitchModal";
import { validateFiles, getFileValidationErrorMessage } from "@/lib/file-validation";
import type {
  ConversationSession,
  ConversationTurn,
  ModelPanelData,
} from "@/lib/session-types";
import { createTurnId, createSessionId } from "@/lib/session-types";

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
    "claude-opus-4-5-20251101": "Claude Opus 4.5",
    "claude-sonnet-4-5-20250929": "Claude Sonnet 4.5",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
  };
  return modelMap[modelId] || modelId;
}

/**
 * Convert confidence score to user-friendly label
 * Returns null if confidence should not be displayed
 */
function confidenceToLabel(confidence?: number): string | null {
  if (confidence === undefined || confidence === 0) {
    return null;
  }
  
  if (confidence >= 0.8) {
    return "High confidence";
  } else if (confidence >= 0.6) {
    return "Medium confidence";
  } else {
    return "Low confidence (verify recommended)";
  }
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
  
  // Comparison summary accordion state
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  
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
    { id: "gpt-5-mini", label: "GPT-5 Mini", description: "Fast reasoning" },
    { id: "gpt-5.2", label: "GPT-5.2", description: "Advanced reasoning" },
    {
      id: "claude-opus-4-5-20251101",
      label: "Claude Opus 4.5",
      description: "Best / Highest reasoning",
    },
    {
      id: "claude-sonnet-4-5-20250929",
      label: "Claude Sonnet 4.5",
      description: "Balanced",
    },
    {
      id: "claude-haiku-4-5-20251001",
      label: "Claude Haiku 4.5",
      description: "Fast / Low cost",
    },
    {
      id: "gemini-2.5-flash",
      label: "Gemini 2.5 Flash",
      description: "Fast and efficient",
    },
    {
      id: "gemini-2.5-pro",
      label: "Gemini 2.5 Pro",
      description: "Advanced capabilities",
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
  
  // Mode switching safety
  const [showModeSwitchModal, setShowModeSwitchModal] = useState(false);
  const [pendingMode, setPendingMode] = useState<"auto" | "compare" | null>(null);

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
            const res = await fetch("/api/compare", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                responses: finalResponses,
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
      const prevResponse = lastTurn.response ||
        (lastTurn.modelPanels
          ? Object.values(lastTurn.modelPanels).find((p) => p.response)?.response || ""
          : "");
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
      // Derive legacy per-field values from the unified panel state
      // so that ConversationTurn / accordion rendering keeps working.
      const firstPanel = Object.values(modelPanels)[0] ?? null;

      const completedTurn: ConversationTurn = {
        id: createTurnId(),
        prompt: turnPrompt,
        isFollowUp: session !== null && session.turns.length > 0,
        timestamp: Date.now(),
        // Auto mode: populate legacy flat fields from the single panel
        response: !comparisonMode && firstPanel ? firstPanel.response : "",
        routing: !comparisonMode && firstPanel?.routing
          ? {
              mode: (firstPanel.routing.mode as "auto" | "manual") || "auto",
              intent: firstPanel.routing.intent,
              category: firstPanel.routing.category,
              chosenModel: firstPanel.routing.chosenModel,
              confidence: typeof firstPanel.routing.confidence === "number"
                ? firstPanel.routing.confidence
                : undefined,
              reason: firstPanel.routing.reason,
            }
          : null,
        metadata: !comparisonMode && firstPanel ? firstPanel.metadata : null,
        error: !comparisonMode && firstPanel ? firstPanel.error : null,
        // Compare mode: store full panel map
        modelPanels: comparisonMode ? { ...modelPanels } : null,
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

                      const modelDisplayName = "Gemini 2.5 Flash";
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

    if (Object.keys(modelPanels).length > 0) {
      setPendingMode(targetMode);
      setShowModeSwitchModal(true);
    } else {
      setComparisonMode(newMode);
    }
  };

  const clearResultsState = () => {
    setModelPanels({});
    setDiffSummary(null);
    setDiffError(null);
    setSession(null);
    setFollowUpInput("");
    setExpandedTurns({});
    setActiveFollowUpPrompt(null);
  };

  const handleModeSwitchStartNew = () => {
    if (!pendingMode) return;
    clearResultsState();
    setComparisonMode(pendingMode === "compare");
    setShowModeSwitchModal(false);
    setPendingMode(null);
  };

  const handleModeSwitchDuplicate = () => {
    if (!pendingMode) return;
    const currentPrompt = prompt;
    clearResultsState();
    setComparisonMode(pendingMode === "compare");
    setPrompt(currentPrompt);
    setShowModeSwitchModal(false);
    setPendingMode(null);
  };

  const handleModeSwitchCancel = () => {
    setShowModeSwitchModal(false);
    setPendingMode(null);
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
  const buildRequest = (params: {
    prompt: string;
    stream: boolean;
    models?: string[];
    previousPrompt?: string;
    previousResponse?: string;
    isFollowUp?: boolean;
  }): { body: string | FormData; headers: Record<string, string> } => {
    const hasFiles = attachedFiles.length > 0;

    if (hasFiles) {
      // Use multipart/form-data
      const formData = new FormData();
      formData.append("prompt", params.prompt);
      formData.append("stream", String(params.stream));
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-2 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            <span className="text-slate-900">Model</span>
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Triage</span>
          </h1>
          <p className="text-lg md:text-xl font-medium text-slate-700">
            Right LLM. Every time.
          </p>
        </header>

        {/* Mode Selector - Tier 2 (Secondary) */}
        <div className="mb-4">
          <div className="inline-flex rounded-lg bg-gray-100 p-1 gap-1">
            <button
              type="button"
              onClick={() => handleModeSwitch(false)}
              disabled={isStreaming}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                !comparisonMode
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              } ${isStreaming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              Auto-select LLM
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch(true)}
              disabled={isStreaming}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                comparisonMode
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              } ${isStreaming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              Compare models
            </button>
          </div>
          
          {/* Mode Switch Modal — rendered via portal-style at bottom of JSX */}
          
          {/* Helper text */}
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            {!comparisonMode 
              ? "We automatically choose the best model for your prompt."
              : "Select multiple models to compare responses side-by-side."}
          </p>
        </div>
        
        {/* Model Selection (Comparison Mode) */}
        <div
          className={`transition-all duration-300 origin-top ${
            comparisonMode
              ? "max-h-[600px] opacity-100 mb-4"
              : "max-h-0 opacity-0 overflow-hidden"
          }`}
        >
          {comparisonMode && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <label className="block text-sm font-bold text-gray-900 mb-3 tracking-tight">
                Select Models
              </label>
              <div className="grid grid-cols-4 gap-3">
                {availableModels.map((model) => {
                  const isSelected = selectedModels.includes(model.id);
                  
                  return (
                    <label
                      key={model.id}
                      className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "border-blue-500/60 bg-blue-500/5 shadow-sm ring-1 ring-blue-500/20"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedModels([...selectedModels, model.id]);
                          } else {
                            if (selectedModels.length > 1) {
                              setSelectedModels(
                                selectedModels.filter((id) => id !== model.id)
                              );
                            }
                          }
                        }}
                        disabled={isStreaming}
                        className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-0 transition-colors"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900 leading-tight">
                          {model.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          {model.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                {selectedModels.length} model{selectedModels.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          )}
        </div>

        {/* Prompt Input Form - Tier 1 (Primary) */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div 
            className="relative bg-slate-50 rounded-lg shadow-md border border-gray-300 p-6"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="prompt"
                className="block text-sm font-bold text-gray-900 tracking-tight"
              >
                Prompt
              </label>
              {session && session.turns.length > 0 && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-200 flex items-center gap-1">
                  <span>🔗</span>
                  Conversation active ({session.turns.length} turn{session.turns.length !== 1 ? "s" : ""})
                </span>
              )}
            </div>
            
            {/* Drag-and-drop indicator */}
            {isDraggingOver && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/80 backdrop-blur-sm rounded-lg border-2 border-blue-400 border-dashed pointer-events-none">
                <div className="text-center">
                  <div className="text-4xl mb-2">📎</div>
                  <div className="text-sm font-medium text-blue-700">Drop files to attach</div>
                  <div className="text-xs text-blue-600 mt-1">
                    {attachedFiles.length > 0 && `${3 - attachedFiles.length} more file${3 - attachedFiles.length !== 1 ? 's' : ''} allowed`}
                  </div>
                </div>
              </div>
            )}
            
            <textarea
              ref={promptInputRef}
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here..."
              className={`w-full px-5 py-4 border-2 rounded-lg outline-none resize-vertical bg-white text-lg leading-7 text-gray-900 placeholder:text-gray-400/70 transition-all duration-300 ease-out ${
                isDraggingOver
                  ? "border-blue-400 ring-4 ring-blue-500/20 bg-blue-50/30"
                  : isOverLimit 
                    ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10" 
                    : "border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              }`}
              rows={6}
              disabled={isStreaming}
              aria-describedby="character-count"
              style={{
                boxShadow: 'none',
              }}
            />
            
            {/* Utilities row - Tier 3 (Supporting) */}
            <div className="flex justify-between items-center mt-3 gap-4">
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                  disabled={isStreaming}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || attachedFiles.length >= 3}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 active:translate-y-[0.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center gap-2 text-gray-600"
                >
                  📎 Attach Files
                </button>
                {attachedFiles.length > 0 && (
                  <span className="text-xs text-gray-400 font-medium">
                    {attachedFiles.length}/3
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <span
                  id="character-count"
                  className={`text-xs font-medium ${
                    isOverLimit ? "text-red-600" : "text-gray-400"
                  }`}
                >
                  {characterCount} / 4,000
                </span>
                
                {/* Reset button */}
                <button
                  type="button"
                  onClick={handleResetPrompt}
                  disabled={!prompt.trim() || isStreaming}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-150 ${
                    resetConfirming
                      ? "text-orange-700 bg-orange-50 border border-orange-300 hover:bg-orange-100"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                  title={resetConfirming ? "Click again to confirm" : "Clear prompt"}
                >
                  {resetConfirming ? "Click again to clear" : "Reset"}
                </button>
                
                {promptHistory.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowHistory(!showHistory)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 transition-all duration-150 group"
                      title="Reuse or refine previous prompts"
                    >
                      <svg className="w-3.5 h-3.5 transition-transform duration-150 group-hover:rotate-[-15deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>History</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Prompt History Popover */}
            {showHistory && promptHistory.length > 0 && (
              <>
                {/* Backdrop to close on click outside */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowHistory(false)}
                />
                
                {/* Popover Panel */}
                <div className="relative z-20 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 bg-gradient-to-b from-gray-50/50 to-transparent border-b border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
                            <span className="text-gray-400">🕐</span>
                            <span>Recent prompts</span>
                          </h4>
                          <p className="text-xs text-gray-600 mt-0.5">
                            Click a prompt to reuse it instantly
                          </p>
                        </div>
                        
                        {/* Overflow menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowHistoryMenu(!showHistoryMenu);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 rounded-md transition-all duration-150"
                            aria-label="History options"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                          
                          {/* Dropdown menu */}
                          {showHistoryMenu && (
                            <>
                              <div 
                                className="fixed inset-0 z-30" 
                                onClick={() => setShowHistoryMenu(false)}
                              />
                              <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150">
                                <button
                                  type="button"
                                  onClick={() => {
                                    clearHistory();
                                    setShowHistoryMenu(false);
                                    setShowHistory(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                                >
                                  Clear history
                                </button>
                                <div className="h-px bg-gray-100 my-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRememberDrafts(!rememberDrafts);
                                    setShowHistoryMenu(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 flex items-center justify-between gap-2"
                                >
                                  <span>Remember drafts</span>
                                  <div className={`w-8 h-4 rounded-full transition-colors duration-200 ${
                                    rememberDrafts ? 'bg-blue-600' : 'bg-gray-300'
                                  }`}>
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5 ${
                                      rememberDrafts ? 'ml-4' : 'ml-0.5'
                                    }`} />
                                  </div>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Draft toggle hint */}
                      {rememberDrafts && (
                        <p className="text-[10px] text-blue-600 bg-blue-50/50 px-2 py-1 rounded">
                          Draft auto-saved on this device
                        </p>
                      )}
                    </div>
                    
                    {/* History List */}
                    <div className="max-h-64 overflow-y-auto">
                      {promptHistory.map((historyItem, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setPrompt(historyItem);
                            setShowHistory(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/50 active:bg-blue-100/50 transition-all duration-150 border-b border-gray-50 last:border-b-0 group cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex-1 truncate leading-relaxed">{historyItem}</span>
                            <div className="flex items-center gap-1.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0">
                              <span className="text-xs font-medium">Reuse</span>
                              <svg 
                                className="w-3.5 h-3.5" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* File Attachments */}
            {attachedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {attachedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    >
                      <span className="text-gray-600">
                        {file.type.startsWith("image/") ? "🖼️" : "📄"}
                      </span>
                      <span className="text-gray-900 font-medium">
                        {file.name}
                      </span>
                      <span className="text-gray-500 text-xs">
                        ({formatFileSize(file.size)})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        disabled={isStreaming}
                        className="ml-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        aria-label={`Remove ${file.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                  ⚠️ Avoid including secrets or sensitive data. Attachments are sent to the model.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                disabled={isStreaming || !prompt.trim() || isOverLimit}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-gradient-to-br hover:from-blue-600 hover:to-blue-700 active:translate-y-[1px] disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-all duration-200 shadow-sm"
              >
                {isStreaming ? "Processing..." : "Submit"}
              </button>

              {isStreaming && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 active:translate-y-[1px] font-medium transition-all duration-200"
                >
                  Cancel
                </button>
              )}

              {hasResults && !isStreaming && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 active:translate-y-[1px] font-medium transition-all duration-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Undo Toast */}
        {showUndoToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="bg-gray-900 text-white rounded-lg shadow-xl px-4 py-3 flex items-center gap-3">
              <span className="text-sm font-medium">Prompt cleared</span>
              <button
                type="button"
                onClick={handleUndoClear}
                className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-150"
              >
                Undo
              </button>
            </div>
          </div>
        )}

        {/* Previous Conversation Turns (Accordion) */}
        {session && session.turns.length > 0 && (
          <div className="space-y-2 mb-6">
            {session.turns.map((turn, turnIdx) => {
              const isExpanded = expandedTurns[turn.id] || false;
              const isAutoTurn = !!(turn.response && !turn.modelPanels);
              const isCompareTurn = !!(turn.modelPanels && Object.keys(turn.modelPanels).length > 0);

              // Build a concise summary label for the collapsed state
              const modelLabel = isAutoTurn && turn.routing?.chosenModel
                ? getFriendlyModelName(turn.routing.chosenModel)
                : isCompareTurn && turn.modelPanels
                  ? Object.keys(turn.modelPanels).map(getFriendlyModelName).join(", ")
                  : "";
              const promptPreview = turn.prompt.length > 120
                ? turn.prompt.substring(0, 120) + "…"
                : turn.prompt;

              return (
                <div key={turn.id} className="animate-in fade-in duration-200">
                  {/* Accordion Header — always visible */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTurns((prev) => ({
                        ...prev,
                        [turn.id]: !prev[turn.id],
                      }))
                    }
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 group ${
                      isExpanded
                        ? "bg-white border-gray-300 shadow-sm"
                        : "bg-gray-50/80 border-gray-200/60 hover:bg-gray-100/80 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Expand/collapse chevron */}
                      <svg
                        className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>

                      {/* Turn indicator */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {turn.isFollowUp ? (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Follow-up
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Previous
                          </span>
                        )}
                      </div>

                      {/* Prompt preview */}
                      <p className="text-sm text-gray-700 truncate flex-1 min-w-0">
                        {promptPreview}
                      </p>

                      {/* Model badge */}
                      {modelLabel && (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100/80 px-2 py-0.5 rounded-md font-mono flex-shrink-0 hidden sm:inline">
                          {modelLabel}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Accordion Body — expanded content */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      isExpanded ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0"
                    }`}
                  >
                    {/* Auto-select turn */}
                    {isAutoTurn && (
                      <div className="bg-slate-900/[0.02] rounded-xl shadow-sm border border-gray-200/50 overflow-hidden relative"
                        style={{
                          backgroundImage: `
                            repeating-linear-gradient(0deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px),
                            repeating-linear-gradient(90deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px)
                          `,
                          backgroundSize: '20px 20px'
                        }}
                      >
                        {/* Routing reason */}
                        {turn.routing && turn.routing.mode === "auto" && (
                          <div className="px-6 pt-3 pb-2 bg-white/40 backdrop-blur-sm relative">
                            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Auto-selected</span>
                              <span className="text-xs font-bold text-gray-900 font-mono">
                                {turn.routing.chosenModel ? getFriendlyModelName(turn.routing.chosenModel) : ""}
                              </span>
                            </div>
                            {turn.routing.reason && (
                              <p className="text-xs text-slate-600 leading-relaxed">{turn.routing.reason}</p>
                            )}
                          </div>
                        )}
                        {/* Response */}
                        <div className="m-3 bg-white rounded-lg border border-gray-200/60 shadow-sm">
                          <div className="px-6 py-4">
                            <div className="prose prose-sm max-w-none text-[15px] leading-7">
                              <FormattedResponse response={turn.response} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Compare mode turn */}
                    {isCompareTurn && turn.modelPanels && (
                      <div>
                        <div className={`grid gap-4 ${Object.keys(turn.modelPanels).length === 2 ? "md:grid-cols-2" : Object.keys(turn.modelPanels).length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                          {Object.entries(turn.modelPanels).map(([mId, panel]) => (
                            <div key={mId} className="bg-slate-900/[0.02] rounded-xl shadow-sm border border-gray-200/50 overflow-hidden"
                              style={{
                                backgroundImage: `
                                  repeating-linear-gradient(0deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px),
                                  repeating-linear-gradient(90deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px)
                                `,
                                backgroundSize: '20px 20px'
                              }}
                            >
                              <div className="px-4 pt-3 pb-2 bg-white/40 relative">
                                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                                <span className="text-xs font-bold text-gray-900 font-mono">{getFriendlyModelName(mId)}</span>
                                {panel.routing?.reason && (
                                  <p className="text-xs text-slate-500 leading-relaxed mt-1">{panel.routing.reason}</p>
                                )}
                              </div>
                              <div className="m-2 bg-white rounded-lg border border-gray-200/60 shadow-sm">
                                <div className="px-4 py-3">
                                  <div className="text-sm leading-relaxed">
                                    <FormattedResponse response={panel.response} mode="compare" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Unified Loading State - AI Pipeline (Both Modes) */}
        {/* Active Follow-Up Question Label — rendered above loading skeleton and response */}
        {activeFollowUpPrompt && (isStreaming || Object.keys(modelPanels).length > 0) && (
          <div className="flex items-start gap-2.5 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Follow-up</span>
              <p className="text-sm text-gray-800 leading-relaxed mt-0.5">{activeFollowUpPrompt}</p>
            </div>
          </div>
        )}

        {/*
          LATENCY OPTIMIZATION: Collapsed loading states.
          Previously showed a 3-step pipeline (Routing → Connecting → Preparing response)
          which made the wait feel longer than it was. Now shows a single compact
          "Selecting model..." state that transitions directly to streaming content.

          Compare mode still uses the multi-step pipeline via routing/connecting/contacting stages.
        */}
        {isStreaming && streamingStage && !comparisonMode && !Object.values(modelPanels).some(p => p.response) && (
          <div className="space-y-6">
            {/* Loading Pipeline */}
            <div className="bg-slate-900/[0.02] rounded-xl shadow-md border border-gray-200/50 overflow-hidden relative"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(0deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px),
                  repeating-linear-gradient(90deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px)
                `,
                backgroundSize: '20px 20px'
              }}
            >
              <div className="p-8">
                {/* Single-line loading indicator (Option C).
                    One piece of information at a time — updates as state changes:
                    1. "Selecting model..." (before routing resolves)
                    2. "Dispatching to [Provider]..." (once model is chosen)
                    3. "Starting response..." (first chunk arriving) */}
                <div className="flex items-center gap-3 mb-7">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-blue-600 bg-blue-50">
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                  <span className="text-lg font-semibold text-gray-900">
                    {(() => {
                      if (streamingStage === "streaming") return "Starting response\u2026";
                      const chosen = autoPanel?.routing?.chosenModel;
                      if (chosen) {
                        const label = chosen.includes("gemini") ? "Gemini" : chosen.includes("claude") ? "Claude" : chosen.includes("gpt") ? "GPT" : chosen;
                        return `Dispatching to ${label}\u2026`;
                      }
                      return "Selecting model\u2026";
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Skeleton Response Cards */}
            <div className={`grid gap-6 ${comparisonMode ? (selectedModels.length === 2 ? "md:grid-cols-2" : selectedModels.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2") : ""}`}>
              {(comparisonMode ? selectedModels : ["single"]).map((modelId, idx) => (
                <div 
                  key={modelId}
                  className="bg-slate-900/[0.02] rounded-xl shadow-md border border-gray-200/50 overflow-hidden relative"
                  style={{
                    backgroundImage: `
                      repeating-linear-gradient(0deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px),
                      repeating-linear-gradient(90deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px)
                    `,
                    backgroundSize: '20px 20px'
                  }}
                >
                  {/* Skeleton Header */}
                  {comparisonMode && (
                    <div className="px-6 pt-4 pb-3 bg-white/40 backdrop-blur-sm relative">
                      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="h-3 w-24 bg-gray-200/70 rounded animate-pulse" />
                        <div className="h-3 w-32 bg-gray-200/70 rounded animate-pulse" />
                      </div>
                    </div>
                  )}
                  
                  {/* Skeleton Response Content */}
                  <div className="m-3 bg-white rounded-lg border border-gray-200/60 shadow-sm">
                    <div className="px-6 py-4">
                      <div className="flex items-center gap-2.5 mb-4">
                        <span className="text-sm font-bold text-gray-700 tracking-tight">Response</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold text-gray-500 bg-gray-200/60 border border-gray-300/50 rounded uppercase tracking-wider">
                          Pending
                        </span>
                      </div>
                      <div className="space-y-3.5">
                        <div className="h-4 bg-gray-200/70 rounded-md w-full animate-pulse" />
                        <div className="h-4 bg-gray-200/70 rounded-md w-[97%] animate-pulse" />
                        <div className="h-4 bg-gray-200/70 rounded-md w-[82%] animate-pulse" />
                        <div className="h-4 bg-gray-200/70 rounded-md w-[93%] animate-pulse" />
                        <div className="h-4 bg-gray-200/70 rounded-md w-[68%] animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Single-Answer Mode Display */}
        {!comparisonMode && (
          <>
            {/* Response Display */}
            {(autoPanel?.response || autoPanel?.error || autoPanel?.metadata) && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {autoPanel?.response && (
                  <div className="bg-slate-900/[0.02] rounded-xl shadow-md border border-gray-200/50 overflow-hidden relative"
                    style={{
                      backgroundImage: `
                        repeating-linear-gradient(0deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px),
                        repeating-linear-gradient(90deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px)
                      `,
                      backgroundSize: '20px 20px'
                    }}
                  >
                    {/* Execution Header */}
                    {autoPanel.routing && autoPanel.routing.mode === "auto" && (
                      <div className="px-6 pt-4 pb-3 bg-white/40 backdrop-blur-sm relative">
                        {/* Hairline gradient divider */}
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                        
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <span className="text-gray-400 text-sm flex-shrink-0 mt-0.5">⚡</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Auto-selected</span>
                                <span className="text-sm font-bold text-gray-900 font-mono">
                                  {autoPanel.routing.chosenModel ? getFriendlyModelName(autoPanel.routing.chosenModel) : ""}
                                </span>
                                <span className="px-1.5 py-0.5 text-[10px] font-bold text-gray-600 bg-gray-100/80 border border-gray-300/50 rounded uppercase tracking-wider">
                                  Routed
                                </span>
                              </div>
                              
                              {/* Full routing reason - always visible */}
                              {/*
                                ASYNC HYDRATION: Routing explanation updates asynchronously.
                                Phase A (model dispatch) starts immediately. Phase B (TEXT_GIST + explanation)
                                runs in parallel. If the explanation isn't ready yet, we show a placeholder
                                that gets replaced when the routing_reason SSE event arrives.
                              */}
                              <div className="mt-2 rounded-lg border border-gray-200/60 bg-white/70 p-3 max-w-[900px]">
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {autoPanel.routing.reason || (isStreaming ? "Why this model was selected…" : "Analyzing your request to select the best model...")}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Response Content Panel */}
                    <div className="m-3 bg-white rounded-lg border border-gray-200/60 shadow-sm">
                      <div className="px-6 py-4">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-sm font-bold text-gray-900 tracking-tight uppercase text-gray-600 tracking-wider">
                            Response
                          </h2>
                          {isStreaming && (
                            <span className="px-2 py-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200/50 rounded uppercase tracking-wider">
                              Streaming
                            </span>
                          )}
                        </div>
                        <div className="prose prose-sm max-w-none text-[15px] leading-7">
                          <FormattedResponse response={autoPanel.response} />
                        </div>
                      </div>
                    </div>

                    {/* Run Metadata Chips */}
                    {autoPanel.metadata && (
                      <div className="px-6 pb-4 pt-3">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <div className="flex flex-wrap gap-2">
                            {/* Always visible chips */}
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Model</span>
                              <span className="text-xs font-bold text-gray-900 font-mono">{getFriendlyModelName(autoPanel.metadata.model)}</span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Provider</span>
                              <span className="text-xs font-bold text-gray-900">{autoPanel.metadata.provider}</span>
                            </div>
                          </div>
                          
                          {/* Run details disclosure toggle */}
                          <button
                            type="button"
                            onClick={() => autoPanel && updatePanel(autoPanel.modelId, { showRunDetails: !autoPanel.showRunDetails })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150 rounded-md hover:bg-gray-100/50"
                          >
                            <span>Run details</span>
                            <svg
                              className={`w-3 h-3 transition-transform duration-200 ${autoPanel.showRunDetails ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* Collapsible detail chips */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ease-out ${
                            autoPanel.showRunDetails ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
                          }`}
                        >
                          <div className="flex flex-wrap gap-2 pt-2">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Latency</span>
                              <span className="text-xs font-bold text-gray-900 font-mono tabular-nums">
                                {(autoPanel.metadata.latency / 1000).toFixed(1)}s
                              </span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Tokens</span>
                              <span className="text-xs font-bold text-gray-900 font-mono tabular-nums">
                                {autoPanel.metadata.tokenUsage?.total || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Follow-up Composer */}
                    {!isStreaming && !autoPanel.error && autoPanel.response && (
                      <FollowUpComposer
                        value={followUpInput}
                        onChange={setFollowUpInput}
                        onSubmit={handleFollowUpSubmit}
                        isLoading={isStreaming}
                        placeholder="Ask a follow-up question…"
                      />
                    )}
                  </div>
                )}

                {/* Empty Response Warning */}
                {!autoPanel?.response && !autoPanel?.error && autoPanel?.metadata && (
                  <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-yellow-600 text-lg">⚠️</span>
                      <div>
                        <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                          Empty Response
                        </h3>
                        <p className="text-sm text-yellow-800">
                          The model completed but returned no text. This may happen if all tokens were used for internal reasoning. Try a simpler prompt or consider the token limit.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Token Limit Warning */}
                {autoPanel?.metadata?.finishReason === "length" && (
                  <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-yellow-600 text-lg">⚠️</span>
                      <div>
                        <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                          Response Incomplete
                        </h3>
                        <p className="text-sm text-yellow-800">
                          The response was cut off because the model reached its token
                          limit. GPT-5 mini uses tokens for internal reasoning before
                          generating output. Consider using a model with a higher token
                          limit for complex queries.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {autoPanel?.error && (
                  <div className="bg-red-50 rounded-lg border border-red-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-red-600 text-lg">⚠️</span>
                        <div>
                          <h3 className="text-sm font-semibold text-red-900 mb-1">
                            Error
                          </h3>
                          <p className="text-sm text-red-700">{getUserFriendlyError(autoPanel.error)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClear}
                        className="px-4 py-1 text-sm bg-white text-red-700 border border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400 active:translate-y-[0.5px] font-medium transition-all duration-150"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instructions - Tier 3 (Supporting) */}
            {!autoPanel?.response && !isStreaming && !autoPanel?.error && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-8">
                <h3 className="text-sm font-bold text-gray-900 mb-5 tracking-tight">
                  How it works
                </h3>
                
                {/* Two-column layout for modes */}
                <div className="grid md:grid-cols-2 gap-8 mb-5">
                  {/* Single-Answer Mode */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">🎯</span>
                      <h4 className="text-sm font-semibold text-gray-900">
                        Single-Answer Mode
                      </h4>
                    </div>
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                      One response, automatically routed to the best model for your prompt.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600 leading-relaxed mb-3">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span>Submit a prompt and get one AI response</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span>Model is auto-selected based on prompt type</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span>Fast and cost-effective for most requests</span>
                      </li>
                    </ul>
                    <p className="text-xs text-gray-400">
                      <span className="font-medium text-gray-500">Best for:</span> everyday questions, coding, brainstorming, summaries
                    </p>
                  </div>

                  {/* Comparison Mode */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">⚡</span>
                      <h4 className="text-sm font-semibold text-gray-900">
                        Comparison Mode
                      </h4>
                    </div>
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                      Run the same prompt across multiple models and compare results side-by-side.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600 leading-relaxed mb-3">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span>Select models, then submit once to run them all</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span>See differences, agreement, and potential conflicts</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span>Useful when accuracy or tone matters</span>
                      </li>
                    </ul>
                    <p className="text-xs text-gray-400">
                      <span className="font-medium text-gray-500">Best for:</span> critical decisions, evaluation, verification
                    </p>
                  </div>
                </div>

                {/* Footer metadata */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    4,000 character limit • Real-time streaming
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Compare Mode Response Display */}
        {comparisonMode && Object.keys(modelPanels).length > 0 && (
          <>
            {/* Response Cards Grid */}
            <div className={`grid gap-6 mb-6 ${selectedModels.length === 2 ? "md:grid-cols-2" : selectedModels.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {Object.entries(modelPanels).map(([modelId, panel], idx) => (
                <div
                  key={modelId}
                  className="animate-in fade-in duration-300 h-full"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="bg-slate-900/[0.02] rounded-xl shadow-md border border-gray-200/50 overflow-hidden relative flex flex-col h-full"
                    style={{
                      backgroundImage: `
                        repeating-linear-gradient(0deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px),
                        repeating-linear-gradient(90deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px)
                      `,
                      backgroundSize: '20px 20px'
                    }}
                  >
                    {/* Execution Header — always show full routing reason */}
                    <div className="px-6 pt-4 pb-3 bg-white/40 backdrop-blur-sm relative">
                      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                      
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="text-gray-400 text-sm flex-shrink-0 mt-0.5">⚡</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Model</span>
                            <span className="text-sm font-bold text-gray-900 font-mono">
                              {getFriendlyModelName(modelId)}
                            </span>
                          </div>
                          {panel.routing?.reason && (
                            <div className="mt-1.5 rounded-lg border border-gray-200/60 bg-white/70 p-2.5">
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {panel.routing.reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Response Content Panel */}
                    <div className="m-3 bg-white rounded-lg border border-gray-200/60 shadow-sm flex-1 flex flex-col">
                      <div className="px-6 py-4 flex-1 flex flex-col">
                        {/* Streaming indicator - top right only */}
                        {isStreaming && !panel.metadata && !panel.error && (
                          <div className="flex justify-end mb-3">
                            <span className="px-2 py-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200/50 rounded uppercase tracking-wider">
                              Generating
                            </span>
                          </div>
                        )}
                        
                        {/* Response or Error/Empty States */}
                        {panel.error ? (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <span className="text-red-600 text-lg">❌</span>
                              <div>
                                <h4 className="text-sm font-semibold text-red-900 mb-1">
                                  Error
                                </h4>
                                <p className="text-sm text-red-700">
                                  {getUserFriendlyError(panel.error)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : !panel.response && panel.metadata ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-600 text-lg">⚠️</span>
                              <div>
                                <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                                  Empty Response
                                </h4>
                                <p className="text-sm text-yellow-800">
                                  The model completed but returned no text. This may happen if all tokens were used for internal reasoning.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : panel.response ? (
                          <div className="flex-1 flex flex-col min-h-0">
                            {/* Constrained content container */}
                            <div className={`relative transition-all duration-200 ease-out ${panel.isExpanded ? '' : 'max-h-[280px]'} ${!panel.isExpanded ? 'overflow-hidden' : ''}`}>
                              <div className="compare-response-content">
                                <FormattedResponse response={panel.response} mode="compare" />
                              </div>
                              
                              {/* Gradient fade for collapsed state */}
                              {!panel.isExpanded && panel.response.length > 400 && (
                                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                              )}
                            </div>
                            
                            {/* Expand/Collapse control */}
                            {panel.response.length > 400 && (
                              <button
                                type="button"
                                onClick={() => updatePanel(modelId, { isExpanded: !panel.isExpanded })}
                                className="mt-3 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150 text-left"
                              >
                                {panel.isExpanded ? '↑ Show less' : '↓ Expand full response'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">
                            Waiting for response...
                          </div>
                        )}

                        {/* Token Limit Warning */}
                        {panel.metadata?.finishReason === "length" && (
                          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-3 mt-4">
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-600">⚠️</span>
                              <div>
                                <h4 className="text-xs font-semibold text-yellow-900 mb-1">
                                  Response Incomplete
                                </h4>
                                <p className="text-xs text-yellow-800">
                                  Response cut off due to token limit.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Run Metadata Chips */}
                    {panel.metadata && (
                      <div className="px-6 pb-4 pt-3">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <div className="flex flex-wrap gap-2">
                            {/* Always visible chips */}
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Provider</span>
                              <span className="text-xs font-bold text-gray-900">{panel.metadata.provider}</span>
                            </div>
                          </div>
                          
                          {/* Run details disclosure toggle */}
                          <button
                            type="button"
                            onClick={() => updatePanel(modelId, { showRunDetails: !panel.showRunDetails })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150 rounded-md hover:bg-gray-100/50"
                          >
                            <span>Run details</span>
                            <svg
                              className={`w-3 h-3 transition-transform duration-200 ${panel.showRunDetails ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* Collapsible run details */}
                        <div className={`overflow-hidden transition-all duration-200 ease-out ${panel.showRunDetails ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="flex flex-wrap gap-2 pt-2">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Latency</span>
                              <span className="text-xs font-bold text-gray-900 font-mono tabular-nums">
                                {(panel.metadata.latency / 1000).toFixed(1)}s
                              </span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Tokens</span>
                              <span className="text-xs font-bold text-gray-900 font-mono tabular-nums">
                                {panel.metadata.tokenUsage?.total || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Comparison Summary - Modern AI-native design */}
            {!isStreaming && diffSummary && (
              <div className="bg-slate-900/[0.02] rounded-xl shadow-md border border-gray-200/50 overflow-hidden relative"
                style={{
                  backgroundImage: `
                    repeating-linear-gradient(0deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px),
                    repeating-linear-gradient(90deg, transparent, transparent 1px, rgb(0 0 0 / 0.01) 1px, rgb(0 0 0 / 0.01) 2px)
                  `,
                  backgroundSize: '20px 20px'
                }}
              >
                {/* Header Band */}
                <div className="px-6 pt-4 pb-3 bg-white/40 backdrop-blur-sm relative">
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🔍</span>
                    <h3 className="text-base font-bold text-gray-900 tracking-tight">
                      Comparison Summary
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 tracking-wide">
                    AI synthesis across selected models
                  </p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Verdict Callout */}
                  {(diffSummary.commonGround.length > 0 || diffSummary.keyDifferences.length > 0) && (
                    <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-4">
                      <div className="flex items-start gap-2.5">
                        <span className="text-blue-600 text-base flex-shrink-0 mt-0.5">💡</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-wide">
                            Verdict
                          </h4>
                          <p className="text-sm text-blue-900 leading-relaxed">
                            {diffSummary.commonGround.length > 0 && diffSummary.commonGround[0]}
                            {diffSummary.keyDifferences.length > 0 && diffSummary.commonGround.length > 0 && ` However, ${diffSummary.keyDifferences[0].points[0]?.toLowerCase()}`}
                            {diffSummary.keyDifferences.length > 0 && diffSummary.commonGround.length === 0 && diffSummary.keyDifferences[0].points[0]}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mini Cards Grid */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* Common Ground Card */}
                    {diffSummary.commonGround.length > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200/60 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-green-600 text-sm">✓</span>
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            Common Ground
                          </h4>
                          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold text-green-700 bg-green-100 rounded uppercase tracking-wider">
                            Consensus
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {diffSummary.commonGround.slice(0, 3).map((item, idx) => (
                            <li key={idx} className="text-xs text-gray-700 leading-relaxed flex items-start gap-2">
                              <span className="text-gray-400 text-[10px] mt-0.5 flex-shrink-0">•</span>
                              <span className="flex-1 min-w-0">{item}</span>
                            </li>
                          ))}
                        </ul>
                        {diffSummary.commonGround.length > 3 && (
                          <p className="text-[10px] text-gray-400 mt-2 font-medium">
                            +{diffSummary.commonGround.length - 3} more in full analysis
                          </p>
                        )}
                      </div>
                    )}

                    {/* Key Differences Card */}
                    {diffSummary.keyDifferences.length > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200/60 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-orange-600 text-sm">⚡</span>
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            Key Differences
                          </h4>
                          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold text-orange-700 bg-orange-100 rounded uppercase tracking-wider">
                            Outlier
                          </span>
                        </div>
                        <div className="space-y-3">
                          {diffSummary.keyDifferences.slice(0, 2).map((diff, idx) => (
                            <div key={idx} className="space-y-1">
                              <p className="text-xs font-semibold text-gray-800">
                                {diff.model}
                              </p>
                              <ul className="space-y-1">
                                {diff.points.slice(0, 2).map((point, pIdx) => (
                                  <li key={pIdx} className="text-xs text-gray-600 leading-relaxed flex items-start gap-2">
                                    <span className="text-gray-400 text-[10px] mt-0.5 flex-shrink-0">•</span>
                                    <span className="flex-1 min-w-0 line-clamp-2">{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                        {(diffSummary.keyDifferences.length > 2 || 
                          diffSummary.keyDifferences.some(d => d.points.length > 2)) && (
                          <p className="text-[10px] text-gray-400 mt-2 font-medium">
                            More details in full analysis
                          </p>
                        )}
                      </div>
                    )}

                    {/* Notable Gaps Card */}
                    {diffSummary.notableGaps.length > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200/60 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-purple-600 text-sm">◐</span>
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            Notable Gaps
                          </h4>
                          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold text-purple-700 bg-purple-100 rounded uppercase tracking-wider">
                            Gap
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {diffSummary.notableGaps.slice(0, 2).map((item, idx) => (
                            <li key={idx} className="text-xs text-gray-700 leading-relaxed flex items-start gap-2">
                              <span className="text-gray-400 text-[10px] mt-0.5 flex-shrink-0">•</span>
                              <span className="flex-1 min-w-0">{item}</span>
                            </li>
                          ))}
                        </ul>
                        {diffSummary.notableGaps.length > 2 && (
                          <p className="text-[10px] text-gray-400 mt-2 font-medium">
                            +{diffSummary.notableGaps.length - 2} more in full analysis
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Show Full Analysis Accordion */}
                  {(diffSummary.commonGround.length > 3 || 
                    diffSummary.keyDifferences.length > 2 || 
                    diffSummary.notableGaps.length > 2 ||
                    diffSummary.keyDifferences.some(d => d.points.length > 2)) && (
                    <div className="border-t border-gray-200 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors duration-150"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${showFullAnalysis ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>{showFullAnalysis ? 'Hide full analysis' : 'Show full analysis'}</span>
                      </button>

                      {/* Full Analysis Content */}
                      <div className={`overflow-hidden transition-all duration-300 ease-out ${showFullAnalysis ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                        <div className="space-y-6 bg-gray-50/50 rounded-lg p-4 border border-gray-200/60">
                          {/* Full Common Ground */}
                          {diffSummary.commonGround.length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-green-900 mb-3 flex items-center gap-2">
                                <span>✓</span>
                                <span>Common Ground</span>
                              </h4>
                              <ul className="space-y-2">
                                {diffSummary.commonGround.map((item, idx) => (
                                  <li key={idx} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                                    <span className="text-gray-400 mt-0.5">•</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Full Key Differences */}
                          {diffSummary.keyDifferences.length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <span>⚡</span>
                                <span>Key Differences</span>
                              </h4>
                              <div className="space-y-4">
                                {diffSummary.keyDifferences.map((diff, idx) => (
                                  <div key={idx}>
                                    <h5 className="text-sm font-semibold text-gray-800 mb-2">
                                      {diff.model}
                                    </h5>
                                    <ul className="space-y-1.5 ml-3">
                                      {diff.points.map((point, pIdx) => (
                                        <li key={pIdx} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                                          <span className="text-gray-400 mt-0.5">•</span>
                                          <span>{point}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Full Notable Gaps */}
                          {diffSummary.notableGaps.length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2">
                                <span>◐</span>
                                <span>Notable Gaps</span>
                              </h4>
                              <ul className="space-y-2">
                                {diffSummary.notableGaps.map((item, idx) => (
                                  <li key={idx} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                                    <span className="text-gray-400 mt-0.5">•</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Follow-up Composer */}
                {!isStreaming && (
                  <FollowUpComposer
                    value={followUpInput}
                    onChange={setFollowUpInput}
                    onSubmit={handleFollowUpSubmit}
                    isLoading={isStreaming}
                    placeholder="Ask a follow-up about this comparison…"
                  />
                )}
              </div>
            )}

            {/* Loading state for comparison summary - AI-native design */}
            {!isStreaming && !diffSummary && !diffError && Object.keys(modelPanels).length >= 2 && (
              (() => {
                const successfulCount = Object.values(modelPanels).filter(
                  (p) => !p.error && p.response.length > 0 && p.metadata
                ).length;
                
                if (successfulCount >= 2) {
                  return (
                    <div className="bg-slate-900/[0.03] rounded-xl shadow-md border border-gray-200/50 overflow-hidden relative animate-in fade-in duration-300"
                      style={{
                        backgroundImage: `
                          repeating-linear-gradient(0deg, transparent, transparent 1px, rgb(0 0 0 / 0.015) 1px, rgb(0 0 0 / 0.015) 2px),
                          repeating-linear-gradient(90deg, transparent, transparent 1px, rgb(0 0 0 / 0.015) 1px, rgb(0 0 0 / 0.015) 2px)
                        `,
                        backgroundSize: '20px 20px'
                      }}
                    >
                      <div className="p-8">
                        {/* Header with spinner */}
                        <div className="flex items-center gap-3 mb-6">
                          <div 
                            className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"
                            style={{
                              animation: 'spin 1.5s linear infinite'
                            }}
                          />
                          <div className="flex-1">
                            <h3 className="text-base font-extrabold text-gray-900 tracking-[-0.01em]">
                              Comparing responses
                            </h3>
                            <p className="text-xs text-gray-500/80 mt-1 leading-[1.6]">
                              Synthesizing similarities, differences, and gaps across models
                            </p>
                          </div>
                        </div>

                        {/* Skeleton Preview */}
                        <div className="space-y-4">
                          {/* Verdict skeleton */}
                          <div className="bg-blue-50/40 border border-blue-200/40 rounded-lg p-4">
                            <div className="space-y-2">
                              <div className="h-3 bg-gradient-to-r from-blue-200/30 via-blue-200/50 to-blue-200/30 rounded w-20 animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%'
                                }}
                              />
                              <div className="h-3 bg-gradient-to-r from-blue-200/30 via-blue-200/50 to-blue-200/30 rounded w-full animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%',
                                  animationDelay: '0.1s'
                                }}
                              />
                              <div className="h-3 bg-gradient-to-r from-blue-200/30 via-blue-200/50 to-blue-200/30 rounded w-4/5 animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%',
                                  animationDelay: '0.2s'
                                }}
                              />
                            </div>
                          </div>

                          {/* Summary cards skeleton */}
                          <div className="grid md:grid-cols-3 gap-3">
                            <div className="bg-white/60 rounded-lg border border-gray-200/50 p-3 space-y-2">
                              <div className="h-2.5 bg-gradient-to-r from-gray-200/50 via-gray-200/70 to-gray-200/50 rounded w-24 animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%'
                                }}
                              />
                              <div className="h-2 bg-gradient-to-r from-gray-200/50 via-gray-200/70 to-gray-200/50 rounded w-full animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%',
                                  animationDelay: '0.15s'
                                }}
                              />
                              <div className="h-2 bg-gradient-to-r from-gray-200/50 via-gray-200/70 to-gray-200/50 rounded w-5/6 animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%',
                                  animationDelay: '0.3s'
                                }}
                              />
                            </div>
                            <div className="bg-white/60 rounded-lg border border-gray-200/50 p-3 space-y-2">
                              <div className="h-2.5 bg-gradient-to-r from-gray-200/50 via-gray-200/70 to-gray-200/50 rounded w-28 animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%',
                                  animationDelay: '0.1s'
                                }}
                              />
                              <div className="h-2 bg-gradient-to-r from-gray-200/50 via-gray-200/70 to-gray-200/50 rounded w-full animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%',
                                  animationDelay: '0.25s'
                                }}
                              />
                              <div className="h-2 bg-gradient-to-r from-gray-200/50 via-gray-200/70 to-gray-200/50 rounded w-4/5 animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%',
                                  animationDelay: '0.4s'
                                }}
                              />
                            </div>
                            <div className="bg-white/60 rounded-lg border border-gray-200/50 p-3 space-y-2">
                              <div className="h-2.5 bg-gradient-to-r from-gray-200/50 via-gray-200/70 to-gray-200/50 rounded w-20 animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%',
                                  animationDelay: '0.2s'
                                }}
                              />
                              <div className="h-2 bg-gradient-to-r from-gray-200/50 via-gray-200/70 to-gray-200/50 rounded w-full animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%',
                                  animationDelay: '0.35s'
                                }}
                              />
                              <div className="h-2 bg-gradient-to-r from-gray-200/50 via-gray-200/70 to-gray-200/50 rounded w-3/4 animate-shimmer" 
                                style={{
                                  backgroundSize: '200% 100%',
                                  animationDelay: '0.5s'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()
            )}

            {diffError && (
              <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
                <p className="text-sm text-yellow-800">
                  Note: {diffError}
                </p>
              </div>
            )}

            {/* Show message when not enough successful panels for comparison */}
            {!isStreaming && !diffSummary && !diffError && Object.keys(modelPanels).length > 0 && (
              (() => {
                const successfulCount = Object.values(modelPanels).filter(
                  (p) => !p.error && p.response.length > 0 && p.metadata
                ).length;
                const errorCount = Object.values(modelPanels).filter((p) => p.error).length;
                
                if (errorCount > 0 && successfulCount < 2) {
                  return (
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                      <p className="text-sm text-gray-700">
                        ℹ Comparison requires at least 2 successful responses. 
                        {successfulCount === 1 
                          ? " Only 1 panel completed successfully."
                          : " No panels completed successfully."}
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

      {/* Mode Switch Confirmation Modal */}
      <ModeSwitchModal
        isOpen={showModeSwitchModal}
        currentMode={comparisonMode ? "compare" : "auto"}
        targetMode={pendingMode || "auto"}
        onStartNew={handleModeSwitchStartNew}
        onDuplicate={handleModeSwitchDuplicate}
        onCancel={handleModeSwitchCancel}
      />
    </div>
  );
}
