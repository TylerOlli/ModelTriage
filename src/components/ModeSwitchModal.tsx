"use client";

import React from "react";

interface ModeSwitchModalProps {
  isOpen: boolean;
  currentMode: "auto" | "compare";
  targetMode: "auto" | "compare";
  onStartNew: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
}

const MODE_LABELS = {
  auto: "Auto-select LLM",
  compare: "Compare Models",
} as const;

export function ModeSwitchModal({
  isOpen,
  currentMode,
  targetMode,
  onStartNew,
  onDuplicate,
  onCancel,
}: ModeSwitchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-orange-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Switching modes will start a new run
              </h3>
              <p className="text-sm text-gray-500">
                {MODE_LABELS[currentMode]} &rarr; {MODE_LABELS[targetMode]}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            You have results from the current session. What would you like to
            do?
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onStartNew}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:translate-y-[0.5px] transition-all duration-150"
            >
              Start new
            </button>
            <button
              onClick={onDuplicate}
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-900 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 active:translate-y-[0.5px] transition-all duration-150"
            >
              Duplicate prompt into {MODE_LABELS[targetMode]}
            </button>
            <button
              onClick={onCancel}
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
