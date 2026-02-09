"use client";

import { useState, useRef, useEffect } from "react";
import type { DiffSummary } from "@/lib/diff";
import { FormattedResponse } from "../components/FormattedResponse";

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

interface ModelPanel {
  modelId: string;
  routing: {
    model: string;
    reason: string;
    confidence: string;
  } | null;
  response: string;
  metadata: {
    model: string;
    provider: string;
    latency: number;
    tokenUsage?: { total: number };
    finishReason?: string;
  } | null;
  error: string | null;
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
  
  // Run details disclosure state
  const [showRunDetails, setShowRunDetails] = useState(false);

  // File attachment state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track if IMAGE_GIST has upgraded routing.reason (prevent overwrites)
  const imageGistUpgradedRef = useRef(false);

  // Streaming stage tracking
  const [streamingStage, setStreamingStage] = useState<
    "connecting" | "routing" | "contacting" | "streaming" | null
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

  // Single-answer mode state
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [routing, setRouting] = useState<{
    mode: "auto" | "manual";
    intent?: string;
    category?: string;
    chosenModel?: string;
    confidence?: number;
    reason?: string;
  } | null>(null);
  const [metadata, setMetadata] = useState<{
    model: string;
    provider: string;
    latency: number;
    tokenUsage?: { total: number };
    finishReason?: string;
  } | null>(null);
  
  // UI-only override for routing reason (from IMAGE_GIST)
  const [routingReasonOverride, setRoutingReasonOverride] = useState<string | null>(null);

  // Conversation continuation state (for follow-up prompts)
  const [previousPrompt, setPreviousPrompt] = useState<string>("");
  const [previousResponse, setPreviousResponse] = useState<string>("");
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // Comparison Mode state
  const [modelPanels, setModelPanels] = useState<Record<string, ModelPanel>>({});
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    const persistedComparisonMode = localStorage.getItem("comparisonMode");
    const persistedPrompt = localStorage.getItem("lastPrompt");

    if (persistedComparisonMode !== null) {
      setComparisonMode(persistedComparisonMode === "true");
    }
    if (persistedPrompt) {
      setPrompt(persistedPrompt);
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
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (prompt.trim()) {
        localStorage.setItem("lastPrompt", prompt);
      } else {
        localStorage.removeItem("lastPrompt");
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [prompt]);

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
      setError("Prompt exceeds maximum length of 4,000 characters");
      return;
    }

