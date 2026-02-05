"use client";

import { useState, useRef, useEffect } from "react";
import { diffAnalyzer } from "@/lib/diff";
import type { DiffSummary } from "@/lib/diff";

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

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);

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

  // Conversation continuation state (for follow-up prompts)
  const [previousPrompt, setPreviousPrompt] = useState<string>("");
  const [previousResponse, setPreviousResponse] = useState<string>("");
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // Verify Mode state
  const [modelPanels, setModelPanels] = useState<Record<string, ModelPanel>>({});
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    const persistedVerifyMode = localStorage.getItem("verifyMode");
    const persistedPrompt = localStorage.getItem("lastPrompt");

    if (persistedVerifyMode !== null) {
      setVerifyMode(persistedVerifyMode === "true");
    }
    if (persistedPrompt) {
      setPrompt(persistedPrompt);
    }
  }, []);

  // Persist Verify Mode state
  useEffect(() => {
    localStorage.setItem("verifyMode", verifyMode.toString());
  }, [verifyMode]);

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
          const summary = diffAnalyzer.analyze(finalResponses);
          setDiffSummary(summary);
        } else if (successfulPanels.length === 1) {
          // Not enough panels for comparison, but don't show error
          setDiffSummary(null);
        }
      } catch (err) {
        setDiffError("Could not generate diff summary");
      }
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

    if (verifyMode) {
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
    setMetadata(null);
    setIsStreaming(true);
    setStreamingStage("connecting"); // Initial stage

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt,
          stream: true, // Enable SSE streaming
          // No models array = auto-routing mode
          ...(previousPrompt && previousResponse && {
            previousPrompt,
            previousResponse,
          }),
        }),
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

      for await (const { event, data } of parseSSE(res)) {
        if (event === "meta") {
          // First meta event - show routing stage immediately for auto mode
          if (data.status === "connected") {
            // Initial connection established - show routing for auto mode
            setStreamingStage("routing");
          }
          
          // Store routing metadata
          if (data.routing) {
            setRouting(data.routing);
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
        } else if (event === "routing_reason") {
          // Update routing reason with AI-generated explanation
          console.log("Received routing_reason event:", data);
          if (data.reason) {
            console.log("Updating routing reason to:", data.reason);
            setRouting((prev) => {
              if (prev) {
                console.log("Previous routing:", prev);
                return { ...prev, reason: data.reason };
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
          // Append delta to response incrementally
          textBuffer += data.delta;
          setResponse(textBuffer);
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
          // Stream complete
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
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt, 
          models,
          stream: true, // Enable SSE streaming
          ...(previousPrompt && previousResponse && {
            previousPrompt,
            previousResponse,
          }),
        }),
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
        
        // Mark all active panels as cancelled in Verify Mode
        if (verifyMode && Object.keys(modelPanels).length > 0) {
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

    // Reset Verify Mode state
    setModelPanels({});
    setDiffSummary(null);
    setDiffError(null);

    // Clear conversation context
    setPreviousPrompt("");
    setPreviousResponse("");

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

        {/* Verify Mode Toggle */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Verify Mode
              </h3>
              <p className="text-sm text-gray-600">
                Compare responses from multiple models
                {verifyMode && (
                  <span className="text-orange-600 font-medium"> (higher cost and latency)</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVerifyMode(!verifyMode)}
              disabled={isStreaming}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                verifyMode ? "bg-blue-600" : "bg-gray-300"
              } ${isStreaming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  verifyMode ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-gray-700"
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
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-vertical bg-white text-gray-900 placeholder:text-gray-400 ${
                isOverLimit ? "border-red-500" : "border-gray-300"
              }`}
              rows={6}
              disabled={isStreaming}
              aria-describedby="character-count"
            />
            <div className="flex justify-between items-center mt-2">
              <span
                id="character-count"
                className={`text-sm ${
                  isOverLimit ? "text-red-600" : "text-gray-500"
                }`}
              >
                {characterCount} / 4,000 characters
              </span>
              {promptHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {showHistory ? "Hide History" : "Show History"}
                </button>
              )}
            </div>

            {/* Prompt History */}
            {showHistory && promptHistory.length > 0 && (
              <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Recent Prompts
                  </h4>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
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
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 bg-white hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <span className="line-clamp-2">{historyItem}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Model Picker - Only show in Advanced/Verify Mode */}
            {verifyMode && (
              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Select Models to Compare
                </label>
              <div className="grid grid-cols-4 gap-3">
                {availableModels.map((model) => (
                  <label
                    key={model.id}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedModels.includes(model.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedModels([...selectedModels, model.id]);
                        } else {
                          // Don't allow unchecking if it's the last selected model
                          if (selectedModels.length > 1) {
                            setSelectedModels(
                              selectedModels.filter((id) => id !== model.id)
                            );
                          }
                        }
                      }}
                      disabled={isStreaming}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {model.label}
                      </div>
                      <div className="text-xs text-gray-500">{model.description}</div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Selected: {selectedModels.length} model{selectedModels.length !== 1 ? "s" : ""}
              </p>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                disabled={isStreaming || !prompt.trim() || isOverLimit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {isStreaming ? "Processing..." : "Submit"}
              </button>

              {isStreaming && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  Cancel
                </button>
              )}

              {hasResults && !isStreaming && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Loading State */}
        {isStreaming && !verifyMode && !response && streamingStage && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 text-gray-600">
              <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span>
                {streamingStage === "connecting" && "Connecting..."}
                {streamingStage === "routing" && "Routing..."}
                {streamingStage === "contacting" && "Contacting models..."}
                {streamingStage === "streaming" && "Streaming..."}
              </span>
            </div>
          </div>
        )}

        {/* Single-Answer Mode Display */}
        {!verifyMode && Object.keys(modelPanels).length === 0 && (
          <>
            {/* Routing Information */}
            {routing && routing.mode === "auto" && (
              <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-indigo-600 text-lg">🎯</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-indigo-900">
                        Auto-selected Model
                      </h3>
                      {verifyMode && confidenceToLabel(routing.confidence) && (
                        <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                          {confidenceToLabel(routing.confidence)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-indigo-800 mb-2">
                      <span className="font-medium">
                        {routing.chosenModel ? getFriendlyModelName(routing.chosenModel) : routing.chosenModel}
                      </span>
                    </p>
                    <p className="text-sm text-indigo-700">
                      {routing.reason || "Selected as the best match for your request."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Response Display */}
            {(response || error || metadata) && (
              <div className="space-y-4">
                {response && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Response
                      </h2>
                      {isStreaming && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                          <span>Processing...</span>
                        </div>
                      )}
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                        {response}
                      </pre>
                    </div>
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

                {/* Metadata */}
                {metadata && (
                  <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Model:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {metadata.model}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Provider:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {metadata.provider}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Latency:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {(metadata.latency / 1000).toFixed(1)} seconds
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Tokens:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {metadata.tokenUsage?.total || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Continue Conversation Button */}
                {response && !isStreaming && !error && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={handleContinueConversation}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm flex items-center gap-2"
                    >
                      <span>💬</span>
                      Ask a follow-up
                    </button>
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
                        className="px-4 py-1 text-sm bg-white text-red-700 border border-red-300 rounded-lg hover:bg-red-50 font-medium transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            {!response && !isStreaming && !error && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  How it works
                </h3>
                
                <div className="space-y-4">
                  {/* Single-Answer Mode */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      🎯 Single-Answer Mode (Default)
                    </h4>
                    <ul className="space-y-1.5 text-sm text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span>
                          Submit a prompt and get one AI response
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span>
                          Model is automatically selected based on your prompt type
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span>
                          Fast and cost-effective for most use cases
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Verify Mode */}
                  <div className="pt-3 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      ⚡ Verify Mode (Optional)
                    </h4>
                    <ul className="space-y-1.5 text-sm text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 mt-0.5">•</span>
                        <span>
                          Select and compare multiple models side-by-side
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 mt-0.5">•</span>
                        <span>
                          See differences, agreements, and potential conflicts
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-600 mt-0.5">•</span>
                        <span>
                          Higher cost and latency - best for critical decisions
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* General Info */}
                  <div className="pt-3 border-t border-gray-200 text-xs text-gray-500">
                    <p>
                      Maximum prompt length: 4,000 characters • 
                      Responses stream in real-time
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Verify Mode Display */}
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
                      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed mb-3">
                        {panel.response}
                      </pre>
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
                    <h4 className="text-sm font-semibold text-blue-900 mb-3">
                      Key Differences
                    </h4>
                    <div className="space-y-4">
                      {diffSummary.keyDifferences.map((diff, idx) => (
                        <div key={idx}>
                          <h5 className="text-sm font-medium text-blue-800 mb-2">
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

            {diffError && (
              <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
                <p className="text-sm text-yellow-800">
                  Note: {diffError}
                </p>
              </div>
            )}

            {/* Continue Conversation Button for Verify Mode */}
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
                        className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm flex items-center gap-2"
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
                    <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                      <p className="text-sm text-blue-800">
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
