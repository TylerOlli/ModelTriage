"use client";

/**
 * Conversation History
 *
 * Accordion of previous conversation turns. Each collapsed turn
 * shows a prompt preview and model name; expanding reveals the
 * full response content.
 */

import { FormattedResponse } from "./FormattedResponse";
import { ModelSelectionCard } from "./ModelSelectionCard";
import { getFriendlyModelName } from "@/lib/models";
import type { ConversationSession } from "@/lib/session-types";

interface ConversationHistoryProps {
  session: ConversationSession;
  expandedTurns: Record<string, boolean>;
  onToggleTurn: (turnId: string) => void;
}

export function ConversationHistory({
  session,
  expandedTurns,
  onToggleTurn,
}: ConversationHistoryProps) {
  if (session.turns.length === 0) return null;

  return (
    <div className="space-y-2 mb-8">
      {session.turns.map((turn) => {
        const isExpanded = expandedTurns[turn.id] || false;
        const panelEntries = Object.entries(turn.modelPanels);
        const isAutoTurn = panelEntries.length === 1 && panelEntries[0][1]?.routing?.mode === "auto";
        const isCompareTurn = panelEntries.length > 1;
        const autoTurnPanel = isAutoTurn ? panelEntries[0][1] : null;

        const modelLabel = isAutoTurn && autoTurnPanel?.routing?.chosenModel
          ? getFriendlyModelName(autoTurnPanel.routing.chosenModel)
          : isCompareTurn
            ? Object.keys(turn.modelPanels).map(getFriendlyModelName).join(", ")
            : "";
        const promptPreview = turn.prompt.length > 120
          ? turn.prompt.substring(0, 120) + "\u2026"
          : turn.prompt;

        return (
          <div key={turn.id} className="animate-enter">
            <button
              type="button"
              onClick={() => onToggleTurn(turn.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 group ${
                isExpanded
                  ? "bg-white border-neutral-200 shadow-sm"
                  : "bg-neutral-50 border-neutral-200/60 hover:bg-white hover:border-neutral-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className={`w-3.5 h-3.5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className={`text-sm font-medium flex-shrink-0 ${turn.isFollowUp ? "text-blue-600" : "text-neutral-500"}`}>
                  {turn.isFollowUp ? "Follow-up" : "Previous"}
                </span>
                <p className="text-sm text-neutral-700 truncate flex-1 min-w-0">{promptPreview}</p>
                {modelLabel && (
                  <span className="text-sm text-neutral-400 font-mono flex-shrink-0 hidden sm:inline">{modelLabel}</span>
                )}
              </div>
            </button>

            <div className={`overflow-hidden transition-all duration-200 ease-out ${isExpanded ? "max-h-[2000px] opacity-100 mt-3" : "max-h-0 opacity-0"}`}>
              {isAutoTurn && autoTurnPanel && (
                <div className="pl-8">
                  {autoTurnPanel.routing && autoTurnPanel.routing.mode === "auto" && (
                    <ModelSelectionCard
                      modelName={autoTurnPanel.routing.chosenModel ? getFriendlyModelName(autoTurnPanel.routing.chosenModel) : ""}
                      reason={autoTurnPanel.routing.reason || ""}
                    />
                  )}
                  <div className="text-[15px] leading-relaxed text-neutral-700">
                    <FormattedResponse response={autoTurnPanel.response} />
                  </div>
                </div>
              )}

              {isCompareTurn && (
                <div className="grid gap-4 md:grid-cols-2 items-start">
                  {Object.entries(turn.modelPanels).map(([mId, panel]) => (
                    <div key={mId} className="bg-white rounded-xl border border-neutral-200 p-5 border-l-2 border-l-blue-500">
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-sm font-semibold text-neutral-900 font-mono">{getFriendlyModelName(mId)}</span>
                        {panel.routing?.reason && (
                          <>
                            <span className="text-neutral-300">&mdash;</span>
                            <span className="text-sm text-neutral-500">{panel.routing.reason}</span>
                          </>
                        )}
                      </div>
                      <div className="text-sm leading-relaxed text-neutral-700">
                        <FormattedResponse response={panel.response} mode="compare" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
