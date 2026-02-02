"use client";

import { useState, useRef } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    model: string;
    provider: string;
    latency: number;
    tokenUsage?: { total: number };
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) return;

    // Validate prompt length (4,000 character limit per spec)
    if (prompt.length > 4000) {
      setError("Prompt exceeds maximum length of 4,000 characters");
      return;
    }

    // Reset state
    setResponse("");
    setError(null);
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

            if (data.type === "chunk") {
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
          // Stream was cancelled - keep partial output
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

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const characterCount = prompt.length;
  const isOverLimit = characterCount > 4000;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ModelTriage
          </h1>
          <p className="text-gray-600">
            LLM decision and verification layer
          </p>
        </header>

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
            </div>
          </div>
        </form>

        {/* Loading State */}
        {isStreaming && !response && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 text-gray-600">
              <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span>Starting stream...</span>
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
                <div className="flex items-start gap-3">
                  <span className="text-red-600 text-lg">⚠️</span>
                  <div>
                    <h3 className="text-sm font-semibold text-red-900 mb-1">
                      Error
                    </h3>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!response && !isStreaming && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              How it works
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Enter your prompt in the text area above</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>
                  The model will be automatically selected based on your prompt
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>
                  Responses stream in real-time as they&apos;re generated
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Maximum prompt length: 4,000 characters</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
