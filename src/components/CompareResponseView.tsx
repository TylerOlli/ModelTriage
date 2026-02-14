"use client";

/**
 * Compare Response View
 *
 * Displays the comparison mode output:
 *   - Grid of model response cards (each with header, content, metadata)
 *   - Comparison summary (verdict, common ground, differences, gaps)
 *   - Follow-up composer
 *   - Loading and error states
 */

import { FormattedResponse } from "./FormattedResponse";
import { FollowUpComposer } from "./FollowUpComposer";
import { getFriendlyModelName, getUserFriendlyError } from "@/lib/models";
import type { DiffSummary } from "@/lib/diff";
import type { ModelPanelData } from "@/lib/session-types";

interface CompareResponseViewProps {
  modelPanels: Record<string, ModelPanelData>;
  isStreaming: boolean;
  diffSummary: DiffSummary | null;
  diffError: string | null;
  /** Follow-up input */
  followUpInput: string;
  onFollowUpChange: (value: string) => void;
  onFollowUpSubmit: () => void;
}

export function CompareResponseView({
  modelPanels,
  isStreaming,
  diffSummary,
  diffError,
  followUpInput,
  onFollowUpChange,
  onFollowUpSubmit,
}: CompareResponseViewProps) {
  const panelCount = Object.keys(modelPanels).length;
  if (panelCount === 0) return null;

  return (
    <>
      {/* Response Cards Grid */}
      <div className="grid gap-5 mb-8 md:grid-cols-2 items-start">
        {Object.entries(modelPanels).map(([modelId, panel], idx) => (
          <div
            key={modelId}
            className="animate-enter"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden flex flex-col border-l-2 border-l-blue-500 shadow-sm">
              {/* Model header */}
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-neutral-900 font-mono">
                    {getFriendlyModelName(modelId)}
                  </h3>
                  {isStreaming && !panel.metadata && !panel.error && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                    </span>
                  )}
                </div>
                {panel.routing?.reason && (
                  <p className="text-sm text-neutral-500 leading-relaxed">{panel.routing.reason}</p>
                )}
              </div>

              {/* Response content */}
              <div className="px-5 pb-4 flex-1">
                {panel.error ? (
                  <div className="bg-red-50 rounded-lg border border-red-200 p-3">
                    <p className="text-sm text-red-700"><span className="font-semibold">Error:</span> {getUserFriendlyError(panel.error)}</p>
                  </div>
                ) : !panel.response && panel.metadata ? (
                  <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                    <p className="text-sm text-amber-800"><span className="font-semibold">Empty response.</span> Model returned no text.</p>
                  </div>
                ) : panel.response ? (
                  <div className="text-sm leading-relaxed text-neutral-700">
                    <FormattedResponse response={panel.response} mode="compare" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="h-3 bg-neutral-100 rounded w-full animate-pulse" />
                    <div className="h-3 bg-neutral-100 rounded w-[90%] animate-pulse" />
                    <div className="h-3 bg-neutral-100 rounded w-[75%] animate-pulse" />
                  </div>
                )}

                {panel.metadata?.finishReason === "length" && (
                  <p className="text-sm text-amber-700 mt-3">Response truncated due to token limit.</p>
                )}
              </div>

              {/* Metadata footer */}
              {panel.metadata && (
                <div className="px-5 py-3 border-t border-neutral-100">
                  <div className="flex items-center justify-between text-sm text-neutral-400">
                    <span>{panel.metadata.provider} &middot; {(panel.metadata.latency / 1000).toFixed(1)}s &middot; {panel.metadata.tokenUsage?.total || "N/A"} tokens</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Summary */}
      {!isStreaming && diffSummary && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden animate-enter">
          <div className="px-6 pt-5 pb-4">
            <h3 className="text-base font-semibold text-neutral-900 tracking-tight mb-1">
              Comparison Summary
            </h3>
            <p className="text-sm text-neutral-500">
              AI synthesis across selected models
            </p>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Verdict */}
            {diffSummary.verdict && (
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-1">Verdict</p>
                <p className="text-sm text-blue-800 leading-relaxed">{diffSummary.verdict}</p>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {diffSummary.commonGround.length > 0 && (
                <div className="bg-neutral-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-neutral-900 mb-2">Common Ground</p>
                  <ul className="space-y-1.5">
                    {diffSummary.commonGround.map((item, idx) => (
                      <li key={idx} className="text-sm text-neutral-600 leading-relaxed flex items-start gap-2">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">&bull;</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {diffSummary.keyDifferences.length > 0 && (
                <div className="bg-neutral-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-neutral-900 mb-2">Key Differences</p>
                  <div className="space-y-2">
                    {diffSummary.keyDifferences.map((diff, idx) => (
                      <div key={idx}>
                        <p className="text-sm font-medium text-neutral-700">{diff.model}</p>
                        <ul className="space-y-1 mt-1">
                          {diff.points.map((point, pIdx) => (
                            <li key={pIdx} className="text-sm text-neutral-600 leading-relaxed flex items-start gap-2">
                              <span className="text-amber-500 mt-0.5 flex-shrink-0">&bull;</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diffSummary.notableGaps.length > 0 && (
                <div className="bg-neutral-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-neutral-900 mb-2">Notable Gaps</p>
                  <ul className="space-y-1.5">
                    {diffSummary.notableGaps.map((item, idx) => (
                      <li key={idx} className="text-sm text-neutral-600 leading-relaxed flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5 flex-shrink-0">&bull;</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Follow-up */}
          {!isStreaming && (
            <div className="px-6 pb-5">
              <FollowUpComposer
                value={followUpInput}
                onChange={onFollowUpChange}
                onSubmit={onFollowUpSubmit}
                isLoading={isStreaming}
                placeholder="Ask a follow-up about this comparison\u2026"
              />
            </div>
          )}
        </div>
      )}

      {/* Loading summary */}
      {!isStreaming && !diffSummary && !diffError && panelCount >= 2 && (
        (() => {
          const successfulCount = Object.values(modelPanels).filter(
            (p) => !p.error && p.response.length > 0 && p.metadata
          ).length;

          if (successfulCount >= 2) {
            return (
              <div className="animate-enter">
                <div className="flex items-center gap-3 mb-4">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                  <span className="text-base font-medium text-neutral-700">Comparing responses&hellip;</span>
                </div>
                <div className="space-y-3">
                  <div className="h-3 bg-neutral-100 rounded w-full animate-pulse" />
                  <div className="h-3 bg-neutral-100 rounded w-[90%] animate-pulse" />
                  <div className="h-3 bg-neutral-100 rounded w-[75%] animate-pulse" />
                </div>
              </div>
            );
          }
          return null;
        })()
      )}

      {diffError && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <p className="text-sm text-amber-800">Note: {diffError}</p>
        </div>
      )}

      {!isStreaming && !diffSummary && !diffError && panelCount > 0 && (
        (() => {
          const successfulCount = Object.values(modelPanels).filter(
            (p) => !p.error && p.response.length > 0 && p.metadata
          ).length;
          const errorCount = Object.values(modelPanels).filter((p) => p.error).length;

          if (errorCount > 0 && successfulCount < 2) {
            return (
              <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
                <p className="text-sm text-neutral-600">
                  Comparison requires at least 2 successful responses.
                  {successfulCount === 1 ? " Only 1 model completed." : " No models completed."}
                </p>
              </div>
            );
          }
          return null;
        })()
      )}
    </>
  );
}
