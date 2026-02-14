"use client";

/**
 * Auto Response View
 *
 * Displays the single-answer mode response:
 *   - Model routing card (which model was selected and why)
 *   - Streamed response content
 *   - Run metadata (model, provider, latency, tokens)
 *   - Follow-up composer
 *   - Error and warning states
 *   - "How it works" placeholder when no results
 */

import { FormattedResponse } from "./FormattedResponse";
import { FollowUpComposer } from "./FollowUpComposer";
import { ModelSelectionCard } from "./ModelSelectionCard";
import { getFriendlyModelName, getUserFriendlyError } from "@/lib/models";
import type { ModelPanelData } from "@/lib/session-types";

interface AutoResponseViewProps {
  /** The single auto-select panel (null if no results) */
  panel: ModelPanelData | null;
  isStreaming: boolean;
  streamingStage: string | null;
  /** Follow-up input */
  followUpInput: string;
  onFollowUpChange: (value: string) => void;
  onFollowUpSubmit: () => void;
  /** Callbacks */
  onClear: () => void;
  onToggleRunDetails: () => void;
}

export function AutoResponseView({
  panel,
  isStreaming,
  streamingStage,
  followUpInput,
  onFollowUpChange,
  onFollowUpSubmit,
  onClear,
  onToggleRunDetails,
}: AutoResponseViewProps) {
  return (
    <>
      {/* Loading State */}
      {isStreaming && streamingStage && !panel?.response && (
        <div className="animate-enter">
          <div className="flex items-center gap-3 mb-6">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span className="text-base font-medium text-neutral-700">
              {(() => {
                if (streamingStage === "streaming") return "Starting response\u2026";
                const chosen = panel?.routing?.chosenModel;
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

      {/* Response */}
      {(panel?.response || panel?.error || panel?.metadata) && (
        <div className="animate-enter">
          {panel?.response && (
            <div>
              {/* Model routing bar */}
              {panel.routing && panel.routing.mode === "auto" && (
                <ModelSelectionCard
                  modelName={panel.routing.chosenModel ? getFriendlyModelName(panel.routing.chosenModel) : ""}
                  reason={panel.routing.reason || (isStreaming ? "Selecting the best model for your request\u2026" : "Analyzing your request\u2026")}
                  isStreaming={isStreaming}
                />
              )}

              {/* Response content */}
              <div className="text-[15px] leading-relaxed text-neutral-700">
                <FormattedResponse response={panel.response} />
              </div>

              {/* Run metadata */}
              {panel.metadata && (
                <div className="mt-8 pt-4 border-t border-neutral-200/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-neutral-400">
                      <span className="font-mono">{getFriendlyModelName(panel.metadata.model)}</span>
                      <span>&middot;</span>
                      <span>{panel.metadata.provider}</span>
                      {panel.showRunDetails && (
                        <>
                          <span>&middot;</span>
                          <span className="font-mono tabular-nums">{(panel.metadata.latency / 1000).toFixed(1)}s</span>
                          <span>&middot;</span>
                          <span className="font-mono tabular-nums">{panel.metadata.tokenUsage?.total || "N/A"} tokens</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onToggleRunDetails}
                      className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors duration-150"
                    >
                      {panel.showRunDetails ? "Less" : "Details"}
                    </button>
                  </div>
                </div>
              )}

              {/* Follow-up */}
              {!isStreaming && !panel.error && panel.response && (
                <FollowUpComposer
                  value={followUpInput}
                  onChange={onFollowUpChange}
                  onSubmit={onFollowUpSubmit}
                  isLoading={isStreaming}
                  placeholder="Ask a follow-up question…"
                />
              )}
            </div>
          )}

          {/* Empty Response Warning */}
          {!panel?.response && !panel?.error && panel?.metadata && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Empty response.</span> The model completed but returned no text. Try a simpler prompt.
              </p>
            </div>
          )}

          {/* Token Limit Warning */}
          {panel?.metadata?.finishReason === "length" && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mt-4">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Response truncated.</span> The model reached its token limit. Consider a model with higher capacity for complex queries.
              </p>
            </div>
          )}

          {/* Error */}
          {panel?.error && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-red-700">
                <span className="font-semibold">Error:</span> {getUserFriendlyError(panel.error)}
              </p>
              <button
                type="button"
                onClick={onClear}
                className="px-4 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors duration-150 flex-shrink-0"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* How it works — shown when no results */}
      {!panel?.response && !isStreaming && !panel?.error && (
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
  );
}
