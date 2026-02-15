"use client";

/**
 * Dashboard Page
 *
 * Authenticated-only page showing usage analytics and
 * routing decision history. Data is fetched from /api/dashboard.
 */

import { useState, useEffect, useCallback, Fragment } from "react";
import { Nav } from "../../components/Nav";
import { LoginModal } from "../../components/auth/LoginModal";
import { RequireAuth } from "../../components/auth/RequireAuth";
import { getFriendlyModelName } from "@/lib/models";

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
  keyFactors: unknown[] | null;
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
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Mode</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Task Type</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Model</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Confidence</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentDecisions.map((d) => (
                        <Fragment key={d.id}>
                          <tr
                            onClick={() => setExpandedRow(expandedRow === d.id ? null : d.id)}
                            className="border-t border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">
                              {formatDate(d.createdAt)}
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
                            <td className="px-4 py-2.5 text-neutral-600">
                              {d.taskType?.replace(/_/g, " ") || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-neutral-900 font-medium whitespace-nowrap">
                              {d.selectedModel ? getFriendlyModelName(d.selectedModel) : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-neutral-600">
                              {d.routingConfidence != null
                                ? `${Math.round(d.routingConfidence * 100)}%`
                                : "—"}
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
                                <DecisionDetail decision={d} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
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
        const height = Math.max(2, (d.count / max) * 100);
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex justify-center">
              <div
                className="w-full max-w-[28px] bg-blue-100 hover:bg-blue-200 rounded-t transition-colors"
                style={{ height: `${height}%`, minHeight: "2px" }}
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

function DecisionDetail({ decision }: { decision: RoutingDecision }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs animate-enter">
      <div>
        <p className="font-medium text-neutral-700 mb-1">Classification</p>
        <div className="space-y-1 text-neutral-500">
          <p>Intent: <span className="text-neutral-700">{decision.routingIntent || "—"}</span></p>
          <p>Category: <span className="text-neutral-700">{decision.routingCategory?.replace(/_/g, " ") || "—"}</span></p>
          <p>Stakes: <span className="text-neutral-700">{decision.stakes || "—"}</span></p>
          <p>Prompt length: <span className="text-neutral-700">{decision.promptLength?.toLocaleString() || "—"} chars</span></p>
        </div>
      </div>

      <div>
        <p className="font-medium text-neutral-700 mb-1">Scoring</p>
        <div className="space-y-1 text-neutral-500">
          <p>Expected success: <span className="text-neutral-700">{decision.expectedSuccess != null ? `${decision.expectedSuccess}%` : "—"}</span></p>
          <p>Confidence: <span className="text-neutral-700">{decision.confidence || "—"}</span></p>
          {decision.mode === "compare" && (
            <>
              <p>Models compared: <span className="text-neutral-700">
                {decision.modelsCompared
                  ? (decision.modelsCompared as string[]).map(getFriendlyModelName).join(", ")
                  : "—"}
              </span></p>
              {decision.verdict && (
                <p>Verdict: <span className="text-neutral-700">{decision.verdict}</span></p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Input Signals */}
      {decision.inputSignals && Object.keys(decision.inputSignals).length > 0 && (
        <div className="sm:col-span-2">
          <p className="font-medium text-neutral-700 mb-1">Input signals</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(decision.inputSignals).map(([key, value]) => (
              <span
                key={key}
                className={`px-2 py-0.5 rounded-full text-xs ${
                  value
                    ? "bg-green-50 text-green-700"
                    : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                {value ? " yes" : " no"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
