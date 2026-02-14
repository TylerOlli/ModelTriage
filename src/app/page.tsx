"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { DiffSummary } from "@/lib/diff";
import { availableModels, getProviderName, getFriendlyModelName } from "@/lib/models";
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
import { PromptComposer } from "../components/PromptComposer";
import { AutoResponseView } from "../components/AutoResponseView";
import { CompareResponseView } from "../components/CompareResponseView";
import { ConversationHistory } from "../components/ConversationHistory";

// ModelPanel type alias — canonical definition lives in lib/session-types.ts
type ModelPanel = ModelPanelData;

/**
 * Get or create an anonymous user ID for routing analytics.
 * Stored in localStorage — not linked to any account.
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
  if (isGenericReason(newReason) && !isGenericReason(existingReason)) return false;
  return newReason.length > existingReason.length && !isGenericReason(newReason);
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);

  // ── Auth & Usage State ────────────────────────────────────
  const { user, usage, toast, refreshUsage } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalMessage, setLoginModalMessage] = useState<string | undefined>();
  const [usageLimitExceeded, setUsageLimitExceeded] = useState<{
    requiresAuth: boolean;
    used: number;
    limit: number;
  } | null>(null);

  useEffect(() => {
    if (user && usageLimitExceeded?.requiresAuth) {
      setUsageLimitExceeded(null);
    }
  }, [user, usageLimitExceeded?.requiresAuth]);

  // Unified follow-up input (shared between both modes)
  const [followUpInput, setFollowUpInput] = useState("");

  // Conversation session — tracks multi-turn history in memory
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({});
  const [activeFollowUpPrompt, setActiveFollowUpPrompt] = useState<string | null>(null);

  // File attachment state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Track if IMAGE_GIST has upgraded routing.reason
  const imageGistUpgradedRef = useRef(false);
  const streamingStartRef = useRef<number | null>(null);

  /**
   * Streaming stage tracking
   * "selecting" → "streaming" for auto mode
   * "routing" → "connecting" → "streaming" for compare mode
   */
  const [streamingStage, setStreamingStage] = useState<
    "selecting" | "connecting" | "routing" | "contacting" | "streaming" | null
  >(null);

  // Model selection state
  const [selectedModels, setSelectedModels] = useState<string[]>(["gpt-5-mini", "gpt-5.2"]);

  // Prompt history state
  const [promptHistory, setPromptHistory] = useState<string[]>([]);

  // Draft prompt persistence toggle (default OFF)
  const [rememberDrafts, setRememberDrafts] = useState(false);

  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Unified Response State ──────────────────────────────────
  const [modelPanels, setModelPanels] = useState<Record<string, ModelPanel>>({});
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Derived: auto mode single panel
  const autoPanel = !comparisonMode ? Object.values(modelPanels)[0] ?? null : null;

  /** Update a single field on a panel (works for both modes). */
  const updatePanel = useCallback((modelId: string, updates: Partial<ModelPanel>) => {
    setModelPanels(prev => ({
      ...prev,
      [modelId]: { ...prev[modelId], ...updates },
    }));
  }, []);

  // ─── Persistence Effects ────────────────────────────────────

  // Load persisted state on mount
  useEffect(() => {
    const persistedComparisonMode = localStorage.getItem("comparisonMode");
    const persistedDraftToggle = localStorage.getItem("rememberDrafts");
    const persistedPrompt = localStorage.getItem("lastPrompt");

    if (persistedComparisonMode !== null) setComparisonMode(persistedComparisonMode === "true");
    const shouldRememberDrafts = persistedDraftToggle === "true";
    setRememberDrafts(shouldRememberDrafts);
    if (shouldRememberDrafts && persistedPrompt) {
      setPrompt(persistedPrompt);
    } else {
      localStorage.removeItem("lastPrompt");
    }
  }, []);

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
          const validModelIds = availableModels.map((m) => m.id);
          const validPersistedModels = parsed.filter((id: string) => validModelIds.includes(id));
          if (validPersistedModels.length > 0) setSelectedModels(validPersistedModels);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedModels", JSON.stringify(selectedModels));
  }, [selectedModels]);

  // Load prompt history (only for logged-in users)
  useEffect(() => {
    if (!user) return;
    const savedHistory = localStorage.getItem("promptHistory");
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setPromptHistory(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem("promptHistory", JSON.stringify(promptHistory));
  }, [promptHistory, user]);

  useEffect(() => {
    if (!user) setPromptHistory([]);
  }, [user]);

  // Persist prompt (debounced)
  useEffect(() => {
    if (!rememberDrafts) return;
    const timeoutId = setTimeout(() => {
      if (prompt.trim()) {
        localStorage.setItem("lastPrompt", prompt);
      } else {
        localStorage.removeItem("lastPrompt");
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [prompt, rememberDrafts]);

  useEffect(() => {
    localStorage.setItem("rememberDrafts", rememberDrafts.toString());
    if (!rememberDrafts) localStorage.removeItem("lastPrompt");
  }, [rememberDrafts]);

  // Generate diff summary after streaming completes with multiple models
  useEffect(() => {
    if (!isStreaming && Object.keys(modelPanels).length > 1) {
      const generateSummary = async () => {
        try {
          const successfulPanels = Object.values(modelPanels).filter(
            (p) => !p.error && p.response.length > 0 && p.metadata
          );
          if (successfulPanels.length >= 2) {
            const finalResponses = successfulPanels.map((p) => ({
              model: p.routing?.model || p.modelId,
              content: p.response,
            }));
            setDiffSummary(null);
            setDiffError(null);
            const responseTimeMs = streamingStartRef.current
              ? Date.now() - streamingStartRef.current
              : null;
            const res = await fetch("/api/compare", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                responses: finalResponses,
                anonymousId: getAnonymousId(),
                prompt,
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

  // ─── Prompt History ──────────────────────────────────────────

  const addToHistory = (submittedPrompt: string) => {
    if (!user) return;
    const trimmed = submittedPrompt.trim();
    if (!trimmed) return;
    setPromptHistory((prev) => {
      if (prev.length > 0 && prev[0] === trimmed) return prev;
      const filtered = prev.filter((p) => p !== trimmed);
      return [trimmed, ...filtered].slice(0, 10);
    });
  };

  const clearHistory = () => {
    setPromptHistory([]);
    localStorage.removeItem("promptHistory");
  };

  // ─── Follow-up Context ──────────────────────────────────────

  const getFollowUpContext = useCallback((): {
    previousPrompt: string;
    previousResponse: string;
  } => {
    if (session && session.turns.length > 0) {
      const lastTurn = session.turns[session.turns.length - 1];
      const prevResponse = Object.values(lastTurn.modelPanels).find((p) => p.response)?.response || "";
      return { previousPrompt: lastTurn.prompt, previousResponse: prevResponse };
    }
    if (Object.keys(modelPanels).length > 0) {
      const firstResponse = Object.values(modelPanels).find((p) => p.response)?.response || "";
      return { previousPrompt: prompt, previousResponse: firstResponse };
    }
    return { previousPrompt: "", previousResponse: "" };
  }, [session, prompt, modelPanels]);

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

  // ─── SSE Parser ──────────────────────────────────────────────

  async function* parseSSE(response: Response): AsyncGenerator<{
    event: string;
    data: any;
  }> {
    if (!response.body) throw new Error("No response body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        let currentEvent = "";
        let currentData = "";
        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.substring(6).trim();
          } else if (line.startsWith("data:")) {
            currentData = line.substring(5).trim();
          } else if (line === "" && currentEvent && currentData) {
            try {
              yield { event: currentEvent, data: JSON.parse(currentData) };
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

  // ─── Form Submit ────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    addToHistory(prompt);

    if (isStreaming || abortControllerRef.current) {
      console.warn("Run already in progress, ignoring duplicate submit");
      return;
    }

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

    setSession(null);
    setFollowUpInput("");
    setExpandedTurns({});
    setActiveFollowUpPrompt(null);
    setUsageLimitExceeded(null);
    await handleStreamSubmit();
  };

  // ─── Stream Handler ─────────────────────────────────────────

  const handleStreamSubmit = async (overridePrompt?: string) => {
    const submittedPrompt = overridePrompt || prompt;
    const isCompare = comparisonMode;

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
      setModelPanels({});
    }

    setDiffSummary(null);
    setDiffError(null);
    setIsStreaming(true);
    setStreamingStage(isCompare ? "routing" : "selecting");
    imageGistUpgradedRef.current = false;
    streamingStartRef.current = Date.now();

    abortControllerRef.current = new AbortController();

    const followUpCtx = getFollowUpContext();
    const isFollowUp = !!activeFollowUpPrompt && !!(followUpCtx.previousPrompt && followUpCtx.previousResponse);

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

      const textBuffers: Record<string, string> = {};
      if (isCompare) {
        selectedModels.forEach((m) => { textBuffers[m] = ""; });
      }

      let hasReceivedChunk = false;
      let currentAutoModel: string | null = null;

      // IMAGE_GIST parsing state (auto mode only)
      let gistBuffer = "";
      let gistParsed = isCompare;

      // ── SSE loop ─────────────────────────────────────────────
      for await (const { event, data } of parseSSE(res)) {
        if (event === "meta") {
          if (isCompare) {
            setStreamingStage("connecting");
          } else {
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
              }
            } else if (currentAutoModel) {
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
          if (data.routing) {
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
          if (data.reason) {
            setModelPanels((prev) => {
              const key = Object.keys(prev)[0];
              if (!key || !prev[key]?.routing) return prev;
              const panel = prev[key];
              if (data.forceUpdate) {
                return { ...prev, [key]: { ...panel, routing: { ...panel.routing!, reason: data.reason } } };
              }
              const existingReason = panel.routing!.reason;
              if (isMoreDescriptive(data.reason, existingReason)) {
                return { ...prev, [key]: { ...panel, routing: { ...panel.routing!, reason: data.reason } } };
              }
              return prev;
            });
          }
        } else if (event === "ping") {
          // Keep-alive
        } else if (event === "chunk") {
          if (!hasReceivedChunk) {
            setStreamingStage("streaming");
            hasReceivedChunk = true;
          }

          if (isCompare) {
            const modelId = data.model;
            textBuffers[modelId] = (textBuffers[modelId] || "") + data.delta;
            setModelPanels((prev) => ({
              ...prev,
              [modelId]: { ...prev[modelId], response: textBuffers[modelId] },
            }));
          } else {
            // ── Auto mode: single buffer with IMAGE_GIST parsing
            const modelId = currentAutoModel || Object.keys(textBuffers)[0];

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
                      const promptLower = submittedPrompt.toLowerCase();
                      let userIntent = "analyze the code";
                      if (promptLower.match(/improve|optimize|refactor|enhance|better/)) userIntent = "suggest improvements";
                      else if (promptLower.match(/explain|describe|what does|how does|understand/)) userIntent = "explain what it does";
                      else if (promptLower.match(/fix|debug|error|issue|problem|bug|wrong/)) userIntent = "identify issues and fixes";

                      const modelDisplayName = "Gemini 3 Flash";
                      let newReason = "";
                      if (gist.certainty === "high" && gist.language && gist.language !== "unknown" && gist.purpose && gist.purpose !== "unknown") {
                        newReason = `This screenshot shows ${gist.language} code that ${gist.purpose}, so ${modelDisplayName} is a strong fit to accurately read code from images and ${userIntent}.`;
                      } else if (gist.language && gist.language !== "unknown") {
                        newReason = `This screenshot shows ${gist.language} code, so ${modelDisplayName} is a strong fit to accurately read code from images and ${userIntent}.`;
                      } else {
                        newReason = `This screenshot contains code, so ${modelDisplayName} is a strong fit to accurately read code from images and ${userIntent}.`;
                      }

                      imageGistUpgradedRef.current = true;
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
                      textBuffers[modelId] = textAfterGist;
                      setModelPanels((prev) => {
                        const key = Object.keys(prev)[0];
                        if (!key) return prev;
                        return { ...prev, [key]: { ...prev[key], response: textBuffers[modelId] } };
                      });
                    } catch {
                      gistParsed = true;
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
          if (!isCompare && gistBuffer.length > 0 && !gistParsed) {
            const modelId = currentAutoModel || Object.keys(textBuffers)[0];
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

      if (!isCompare) {
        const modelId = currentAutoModel || Object.keys(textBuffers)[0];
        if (modelId && !textBuffers[modelId]) throw new Error("No response received");
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          // Handled by handleCancel
        } else {
          setModelPanels((prev) => {
            if (Object.keys(prev).length === 0) {
              return {
                _error: { modelId: "_error", routing: null, response: "", metadata: null, error: (err as Error).message, showRunDetails: false, isExpanded: false },
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
            return { _error: { modelId: "_error", routing: null, response: "", metadata: null, error: errMsg, showRunDetails: false, isExpanded: false } };
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
      refreshUsage();
    }
  };

  // ─── Actions ─────────────────────────────────────────────────

  const handleCancel = () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        const cancelMessage = comparisonMode ? "Cancelled by user" : "Stream cancelled";
        setModelPanels((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((id) => {
            if (!updated[id].metadata) updated[id] = { ...updated[id], error: cancelMessage };
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
    setModelPanels({});
    setDiffSummary(null);
    setDiffError(null);
    setSession(null);
    setFollowUpInput("");
    setExpandedTurns({});
    setActiveFollowUpPrompt(null);
    setAttachedFiles([]);
    setPrompt("");
    localStorage.removeItem("lastPrompt");
  };

  const handleModeSwitch = (newMode: boolean) => {
    const targetMode = newMode ? "compare" : "auto";
    const currentMode = comparisonMode ? "compare" : "auto";
    if (targetMode === currentMode) return;
    setModelPanels({});
    setDiffSummary(null);
    setDiffError(null);
    setSession(null);
    setFollowUpInput("");
    setExpandedTurns({});
    setActiveFollowUpPrompt(null);
    setComparisonMode(newMode);
  };

  const handleFollowUpSubmit = () => {
    const followUpText = followUpInput.trim();
    if (!followUpText || isStreaming) return;
    pushCurrentTurnToSession(prompt);
    setActiveFollowUpPrompt(followUpText);
    setModelPanels({});
    setDiffSummary(null);
    setDiffError(null);
    addToHistory(followUpText);
    setFollowUpInput("");
    handleStreamSubmit(followUpText);
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
    const anonymousId = getAnonymousId();

    if (hasFiles) {
      const formData = new FormData();
      formData.append("prompt", params.prompt);
      formData.append("stream", String(params.stream));
      formData.append("anonymousId", anonymousId);
      if (params.models) formData.append("models", JSON.stringify(params.models));
      if (params.previousPrompt) formData.append("previousPrompt", params.previousPrompt);
      if (params.previousResponse) formData.append("previousResponse", params.previousResponse);
      if (params.isFollowUp) formData.append("isFollowUp", "true");
      attachedFiles.forEach((file, index) => formData.append(`file_${index}`, file));
      return { body: formData, headers: {} };
    } else {
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
        headers: { "Content-Type": "application/json" },
      };
    }
  };

  const hasResults = Object.keys(modelPanels).length > 0;

  // ─── Render ──────────────────────────────────────────────────

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
            refreshUsage();
          }}
          message={loginModalMessage}
        />

        {/* Prompt Composer */}
        <PromptComposer
          prompt={prompt}
          setPrompt={setPrompt}
          isStreaming={isStreaming}
          hasResults={hasResults}
          comparisonMode={comparisonMode}
          onModeSwitch={handleModeSwitch}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onClear={handleClear}
          user={user}
          usage={usage}
          attachedFiles={attachedFiles}
          onFilesChange={setAttachedFiles}
          selectedModels={selectedModels}
          onSelectedModelsChange={setSelectedModels}
          promptHistory={promptHistory}
          onClearHistory={clearHistory}
          rememberDrafts={rememberDrafts}
          onRememberDraftsChange={setRememberDrafts}
          session={session}
          promptInputRef={promptInputRef}
        />

        {/* Previous Conversation Turns */}
        {session && session.turns.length > 0 && (
          <ConversationHistory
            session={session}
            expandedTurns={expandedTurns}
            onToggleTurn={(turnId) =>
              setExpandedTurns((prev) => ({ ...prev, [turnId]: !prev[turnId] }))
            }
          />
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
                setLoginModalMessage("Create a free account to get 15 requests per day.");
                setShowLoginModal(true);
              }}
            />
          </div>
        )}

        {/* Auto-select Mode */}
        {!comparisonMode && (
          <AutoResponseView
            panel={autoPanel}
            isStreaming={isStreaming}
            streamingStage={streamingStage}
            followUpInput={followUpInput}
            onFollowUpChange={setFollowUpInput}
            onFollowUpSubmit={handleFollowUpSubmit}
            onClear={handleClear}
            onToggleRunDetails={() =>
              autoPanel && updatePanel(autoPanel.modelId, { showRunDetails: !autoPanel.showRunDetails })
            }
          />
        )}

        {/* Compare Mode */}
        {comparisonMode && Object.keys(modelPanels).length > 0 && (
          <CompareResponseView
            modelPanels={modelPanels}
            isStreaming={isStreaming}
            diffSummary={diffSummary}
            diffError={diffError}
            followUpInput={followUpInput}
            onFollowUpChange={setFollowUpInput}
            onFollowUpSubmit={handleFollowUpSubmit}
          />
        )}
      </div>

      {/* Auth toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-neutral-900 text-white text-sm rounded-xl shadow-lg animate-enter">
          {toast}
        </div>
      )}
    </div>
  );
}
