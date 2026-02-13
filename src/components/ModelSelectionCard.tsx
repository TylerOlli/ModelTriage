"use client";

import { useState } from "react";

interface ModelSelectionCardProps {
  modelName: string;
  reason: string;
  isStreaming?: boolean;
}

function TransparencyPanel() {
  return (
    <div className="space-y-3 text-sm text-neutral-600 leading-relaxed">
      <p>
        ModelTriage analyzes your prompt and matches it to the model best suited
        for the task, based on a deterministic evaluation of your request.
      </p>
      <div className="space-y-2">
        <div className="flex items-start gap-2.5">
          <span className="text-neutral-400 mt-0.5 flex-shrink-0 font-mono text-xs">1</span>
          <span>
            <strong className="text-neutral-800 font-semibold">Prompt analysis</strong> — Your prompt is classified
            to determine task type, complexity, format requirements, and stakes.
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-neutral-400 mt-0.5 flex-shrink-0 font-mono text-xs">2</span>
          <span>
            <strong className="text-neutral-800 font-semibold">Capability matching</strong> — Each model is evaluated
            across dimensions like reasoning, code quality, speed, and cost, weighted
            by what matters most for your specific request.
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-neutral-400 mt-0.5 flex-shrink-0 font-mono text-xs">3</span>
          <span>
            <strong className="text-neutral-800 font-semibold">Selection</strong> — The model with the strongest overall
            fit is selected automatically.
          </span>
        </div>
      </div>
      <p className="text-sm text-neutral-400 pt-1">
        This selection is fully deterministic — the same prompt always produces the same recommendation.
      </p>
    </div>
  );
}

export function ModelSelectionCard({
  modelName,
  reason,
  isStreaming = false,
}: ModelSelectionCardProps) {
  const [showTransparency, setShowTransparency] = useState(false);

  return (
    <div className="mb-6">
      {/* Inline model identity bar */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Streaming indicator dot */}
          {isStreaming ? (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          ) : (
            <span className="flex h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
          <h3 className="text-base font-semibold text-neutral-900 tracking-tight">
            {modelName}
          </h3>
        </div>
        {reason && (
          <>
            <span className="text-neutral-300">&mdash;</span>
            <p className="text-sm text-neutral-500 leading-relaxed">
              {reason}
            </p>
          </>
        )}
        {!reason && isStreaming && (
          <>
            <span className="text-neutral-300">&mdash;</span>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Selecting the best model for your request&hellip;
            </p>
          </>
        )}
      </div>

      {/* Transparency toggle */}
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setShowTransparency(!showTransparency)}
          className="text-sm text-neutral-400 hover:text-neutral-600 font-medium transition-colors duration-150 flex items-center gap-1"
        >
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${showTransparency ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          How this was determined
        </button>

        <div
          className={`overflow-hidden transition-all duration-200 ease-out ${
            showTransparency ? "max-h-[400px] opacity-100 mt-3" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-neutral-50 rounded-xl border border-neutral-200/60 p-5">
            <TransparencyPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
