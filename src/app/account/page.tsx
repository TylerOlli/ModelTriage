"use client";

/**
 * Account Settings Page
 *
 * Authenticated-only page for managing profile, plan, subscription,
 * API keys, password, data export, and account deletion.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Nav } from "../../components/Nav";
import { LoginModal } from "../../components/auth/LoginModal";
import { RequireAuth } from "../../components/auth/RequireAuth";
import { useAuth } from "../../components/auth/AuthProvider";

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  );
}

interface ApiKeyDisplay {
  id: string;
  keyPrefix: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

function AccountContent() {
  const { user, role, usage, signOut } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete account state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Subscription management state
  const [managingSub, setManagingSub] = useState(false);

  // API key state
  const [apiKeys, setApiKeys] = useState<ApiKeyDisplay[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  const planLabel = role === "pro" ? "Pro" : "Free";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  // Load API keys on mount
  const fetchApiKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys || []);
      }
    } catch {
      // Silently fail — keys just won't show
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    if (role === "pro") {
      fetchApiKeys();
    }
  }, [role, fetchApiKeys]);

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      // Use Supabase client directly for password update
      const { createSupabaseBrowser } = await import("@/lib/auth/supabase-browser");
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess(true);
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordForm(false);
      }
    } catch {
      setPasswordError("Failed to update password. Please try again.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modeltriage-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleManageSubscription = async () => {
    setManagingSub(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open subscription portal");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setManagingSub(false);
    }
  };

  const handleCreateKey = async () => {
    setCreatingKey(true);
    setRevealedKey(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newKeyLabel.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setRevealedKey(data.key);
        setNewKeyLabel("");
        setShowNewKeyForm(false);
        fetchApiKeys();
      } else {
        alert(data.error || "Failed to create API key");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Revoke this API key? Any tools using it will stop working.")) return;
    setRevokingKeyId(keyId);
    try {
      const res = await fetch(`/api/keys/${keyId}`, { method: "DELETE" });
      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to revoke key");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setRevokingKeyId(null);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (res.ok) {
        await signOut();
        window.location.href = "/";
      } else {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete account");
      }
    } catch {
      setDeleteError("Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-16">
        <Nav onSignInClick={() => setShowLoginModal(true)} />

        <LoginModal
          open={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />

        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-8">
          Account settings
        </h2>

        <div className="space-y-6">
          {/* Profile Section */}
          <section className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">
              Profile
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Email</span>
                <span className="text-sm text-neutral-900 font-medium">
                  {user?.email || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Member since</span>
                <span className="text-sm text-neutral-900">
                  {memberSince}
                </span>
              </div>
            </div>
          </section>

          {/* Plan & Usage Section */}
          <section className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">
              Plan & usage
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Current plan</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  role === "pro"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-neutral-100 text-neutral-600"
                }`}>
                  {planLabel}
                </span>
              </div>

              {usage && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-neutral-500">
                      {usage.period === "daily" ? "Today's usage" : "Lifetime usage"}
                    </span>
                    <span className="text-neutral-900">
                      {usage.used} / {usage.limit}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        usage.remaining <= 3 ? "bg-amber-500" : "bg-blue-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {role === "pro" ? (
                <div className="pt-2">
                  <button
                    onClick={handleManageSubscription}
                    disabled={managingSub}
                    className="text-sm text-blue-600 font-medium hover:text-blue-700 disabled:opacity-50"
                  >
                    {managingSub ? "Opening..." : "Manage subscription →"}
                  </button>
                </div>
              ) : (
                <div className="pt-2">
                  <Link
                    href="/pricing"
                    className="text-sm text-blue-600 font-medium hover:text-blue-700"
                  >
                    Upgrade to Pro →
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* API Keys Section (Pro only) */}
          {role === "pro" && (
            <section className="bg-white rounded-xl border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-900">
                  API keys
                </h3>
                <span className="text-xs text-neutral-400">
                  {apiKeys.length} / 5 active
                </span>
              </div>

              {/* Revealed new key banner */}
              {revealedKey && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 animate-enter">
                  <p className="text-xs font-medium text-green-800 mb-1">
                    Your new API key (copy it now — it won&apos;t be shown again):
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-green-100 px-2 py-1 rounded font-mono break-all text-green-900">
                      {revealedKey}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(revealedKey);
                      }}
                      className="text-xs text-green-700 font-medium hover:text-green-800 whitespace-nowrap"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    onClick={() => setRevealedKey(null)}
                    className="text-xs text-green-600 mt-2 hover:text-green-700"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Key list */}
              {loadingKeys ? (
                <p className="text-sm text-neutral-400">Loading keys...</p>
              ) : apiKeys.length === 0 && !showNewKeyForm ? (
                <p className="text-sm text-neutral-400 mb-4">
                  No API keys yet. Create one to use the CLI tool or access the API.
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between px-3 py-2.5 bg-neutral-50 rounded-lg"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-neutral-700">
                            {key.keyPrefix}...
                          </code>
                          {key.label && (
                            <span className="text-xs text-neutral-500">
                              {key.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Created{" "}
                          {new Date(key.createdAt).toLocaleDateString()}
                          {key.lastUsedAt && (
                            <>
                              {" · Last used "}
                              {new Date(key.lastUsedAt).toLocaleDateString()}
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={revokingKeyId === key.id}
                        className="text-xs text-red-500 font-medium hover:text-red-600 disabled:opacity-50 ml-3"
                      >
                        {revokingKeyId === key.id ? "Revoking..." : "Revoke"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new key form */}
              {showNewKeyForm ? (
                <div className="space-y-3 animate-enter">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Label (optional)
                    </label>
                    <input
                      type="text"
                      value={newKeyLabel}
                      onChange={(e) => setNewKeyLabel(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g. My laptop, CI/CD"
                      maxLength={50}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateKey}
                      disabled={creatingKey}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {creatingKey ? "Creating..." : "Create key"}
                    </button>
                    <button
                      onClick={() => {
                        setShowNewKeyForm(false);
                        setNewKeyLabel("");
                      }}
                      className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                apiKeys.length < 5 && (
                  <button
                    onClick={() => setShowNewKeyForm(true)}
                    className="text-sm text-blue-600 font-medium hover:text-blue-700"
                  >
                    + Create new API key
                  </button>
                )
              )}
            </section>
          )}

          {/* Password Section */}
          <section className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">
              Password
            </h3>

            {passwordSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 mb-4 animate-enter">
                Password updated successfully.
              </div>
            )}

            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="text-sm text-blue-600 font-medium hover:text-blue-700"
              >
                Change password
              </button>
            ) : (
              <div className="space-y-3 animate-enter">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    New password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Repeat new password"
                  />
                </div>
                {passwordError && (
                  <p className="text-xs text-red-600">{passwordError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handlePasswordChange}
                    disabled={changingPassword}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {changingPassword ? "Updating..." : "Update password"}
                  </button>
                  <button
                    onClick={() => {
                      setShowPasswordForm(false);
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Data & Privacy Section */}
          <section className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">
              Data & privacy
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-900">Export my data</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Download your usage history and routing decisions as JSON.
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="px-4 py-2 text-sm font-medium border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                >
                  {exporting ? "Exporting..." : "Export"}
                </button>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-white rounded-xl border border-red-200 p-6">
            <h3 className="text-sm font-semibold text-red-600 mb-2">
              Danger zone
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Permanently delete your account and all associated data. This action
              cannot be undone.
            </p>

            {deleteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">
                {deleteError}
              </div>
            )}

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete account
              </button>
            ) : (
              <div className="space-y-3 animate-enter">
                <p className="text-xs text-red-600 font-medium">
                  Type &quot;delete my account&quot; to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="delete my account"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting || deleteConfirmText !== "delete my account"}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deleting ? "Deleting..." : "Permanently delete account"}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeleteConfirmText("");
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
