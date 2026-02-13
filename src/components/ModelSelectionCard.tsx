"use client";

import { useState } from "react";

// ─── Props ──────────────────────────────────────────────────────

interface ModelSelectionCardProps {
  modelName: string;
  reason: string;
  isStreaming?: boolean;
}

// ─── Transparency Panel ─────────────────────────────────────────

function TransparencyPanel() {
  return (
    <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
      <p>
        ModelTriage analyzes your prompt and matches it to the model best suited
        for the task, based on a deterministic evaluation of your request.
      </p>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-gray-400 mt-0.5 flex-shrink-0">1.</span>
          <span>
            <strong className="text-gray-700">Prompt analysis</strong> — Your prompt is classified
            to determine task type, complexity, format requirements, and stakes.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-gray-400 mt-0.5 flex-shrink-0">2.</span>
          <span>
            <strong className="text-gray-700">Capability matching</strong> — Each model is evaluated
            across dimensions like reasoning, code quality, speed, and cost, weighted
            by what matters most for your specific request.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-gray-400 mt-0.5 flex-shrink-0">3.</span>
          <span>
            <strong className="text-gray-700">Selection</strong> — The model with the strongest overall
            fit is selected automatically. Strong alignment gets rewarded; mismatches
            get penalized.
          </span>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 pt-1">
        This selection is fully deterministic — the same prompt always produces the same recommendation.
      </p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function ModelSelectionCard({
  modelName,
  reason,
  isStreaming = false,
}: ModelSelectionCardProps) {
  const [showTransparency, setShowTransparency] = useState(false);

  return (
    <div className="px-5 pt-4 pb-3 bg-white/40 backdrop-blur-sm relative">
      {/* Bottom gradient divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      {/* ── Header: Model identity ── */}
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="text-gray-400 text-sm flex-shrink-0 mt-0.5">⚡</span>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Auto-selected
          </span>
          <h3 className="text-base font-bold text-gray-900 tracking-tight leading-snug">
            {modelName}
          </h3>
        </div>
      </div>

      {/* ── Reason ── */}
      <div className="mt-3 rounded-lg border border-gray-200/60 bg-white/70 p-3 max-w-[900px]">
        <p className="text-xs text-slate-600 leading-relaxed">
          {reason || (isStreaming ? "Selecting the best model for your request..." : "Analyzing your request...")}
        </p>
      </div>

      {/* ── Transparency Toggle ── */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowTransparency(!showTransparency)}
          className="text-[11px] text-gray-500 hover:text-gray-700 font-medium transition-colors duration-150 flex items-center gap-1"
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

        {/* Expandable panel */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            showTransparency ? "max-h-[400px] opacity-100 mt-2" : "max-h-0 opacity-0"
          }`}
        >
          <div className="rounded-xl border border-gray-200/60 bg-gradient-to-b from-white/90 to-white/70 backdrop-blur-sm p-4 shadow-sm">
            <TransparencyPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