    if (comparisonMode) {
      await handleVerifyModeSubmit();
    } else {
      await handleSingleAnswerSubmit();
    }
  };

  const handleSingleAnswerSubmit = async () => {
    // Reset state
    setResponse("");
    setError(null);
    setRouting(null);
    setRoutingReasonOverride(null);
    setMetadata(null);
    setIsStreaming(true);
    setStreamingStage("connecting"); // Initial stage
    setShowRunDetails(false); // Collapse details on new request
    
    // Reset IMAGE_GIST upgrade tracking
    imageGistUpgradedRef.current = false;

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const { body, headers } = buildRequest({
        prompt,
        stream: true,
        previousPrompt,
        previousResponse,
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

      // Parse SSE stream
      let currentModel: string | null = null;
      let textBuffer = "";
      let hasReceivedChunk = false;
      
      // IMAGE_GIST parsing state (frontend-only)
      let gistBuffer = "";
      let gistParsed = false;
      let gistLineFullyConsumed = false;

      for await (const { event, data } of parseSSE(res)) {
        if (event === "meta") {
          // First meta event - show routing stage immediately for auto mode
          if (data.status === "connected") {
            // Initial connection established - show routing for auto mode
            setStreamingStage("routing");
          }
          
          // Store routing metadata
          if (data.routing) {
            console.log("[STREAM] meta routing reason:", data.routing.reason);
            
            // Only set routing from meta if IMAGE_GIST hasn't upgraded it yet
            if (!imageGistUpgradedRef.current) {
              setRouting(data.routing);
              console.log("[STREAM] Set routing from meta (IMAGE_GIST not yet parsed)");
            } else {
              console.log("[STREAM] Skipping meta routing update - IMAGE_GIST has already upgraded reason");
            }
            
            // After routing completes, switch to contacting
            if (data.routing.mode === "auto") {
              setStreamingStage("contacting");
            } else {
              setStreamingStage("contacting");
            }
          }
          if (data.models) {
            currentModel = data.models[0]; // Single answer mode has one model
          }
        } else if (event === "model_start") {
          // Model is starting
          setStreamingStage("contacting");
        } else if (event === "routing_update") {
          // Update routing with IMAGE_GIST-derived information
          console.log("Received routing_update event:", data);
          if (data.routing) {
            console.log("Updating routing with IMAGE_GIST-derived reason:", data.routing.reason);
            if (data.imageGist) {
              console.log("IMAGE_GIST metadata:", data.imageGist);
            }
            setRouting(data.routing);
          }
        } else if (event === "routing_reason") {
          // Legacy handler for routing_reason events (non-IMAGE_GIST updates)
          console.log("Received routing_reason event:", data);
          if (data.reason) {
            console.log("Evaluating routing reason update:", data.reason);
            setRouting((prev) => {
              if (prev) {
                const existingReason = prev.reason;
                console.log("Previous routing reason:", existingReason);
                
                // Check if new reason is more descriptive
                if (isMoreDescriptive(data.reason, existingReason)) {
                  console.log("✓ Updating to more descriptive reason:", data.reason);
                  return { ...prev, reason: data.reason };
                } else {
                  console.log("✗ Keeping existing reason (new one is generic or less descriptive)");
                  return prev;
                }
              }
              return prev;
            });
          }
        } else if (event === "ping") {
          // Keep-alive ping, ignore
        } else if (event === "chunk") {
          // First chunk arrived - switch to streaming stage
          if (!hasReceivedChunk) {
            setStreamingStage("streaming");
            hasReceivedChunk = true;
          }
          
          // Log chunk delta (first 80 chars)
          console.log("[STREAM] chunk delta head:", data.delta.slice(0, 80));
          
          // IMAGE_GIST parsing (frontend-only, ONLY for image requests)
          // Check if this might be an image response by looking for IMAGE_GIST in early chunks
          if (!gistParsed) {
            if (gistBuffer.length < 800) {
              gistBuffer += data.delta;
              
              // Check if IMAGE_GIST line is complete (has newline after it)
              if (gistBuffer.includes("IMAGE_GIST:") && gistBuffer.includes("\n")) {
                const gistLineStart = gistBuffer.indexOf("IMAGE_GIST:");
                const gistLineEnd = gistBuffer.indexOf("\n", gistLineStart);
                
                if (gistLineEnd !== -1) {
                  // Extract and parse IMAGE_GIST
                  const gistLine = gistBuffer.substring(gistLineStart, gistLineEnd);
                  const jsonPart = gistLine.substring("IMAGE_GIST:".length).trim();
                  
                  try {
                    const gist = JSON.parse(jsonPart);
                    console.log("[STREAM] parsed IMAGE_GIST:", gist);
                    
                    // Infer user intent from prompt
                    const promptLower = prompt.toLowerCase();
                    let userIntent = "analyze the code";
                    if (promptLower.match(/improve|optimize|refactor|enhance|better/)) {
                      userIntent = "suggest improvements";
                    } else if (promptLower.match(/explain|describe|what does|how does|understand/)) {
                      userIntent = "explain what it does";
                    } else if (promptLower.match(/fix|debug|error|issue|problem|bug|wrong/)) {
                      userIntent = "identify issues and fixes";
                    }
                    
                    // Build prompt-aware routing reason from gist
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
                    
                    // Set UI-only override (persists through stream completion)
                    setRoutingReasonOverride(newReason);
                    
                    // Mark that IMAGE_GIST has upgraded the routing reason
                    imageGistUpgradedRef.current = true;
                    console.log("[STREAM] IMAGE_GIST upgrade flag set - preventing future meta overwrites");
                    
                    setRouting((prev) => {
                      if (prev) {
                        return { ...prev, reason: newReason };
                      }
                      return prev;
                    });
                    
                    gistParsed = true;
                    
                    // Strip IMAGE_GIST line from buffer
                    const textAfterGist = gistBuffer.substring(gistLineEnd + 1);
                    gistBuffer = "";
                    gistLineFullyConsumed = true;
                    
                    // Start displaying text after the gist line
                    textBuffer = textAfterGist;
                    setResponse(textBuffer);
                  } catch (e) {
                    console.warn("[UI] Failed to parse IMAGE_GIST:", e);
                    gistParsed = true;
                    gistLineFullyConsumed = true;
                    // Show all text if parsing fails
                    textBuffer += gistBuffer;
                    gistBuffer = "";
                    setResponse(textBuffer);
                  }
                }
              }
            } else {
              // Buffer reached 800 chars without finding IMAGE_GIST - this is NOT an image response
              // Flush the buffer to textBuffer and stop buffering
              console.log("[STREAM] No IMAGE_GIST found in first 800 chars - treating as normal response");
              gistParsed = true; // Stop buffering
              textBuffer += gistBuffer;
              gistBuffer = "";
              setResponse(textBuffer);
              // Also add current delta
              textBuffer += data.delta;
              setResponse(textBuffer);
            }
          } else {
            // Normal chunk processing (after gist is parsed or buffer is full)
            textBuffer += data.delta;
            setResponse(textBuffer);
          }
        } else if (event === "done") {
          // Update metadata when done
          setMetadata({
            model: data.model,
            provider: getProviderName(data.model),
            latency: data.latencyMs || 0,
            tokenUsage: data.tokenUsage
              ? { total: data.tokenUsage.totalTokens }
              : undefined,
            finishReason: data.finishReason,
          });
        } else if (event === "error") {
          // Handle error
          throw new Error(data.message || "Stream error");
        } else if (event === "complete") {
          // Stream complete - flush any remaining gistBuffer content
          if (gistBuffer.length > 0 && !gistParsed) {
            console.log("[STREAM] Stream complete - flushing remaining buffer:", gistBuffer.length, "chars");
            textBuffer += gistBuffer;
            gistBuffer = "";
            setResponse(textBuffer);
          }
          break;
        }
      }

      // If no text was received, show error
      if (!textBuffer) {
        throw new Error("No response received");
      }

      // Save conversation context for potential follow-up
      setPreviousPrompt(prompt);
      setPreviousResponse(textBuffer);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          setError("Stream cancelled");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setIsStreaming(false);
      setStreamingStage(null);
      abortControllerRef.current = null;
    }
  };

  const handleVerifyModeSubmit = async () => {
    // Reset state
    const models = selectedModels;
    const initialPanels: Record<string, ModelPanel> = {};
    models.forEach((modelId) => {
      initialPanels[modelId] = {
        modelId: modelId,
        routing: null,
        response: "",
        metadata: null,
        error: null,
      };
    });

    setModelPanels(initialPanels);
    setDiffSummary(null);
    setDiffError(null);
    setIsStreaming(true);
    setStreamingStage("connecting"); // Initial stage

    // Create abort controller
    abortControllerRef.current = new AbortController();

    // Track text buffers for each model
    const textBuffers: Record<string, string> = {};
    models.forEach((modelId) => {
      textBuffers[modelId] = "";
    });

    let hasReceivedAnyChunk = false;

    try {
      const { body, headers } = buildRequest({
        prompt,
        stream: true,
        models,
        previousPrompt,
        previousResponse,
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

      // Parse SSE stream
      for await (const { event, data } of parseSSE(res)) {
        if (event === "meta") {
          // Manual mode - show contacting as soon as connected
          if (streamingStage === "connecting") {
            setStreamingStage("contacting");
          }
        } else if (event === "model_start") {
          // Models are starting
          setStreamingStage("contacting");
        } else if (event === "ping") {
          // Keep-alive ping, ignore
        } else if (event === "chunk") {
          // First chunk arrived - switch to streaming stage
          if (!hasReceivedAnyChunk) {
            setStreamingStage("streaming");
            hasReceivedAnyChunk = true;
          }
          // Append delta to the specific model's response
          const modelId = data.model;
          textBuffers[modelId] += data.delta;
          
          setModelPanels((prev) => ({
            ...prev,
            [modelId]: {
              ...prev[modelId],
              response: textBuffers[modelId],
            },
          }));
        } else if (event === "done") {
          // Update metadata when model completes
          const modelId = data.model;
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
          // Handle error for specific model
          const modelId = data.model;
          setModelPanels((prev) => ({
            ...prev,
            [modelId]: {
              ...prev[modelId],
              error: data.message || "Stream error",
            },
          }));
        } else if (event === "complete") {
          // Stream complete
          break;
        }
      }

      // Diff summary will be generated by useEffect after state updates complete
      
      // Save conversation context for potential follow-up (use first successful response)
      const firstSuccessfulResponse = Object.values(textBuffers).find(text => text.length > 0);
      if (firstSuccessfulResponse) {
        setPreviousPrompt(prompt);
        setPreviousResponse(firstSuccessfulResponse);
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          // Stream was cancelled - panels already marked in handleCancel
          // Do nothing here, let the finally block clean up
        } else {
          // Set error for all panels
          Object.keys(initialPanels).forEach((modelId) => {
            setModelPanels((prev) => ({
              ...prev,
              [modelId]: {
                ...prev[modelId],
                error: err.message,
              },
            }));
          });
        }
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
        
        // Mark all active panels as cancelled in Comparison Mode
        if (comparisonMode && Object.keys(modelPanels).length > 0) {
          setModelPanels((prevPanels) => {
            const updatedPanels = { ...prevPanels };
            Object.keys(updatedPanels).forEach((modelId) => {
              // Only mark as cancelled if not already completed (no metadata yet)
              if (!updatedPanels[modelId].metadata) {
                updatedPanels[modelId] = {
                  ...updatedPanels[modelId],
                  error: "Cancelled by user",
                };
              }
            });
            return updatedPanels;
          });
        }
      }
    } catch (err) {
      console.error("Error during cancel:", err);
    } finally {
      // Always reset streaming state to prevent stuck UI
      setIsStreaming(false);
      setStreamingStage(null);
      abortControllerRef.current = null;
    }
  };

  const handleClear = () => {
    // Reset single-answer mode state
    setResponse("");
    setError(null);
    setRouting(null);
    setMetadata(null);

    // Reset Comparison Mode state
    setModelPanels({});
    setDiffSummary(null);
    setDiffError(null);

    // Clear conversation context
    setPreviousPrompt("");
    setPreviousResponse("");

    // Clear attached files
    setAttachedFiles([]);

    // Clear prompt text and remove from localStorage
    setPrompt("");
    localStorage.removeItem("lastPrompt");
  };

  const handleContinueConversation = () => {
    // Focus the prompt input to let user type a follow-up
    promptInputRef.current?.focus();
    // Scroll to prompt input
    promptInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // File attachment handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Limit to 3 files max
    if (attachedFiles.length + files.length > 3) {
      alert("Maximum 3 files allowed");
      return;
    }

    setAttachedFiles([...attachedFiles, ...files]);
    // Reset input so same file can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
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
  const hasResults = response || error || Object.keys(modelPanels).length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ModelTriage
          </h1>
          <p className="text-gray-600">
            LLM decision and verification layer
          </p>
        </header>

        {/* Mode Selector - Tier 2 (Secondary) */}
        <div className="mb-4">
          <div className="inline-flex rounded-lg bg-gray-100 p-1 gap-1">
            <button
              type="button"
              onClick={() => setComparisonMode(false)}
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
              onClick={() => setComparisonMode(true)}
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
          
          {/* Helper text */}
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            {!comparisonMode 
              ? "We automatically choose the best model for your prompt."
              : "Select multiple models to compare responses side-by-side."}
          </p>
        </div>
        
        {/* Model Selection (Comparison Mode) */}
        <div
          className={`transition-all duration-300 origin-top ${
            comparisonMode
              ? "max-h-[600px] opacity-100 mb-6"
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
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="bg-slate-50 rounded-lg shadow-md border border-gray-300 p-8">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="prompt"
                className="block text-sm font-bold text-gray-900 tracking-tight"
              >
                Prompt
              </label>
              {previousPrompt && previousResponse && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-200 flex items-center gap-1">
                  <span>🔗</span>
                  Continuing conversation
                </span>
              )}
            </div>
            <textarea
              ref={promptInputRef}
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                previousPrompt && previousResponse 
                  ? "Ask a follow-up question..." 
                  : "Enter your prompt here..."
              }
              className={`w-full px-5 py-4 border-2 rounded-lg outline-none resize-vertical bg-white text-lg leading-7 text-gray-900 placeholder:text-gray-400/70 transition-all duration-300 ease-out ${
                isOverLimit 
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
                  accept=".txt,.log,.json,.md,.ts,.tsx,.js,.jsx,.env,.yml,.yaml,image/png,image/jpeg,image/webp"
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
                {promptHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors duration-150"
                  >
                    {showHistory ? "Hide History" : "Show History"}
                  </button>
                )}
              </div>
            </div>

            {/* Prompt History */}
            {showHistory && promptHistory.length > 0 && (
              <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-900 tracking-tight">
                    Recent Prompts
                  </h4>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold transition-colors duration-150"
                  >
                    Clear History
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {promptHistory.map((historyItem, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setPrompt(historyItem);
                        setShowHistory(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 hover:border-gray-300 transition-all duration-150"
                    >
                      <span className="line-clamp-2">{historyItem}</span>
                    </button>
                  ))}
                </div>
              </div>
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

        {/* Loading State - AI Pipeline */}
        {isStreaming && !comparisonMode && !response && streamingStage && (
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
              {/* Execution Header */}
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">
                Executing
              </div>

              {/* Pipeline Stepper */}
              <div className="flex items-center gap-2.5 mb-6">
                {/* Step 1: Routing */}
                <div className="flex items-center gap-2.5">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-200 ${
                    streamingStage === "routing" 
                      ? "border-blue-600 bg-blue-50" 
                      : streamingStage === "connecting" || streamingStage === "contacting" || streamingStage === "streaming"
                      ? "border-green-500 bg-green-50"
                      : "border-gray-300 bg-white"
                  }`}>
                    {(streamingStage === "connecting" || streamingStage === "contacting" || streamingStage === "streaming") ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : streamingStage === "routing" ? (
                      <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gray-300" />
                    )}
                  </div>
                  <span className={`text-sm font-semibold transition-colors duration-200 ${
                    streamingStage === "routing" ? "text-gray-900" : "text-gray-500"
                  }`}>Routing</span>
                </div>

                {/* Connector */}
                <div className={`h-0.5 w-10 rounded-full transition-colors duration-200 ${
                  streamingStage === "connecting" || streamingStage === "contacting" || streamingStage === "streaming"
                    ? "bg-green-500"
                    : "bg-gray-300"
                }`} />

                {/* Step 2: Connecting */}
                <div className="flex items-center gap-2.5">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-200 ${
                    streamingStage === "connecting" || streamingStage === "contacting"
                      ? "border-blue-600 bg-blue-50"
                      : streamingStage === "streaming"
                      ? "border-green-500 bg-green-50"
                      : "border-gray-300 bg-white"
                  }`}>
                    {streamingStage === "streaming" ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (streamingStage === "connecting" || streamingStage === "contacting") ? (
                      <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gray-300" />
                    )}
                  </div>
                  <span className={`text-sm font-semibold transition-colors duration-200 ${
                    streamingStage === "connecting" || streamingStage === "contacting" ? "text-gray-900" : "text-gray-500"
                  }`}>Connecting</span>
                </div>

                {/* Connector */}
                <div className={`h-0.5 w-10 rounded-full transition-colors duration-200 ${
                  streamingStage === "streaming" ? "bg-green-500" : "bg-gray-300"
                }`} />

                {/* Step 3: Generating */}
                <div className="flex items-center gap-2.5">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-200 ${
                    streamingStage === "streaming"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-300 bg-white"
                  }`}>
                    {streamingStage === "streaming" ? (
                      <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gray-300" />
                    )}
                  </div>
                  <span className={`text-sm font-semibold transition-colors duration-200 ${
                    streamingStage === "streaming" ? "text-gray-900" : "text-gray-500"
                  }`}>Generating</span>
                </div>
              </div>

              {/* Two-line Status */}
              <div className="mb-7 space-y-1.5">
                <p className="text-lg font-semibold text-gray-900 transition-opacity duration-200">
                  {streamingStage === "routing" && "Routing request"}
                  {streamingStage === "connecting" && "Connecting to provider"}
                  {streamingStage === "contacting" && "Connecting to provider"}
                  {streamingStage === "streaming" && "Generating response"}
                </p>
                <p className="text-sm text-gray-500 transition-opacity duration-200">
                  {streamingStage === "routing" && "Selecting the best model for your prompt"}
                  {streamingStage === "connecting" && "Establishing secure connection"}
                  {streamingStage === "contacting" && "Establishing secure connection"}
                  {streamingStage === "streaming" && "Tokens will appear as they arrive"}
                </p>
              </div>

              {/* Response Skeleton Preview */}
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
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
        )}

        {/* Single-Answer Mode Display */}
        {!comparisonMode && Object.keys(modelPanels).length === 0 && (
          <>
            {/* Response Display */}
            {(response || error || metadata) && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {response && (
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
                    {routing && routing.mode === "auto" && (
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
                                  {routing.chosenModel ? getFriendlyModelName(routing.chosenModel) : routing.chosenModel}
                                </span>
                                <span className="px-1.5 py-0.5 text-[10px] font-bold text-gray-600 bg-gray-100/80 border border-gray-300/50 rounded uppercase tracking-wider">
                                  Routed
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 leading-relaxed line-clamp-1">
                                {routing.reason || "Analyzing your request to select the best model..."}
                              </p>
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
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <div className="animate-spin w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full" />
                              <span>Processing</span>
                            </div>
                          )}
                        </div>
                        <div className="prose prose-sm max-w-none text-[15px] leading-7">
                          <FormattedResponse response={response} />
                        </div>
                      </div>
                    </div>

                    {/* Run Metadata Chips */}
                    {metadata && (
                      <div className="px-6 pb-4 pt-3">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <div className="flex flex-wrap gap-2">
                            {/* Always visible chips */}
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Model</span>
                              <span className="text-xs font-bold text-gray-900 font-mono">{getFriendlyModelName(metadata.model)}</span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Provider</span>
                              <span className="text-xs font-bold text-gray-900">{metadata.provider}</span>
                            </div>
                          </div>
                          
                          {/* Run details disclosure toggle */}
                          <button
                            type="button"
                            onClick={() => setShowRunDetails(!showRunDetails)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150 rounded-md hover:bg-gray-100/50"
                          >
                            <span>Run details</span>
                            <svg
                              className={`w-3 h-3 transition-transform duration-200 ${showRunDetails ? 'rotate-180' : ''}`}
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
                            showRunDetails ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
                          }`}
                        >
                          <div className="flex flex-wrap gap-2 pt-2">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Latency</span>
                              <span className="text-xs font-bold text-gray-900 font-mono tabular-nums">
                                {(metadata.latency / 1000).toFixed(1)}s
                              </span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/[0.03] border border-gray-300/50 rounded-md">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Tokens</span>
                              <span className="text-xs font-bold text-gray-900 font-mono tabular-nums">
                                {metadata.tokenUsage?.total || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Follow-up Action */}
                    {!isStreaming && !error && (
                      <div className="px-6 pb-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleContinueConversation}
                          className="px-4 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 active:translate-y-[0.5px] transition-all duration-150 flex items-center gap-1.5"
                        >
                          <span>💬</span>
                          <span>Ask a follow-up</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty Response Warning */}
                {!response && !error && metadata && (
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
                {metadata?.finishReason === "length" && (
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
                {error && (
                  <div className="bg-red-50 rounded-lg border border-red-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-red-600 text-lg">⚠️</span>
                        <div>
                          <h3 className="text-sm font-semibold text-red-900 mb-1">
                            Error
                          </h3>
                          <p className="text-sm text-red-700">{getUserFriendlyError(error)}</p>
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
            {!response && !isStreaming && !error && (
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

        {/* Comparison Mode Display */}
        {/* Multi-Model Comparison (works for both single-answer with multiple models and verify mode) */}
        {Object.keys(modelPanels).length > 0 && (
          <>
            {/* Side-by-side Model Panels */}
            <div className={`grid gap-6 mb-6 ${selectedModels.length === 2 ? "md:grid-cols-2" : selectedModels.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {Object.entries(modelPanels).map(([modelId, panel]) => (
                <div
                  key={modelId}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                >
                  {/* Routing Info */}
                  {panel.routing && (
                    <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-3 mb-4">
                      <div className="flex items-start gap-2">
                        <span className="text-indigo-600">🎯</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-xs font-semibold text-indigo-900">
                              {getFriendlyModelName(panel.routing.model)}
                            </h4>
                            {confidenceToLabel(Number(panel.routing.confidence)) && (
                              <span className="text-xs text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                                {confidenceToLabel(Number(panel.routing.confidence))}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-indigo-700">
                            {panel.routing.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Response */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Response
                      </h3>
                      {isStreaming && !panel.metadata && !panel.error && (
                        <div className="animate-spin w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full" />
                      )}
                    </div>
                    
                    {/* Show partial response if it exists */}
                    {panel.response && (
                      <div className="mb-3">
                        <FormattedResponse response={panel.response} />
                      </div>
                    )}
                    
                    {/* Show error card if panel errored */}
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
                              The model completed but returned no text. This may happen if all tokens were used for internal reasoning. Try a simpler prompt or check the token limit warning above.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : !panel.response && (
                      <div className="text-sm text-gray-400">
                        Waiting for response...
                      </div>
                    )}
                  </div>

                  {/* Token Limit Warning */}
                  {panel.metadata?.finishReason === "length" && (
                    <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-3 mb-3">
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

                  {/* Metadata */}
                  {panel.metadata && (
                    <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                      <div>
                        <span className="text-gray-600">Latency:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {(panel.metadata.latency / 1000).toFixed(1)} seconds
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Tokens:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {panel.metadata.tokenUsage?.total || "N/A"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Diff Summary */}
            {!isStreaming && diffSummary && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Comparison Summary
                </h3>

                {/* Common Ground */}
                {diffSummary.commonGround.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-green-900 mb-3">
                      Common Ground
                    </h4>
                    <ul className="space-y-2">
                      {diffSummary.commonGround.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-700 leading-relaxed">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Key Differences */}
                {diffSummary.keyDifferences.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Key Differences
                    </h4>
                    <div className="space-y-4">
                      {diffSummary.keyDifferences.map((diff, idx) => (
                        <div key={idx}>
                          <h5 className="text-sm font-medium text-gray-800 mb-2">
                            {diff.model}
                          </h5>
                          <ul className="space-y-1.5 ml-3">
                            {diff.points.map((point, pIdx) => (
                              <li key={pIdx} className="text-sm text-gray-700 leading-relaxed">
                                • {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notable Gaps */}
                {diffSummary.notableGaps.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-orange-900 mb-3">
                      Notable Gaps
                    </h4>
                    <ul className="space-y-2">
                      {diffSummary.notableGaps.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-700 leading-relaxed">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Loading state for comparison summary */}
            {!isStreaming && !diffSummary && !diffError && Object.keys(modelPanels).length >= 2 && (
              (() => {
                const successfulCount = Object.values(modelPanels).filter(
                  (p) => !p.error && p.response.length > 0 && p.metadata
                ).length;
                
                if (successfulCount >= 2) {
                  return (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center gap-3 text-gray-600">
                        <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                        <span className="text-sm">Generating comparison summary...</span>
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

            {/* Continue Conversation Button for Comparison Mode */}
            {!isStreaming && Object.keys(modelPanels).length > 0 && (
              (() => {
                const hasAnyResponse = Object.values(modelPanels).some(
                  (p) => !p.error && p.response.length > 0
                );
                if (hasAnyResponse) {
                  return (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={handleContinueConversation}
                        className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-gradient-to-br hover:from-blue-600 hover:to-blue-700 active:translate-y-[1px] font-medium transition-all duration-200 text-sm flex items-center gap-2"
                      >
                        <span>💬</span>
                        Ask a follow-up
                      </button>
                    </div>
                  );
                }
                return null;
              })()
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
    </div>
  );
}
