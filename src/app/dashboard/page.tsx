"use client";

/**
 * Dashboard Page
 *
 * Authenticated-only page showing usage analytics and
 * routing decision history. Data is fetched from /api/dashboard.
 */

import { useState, useEffect, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "../../components/Nav";
import { LoginModal } from "../../components/auth/LoginModal";
import { RequireAuth } from "../../components/auth/RequireAuth";
import { getFriendlyModelName } from "@/lib/models";
import { loadCache, lookupPrompt } from "@/lib/prompt-cache";

interface DashboardData {
  todayUsage: { used: number; limit: number; remaining: number };
  totalRequests: number;
  dailyCounts: { date: string; count: number }[];
  modelDistribution: { model: string; count: number }[];
  recentDecisions: RoutingDecision[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface RoutingDecision {
  id: string;
  createdAt: string;
  promptHash: string;
  mode: string;
  taskType: string | null;
  stakes: string | null;
  inputSignals: Record<string, boolean> | null;
  selectedModel: string | null;
  routingIntent: string | null;
  routingCategory: string | null;
  routingConfidence: number | null;
  expectedSuccess: number | null;
  confidence: string | null;
  keyFactors: { label: string; score: number; shortReason: string }[] | null;
  responseTimeMs: number | null;
  modelsCompared: string[] | null;
  verdict: string | null;
  promptLength: number | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function getSuccessColor(score: number): { bar: string; text: string; bg: string } {
  if (score >= 80) return { bar: "bg-green-500", text: "text-green-700", bg: "bg-green-50" };
  if (score >= 60) return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
  return { bar: "bg-red-500", text: "text-red-700", bg: "bg-red-50" };
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [promptCache, setPromptCache] = useState<Record<string, { text: string; timestamp: number }>>({});

  // Load prompt cache from localStorage on mount
  useEffect(() => {
    setPromptCache(loadCache());
  }, []);

  const fetchData = useCallback(async (pageNum: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dashboard?page=${pageNum}&limit=25`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load dashboard");
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page);
  }, [page, fetchData]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-5xl mx-auto px-4 pt-12 pb-16">
        <Nav onSignInClick={() => setShowLoginModal(true)} />

        <LoginModal
          open={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />

        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-8">
          Dashboard
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white rounded-xl border border-neutral-200 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Today's Usage */}
              <div className="bg-white rounded-xl border border-neutral-200 p-5">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                  Today&apos;s Usage
                </p>
                <p className="text-2xl font-bold text-neutral-900">
                  {data.todayUsage.used}{" "}
                  <span className="text-sm font-normal text-neutral-400">
                    / {data.todayUsage.limit}
                  </span>
                </p>
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      data.todayUsage.remaining <= 3 ? "bg-amber-500" : "bg-blue-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (data.todayUsage.used / data.todayUsage.limit) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Total Requests */}
              <div className="bg-white rounded-xl border border-neutral-200 p-5">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                  Total Requests
                </p>
                <p className="text-2xl font-bold text-neutral-900">
                  {data.totalRequests.toLocaleString()}
                </p>
                <p className="text-xs text-neutral-400 mt-1">All time</p>
              </div>

              {/* Top Model */}
              <div className="bg-white rounded-xl border border-neutral-200 p-5">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                  Most Routed Model
                </p>
                <p className="text-2xl font-bold text-neutral-900 truncate">
                  {data.modelDistribution.length > 0
                    ? getFriendlyModelName(data.modelDistribution[0].model)
                    : "—"}
                </p>
                {data.modelDistribution.length > 0 && (
                  <p className="text-xs text-neutral-400 mt-1">
                    {data.modelDistribution[0].count} requests
                  </p>
                )}
              </div>
            </div>

            {/* Usage Chart */}
            <div className="bg-white rounded-xl border border-neutral-200 p-5 mb-8">
              <h3 className="text-sm font-semibold text-neutral-900 mb-4">
                Daily usage — last 14 days
              </h3>
              <UsageChart dailyCounts={data.dailyCounts} />
            </div>

            {/* Model Distribution */}
            {data.modelDistribution.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-5 mb-8">
                <h3 className="text-sm font-semibold text-neutral-900 mb-4">
                  Model distribution
                </h3>
                <ModelDistribution data={data.modelDistribution} />
              </div>
            )}

            {/* Routing Analytics Table */}
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-neutral-100">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Routing analytics
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {data.pagination.total} total decisions
                </p>
              </div>

              {data.recentDecisions.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-neutral-400">
                  No routing decisions yet. Try submitting a prompt!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50 text-left">
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Date</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Prompt</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Mode</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Model</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Task Type</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentDecisions.map((d) => {
                        const promptText = lookupPrompt(promptCache, d.promptHash);
                        return (
                          <Fragment key={d.id}>
                            <tr
                              onClick={() => setExpandedRow(expandedRow === d.id ? null : d.id)}
                              className="border-t border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors"
                            >
                              <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">
                                {formatDate(d.createdAt)}
                              </td>
                              <td className="px-4 py-2.5 text-neutral-600 max-w-[200px]">
                                {promptText ? (
                                  <span className="block truncate" title={promptText}>
                                    {promptText}
                                  </span>
                                ) : (
                                  <span className="text-neutral-300 italic text-xs">
                                    not cached locally
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  d.mode === "compare"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}>
                                  {d.mode}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-neutral-900 font-medium whitespace-nowrap">
                                {d.selectedModel ? getFriendlyModelName(d.selectedModel) : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-neutral-600">
                                {d.taskType?.replace(/_/g, " ") || "—"}
                              </td>
                              <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">
                                {d.responseTimeMs != null
                                  ? `${(d.responseTimeMs / 1000).toFixed(1)}s`
                                  : "—"}
                              </td>
                            </tr>
                            {expandedRow === d.id && (
                              <tr className="border-t border-neutral-100">
                                <td colSpan={6} className="px-4 py-4 bg-neutral-50">
                                  <DecisionDetail decision={d} promptText={promptText} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-400">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data!.pagination.totalPages, p + 1))}
                    disabled={page >= data.pagination.totalPages}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function UsageChart({ dailyCounts }: { dailyCounts: { date: string; count: number }[] }) {
  const max = Math.max(...dailyCounts.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1.5 h-32">
      {dailyCounts.map((d) => {
        const height = Math.max(4, (d.count / max) * 100);
        const hasData = d.count > 0;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex-1 flex items-end justify-center">
              <div
                className={`w-full max-w-[28px] rounded-t transition-colors ${
                  hasData 
                    ? 'bg-blue-500 hover:bg-blue-600' 
                    : 'bg-neutral-100 hover:bg-neutral-200'
                }`}
                style={{ height: `${height}%`, minHeight: "4px" }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block">
                  <div className="bg-neutral-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap">
                    {d.count} requests
                  </div>
                </div>
              </div>
            </div>
            <span className="text-[10px] text-neutral-400 whitespace-nowrap">
              {formatShortDate(d.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ModelDistribution({ data }: { data: { model: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-green-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
  ];

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-neutral-100">
        {data.map((d, i) => (
          <div
            key={d.model}
            className={`${colors[i % colors.length]} transition-all`}
            style={{ width: `${(d.count / total) * 100}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <div key={d.model} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
            <span className="text-xs text-neutral-600">
              {getFriendlyModelName(d.model)}{" "}
              <span className="text-neutral-400">
                ({Math.round((d.count / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionDetail({ decision, promptText }: { decision: RoutingDecision; promptText: string | null }) {
  const router = useRouter();
  const activeSignals = decision.inputSignals
    ? Object.entries(decision.inputSignals).filter(([, value]) => value)
    : [];
  const successColor = decision.expectedSuccess != null
    ? getSuccessColor(decision.expectedSuccess)
    : null;

  const handleReplay = () => {
    if (promptText) {
      localStorage.setItem("lastPrompt", promptText);
      localStorage.setItem("rememberDrafts", "true");
      router.push("/");
    }
  };

  return (
    <div className="space-y-4 text-xs animate-enter">
      {/* Prompt + Replay */}
      {promptText && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium text-neutral-700">Prompt</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReplay();
              }}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              Run again
            </button>
          </div>
          <p className="text-neutral-600 leading-relaxed bg-white rounded-lg border border-neutral-200 px-3 py-2 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {promptText}
          </p>
        </div>
      )}

      {/* Classification + Expected Success — side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="font-medium text-neutral-700 mb-2">Classification</p>
          <div className="space-y-1.5 text-neutral-500">
            <p>Task type: <span className="text-neutral-700">{decision.taskType?.replace(/_/g, " ") || "—"}</span></p>
            <p>Intent: <span className="text-neutral-700">{decision.routingIntent || "—"}</span></p>
            <p>Category: <span className="text-neutral-700">{decision.routingCategory?.replace(/_/g, " ") || "—"}</span></p>
            <p>Length: <span className="text-neutral-700">{decision.promptLength?.toLocaleString() || "—"} chars</span></p>
            <p className="text-neutral-400">{formatRelativeTime(decision.createdAt)}</p>
          </div>
        </div>

        <div>
          <p className="font-medium text-neutral-700 mb-2">Model fit</p>
          {decision.expectedSuccess != null && successColor ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${successColor.bar}`}
                    style={{ width: `${decision.expectedSuccess}%` }}
                  />
                </div>
                <span className={`font-semibold text-sm ${successColor.text}`}>
                  {decision.expectedSuccess}%
                </span>
              </div>
              <p className="text-neutral-400">
                Expected success for {decision.selectedModel ? getFriendlyModelName(decision.selectedModel) : "selected model"}
              </p>
            </div>
          ) : (
            <p className="text-neutral-400">No scoring data available</p>
          )}

          {/* Compare mode: models compared */}
          {decision.mode === "compare" && decision.modelsCompared && (
            <div className="mt-3">
              <p className="text-neutral-500">
                Compared:{" "}
                <span className="text-neutral-700">
                  {(decision.modelsCompared as string[]).map(getFriendlyModelName).join(", ")}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Key Factors — muted bars */}
      {decision.keyFactors && decision.keyFactors.length > 0 && (
        <div>
          <p className="font-medium text-neutral-700 mb-2">Key factors</p>
          <div className="space-y-2">
            {decision.keyFactors.map((factor) => (
              <div key={factor.label} className="flex items-center gap-3">
                <span className="text-neutral-600 w-28 flex-shrink-0 truncate" title={factor.label}>
                  {factor.label}
                </span>
                <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-neutral-300 transition-all"
                    style={{ width: `${factor.score}%` }}
                  />
                </div>
                <span className="text-neutral-500 w-8 text-right flex-shrink-0">
                  {factor.score}
                </span>
                <span className="text-neutral-400 hidden sm:inline truncate max-w-[180px]" title={factor.shortReason}>
                  {factor.shortReason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Signals — only active ones */}
      {activeSignals.length > 0 && (
        <div>
          <p className="font-medium text-neutral-700 mb-2">Input signals</p>
          <div className="flex flex-wrap gap-1.5">
            {activeSignals.map(([key]) => (
              <span
                key={key}
                className="px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium"
              >
                {key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Compare mode verdict — emphasized callout */}
      {decision.mode === "compare" && decision.verdict && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
          <p className="font-medium text-purple-700 mb-1 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
            Verdict
          </p>
          <p className="text-purple-900 leading-relaxed">
            {decision.verdict}
          </p>
        </div>
      )}
    </div>
  );
}
