"use client";

import { useState, useRef, useEffect } from "react";
import { diffAnalyzer } from "@/lib/diff";
import type { DiffSummary } from "@/lib/diff";

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
  } | null;
  error: string | null;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [modelCount, setModelCount] = useState(2);

  // Single-answer mode state
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [routing, setRouting] = useState<{
    model: string;
    reason: string;
    confidence: string;
  } | null>(null);
  const [metadata, setMetadata] = useState<{
    model: string;
    provider: string;
    latency: number;
    tokenUsage?: { total: number };
  } | null>(null);

  // Verify Mode state
  const [modelPanels, setModelPanels] = useState<Record<string, ModelPanel>>({});
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    const persistedVerifyMode = localStorage.getItem("verifyMode");
    const persistedModelCount = localStorage.getItem("modelCount");
    const persistedPrompt = localStorage.getItem("lastPrompt");

    if (persistedVerifyMode !== null) {
      setVerifyMode(persistedVerifyMode === "true");
    }
    if (persistedModelCount !== null) {
      const count = parseInt(persistedModelCount, 10);
      if (count === 2 || count === 3) {
        setModelCount(count);
      }
    }
    if (persistedPrompt) {
      setPrompt(persistedPrompt);
    }
  }, []);

  // Persist Verify Mode state
  useEffect(() => {
    localStorage.setItem("verifyMode", verifyMode.toString());
  }, [verifyMode]);

  // Persist model count
  useEffect(() => {
    localStorage.setItem("modelCount", modelCount.toString());
  }, [modelCount]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) return;

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

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Request failed");
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.type === "routing") {
              setRouting(data.routing);
            } else if (data.type === "chunk") {
              setResponse((prev) => prev + data.content);
            } else if (data.type === "metadata") {
              setMetadata(data.metadata);
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          }
        }
      }
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
      abortControllerRef.current = null;
    }
  };

  const handleVerifyModeSubmit = async () => {
    // Reset state
    const models = Array.from({ length: modelCount }, (_, i) => `model-${i + 1}`);
    const initialPanels: Record<string, ModelPanel> = {};
    models.forEach((modelId) => {
      initialPanels[modelId] = {
        modelId,
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

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, models }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Request failed");
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            const modelId = data.modelId;

            if (data.type === "routing" && modelId) {
              setModelPanels((prev) => ({
                ...prev,
                [modelId]: {
                  ...prev[modelId],
                  routing: data.routing,
                },
              }));
            } else if (data.type === "chunk" && modelId) {
              setModelPanels((prev) => ({
                ...prev,
                [modelId]: {
                  ...prev[modelId],
                  response: prev[modelId].response + data.content,
                },
              }));
            } else if (data.type === "metadata" && modelId) {
              setModelPanels((prev) => ({
                ...prev,
                [modelId]: {
                  ...prev[modelId],
                  metadata: data.metadata,
                },
              }));
            } else if (data.type === "error") {
              if (modelId) {
                setModelPanels((prev) => ({
                  ...prev,
                  [modelId]: {
                    ...prev[modelId],
                    error: data.error,
                  },
                }));
              } else {
                throw new Error(data.error);
              }
            }
          }
        }
      }

      // Generate diff summary after streaming completes
      try {
        // Get the final state
        setModelPanels((currentPanels) => {
          // Only use successfully completed panels (no error, has response, has metadata)
          const successfulPanels = Object.values(currentPanels).filter(
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

          return currentPanels;
        });
      } catch (err) {
        setDiffError("Could not generate diff summary");
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

    // Clear prompt text and remove from localStorage
    setPrompt("");
    localStorage.removeItem("lastPrompt");
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

          {verifyMode && (
            <div className="pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of models (2-3)
              </label>
              <div className="flex gap-2">
                {[2, 3].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setModelCount(count)}
                    disabled={isStreaming}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      modelCount === count
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    } ${isStreaming ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label
              htmlFor="prompt"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here..."
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-vertical ${
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
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                disabled={isStreaming || !prompt.trim() || isOverLimit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {isStreaming ? "Streaming..." : "Submit"}
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
        {isStreaming && !verifyMode && !response && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 text-gray-600">
              <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span>Starting stream...</span>
            </div>
          </div>
        )}

        {/* Single-Answer Mode Display */}
        {!verifyMode && (
          <>
            {/* Routing Information */}
            {routing && (
              <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-indigo-600 text-lg">🎯</span>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-indigo-900 mb-1">
                      Model Selection
                    </h3>
                    <p className="text-sm text-indigo-800 mb-2">
                      <span className="font-medium">{routing.model}</span>
                    </p>
                    <p className="text-sm text-indigo-700">{routing.reason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Response Display */}
            {(response || error) && (
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
                          <span>Streaming...</span>
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
                          {metadata.latency}ms
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
                          <p className="text-sm text-red-700">{error}</p>
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
                          Compare responses from 2-3 models side-by-side
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
        {verifyMode && Object.keys(modelPanels).length > 0 && (
          <>
            {/* Side-by-side Model Panels */}
            <div className={`grid gap-6 mb-6 ${modelCount === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
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
                          <h4 className="text-xs font-semibold text-indigo-900 mb-1">
                            {panel.routing.model}
                          </h4>
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
                              {panel.error}
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

                  {/* Metadata */}
                  {panel.metadata && (
                    <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                      <div>
                        <span className="text-gray-600">Latency:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {panel.metadata.latency}ms
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

                {diffSummary.agreement.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-green-900 mb-2">
                      ✓ Agreement
                    </h4>
                    <ul className="space-y-1">
                      {diffSummary.agreement.map((item, idx) => (
                        <li key={idx} className="text-sm text-green-800">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {diffSummary.disagreement.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-orange-900 mb-2">
                      ⚠ Disagreement
                    </h4>
                    <ul className="space-y-1">
                      {diffSummary.disagreement.map((item, idx) => (
                        <li key={idx} className="text-sm text-orange-800">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {diffSummary.omissions.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">
                      ℹ Omissions
                    </h4>
                    <ul className="space-y-1">
                      {diffSummary.omissions.map((item, idx) => (
                        <li key={idx} className="text-sm text-blue-800">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {diffSummary.conflictingAssumptions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-900 mb-2">
                      ⚡ Conflicting Assumptions
                    </h4>
                    <ul className="space-y-1">
                      {diffSummary.conflictingAssumptions.map((item, idx) => (
                        <li key={idx} className="text-sm text-red-800">
                          {item}
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
