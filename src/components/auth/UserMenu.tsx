"use client";

/**
 * User Menu
 *
 * Shown in the header when the user is authenticated.
 * Displays email, plan tier, usage remaining, and sign out.
 *
 * When not authenticated, shows a "Sign in" button.
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthProvider";

interface UserMenuProps {
  onSignInClick: () => void;
}

export function UserMenu({ onSignInClick }: UserMenuProps) {
  const { user, role, usage, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-neutral-100 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={onSignInClick}
        className="text-sm font-medium text-neutral-600 hover:text-neutral-900 px-3 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
      >
        Sign in
      </button>
    );
  }

  const initial = (user.email?.[0] ?? "U").toUpperCase();
  const planLabel = role === "pro" ? "Pro" : "Free";

  return (
    <div ref={menuRef} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg hover:bg-neutral-100 px-2 py-1.5 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
          {initial}
        </div>
        {usage && (
          <span className="text-xs text-neutral-500 hidden sm:inline">
            {usage.remaining}/{usage.limit}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-neutral-200 shadow-lg py-2 z-50 animate-enter">
          {/* User info */}
          <div className="px-4 py-2 border-b border-neutral-100">
            <p className="text-sm font-medium text-neutral-900 truncate">
              {user.email}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  role === "pro"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {planLabel}
              </span>
              {usage && (
                <span className="text-xs text-neutral-500">
                  {usage.remaining} requests remaining {usage.period === "daily" ? "today" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Usage bar */}
          {usage && usage.limit > 0 && (
            <div className="px-4 py-2 border-b border-neutral-100">
              <div className="flex justify-between text-xs text-neutral-500 mb-1">
                <span>Usage</span>
                <span>
                  {usage.used} / {usage.limit}
                </span>
              </div>
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    usage.remaining <= 3
                      ? "bg-amber-500"
                      : "bg-blue-500"
                  }`}
                  style={{
                    width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-1 py-1">
            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
              }}
              className="w-full text-left px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
            >
              Sign out
            </button>

            {/* Delete account */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-left px-3 py-2 text-sm text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Delete account
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <p className="text-xs text-red-600 font-medium">
                  This will permanently delete your account and all data. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setDeleting(true);
                      try {
                        const res = await fetch("/api/account/delete", {
                          method: "DELETE",
                        });
                        if (res.ok) {
                          setOpen(false);
                          setConfirmDelete(false);
                          await signOut();
                        } else {
                          const data = await res.json();
                          alert(data.error || "Failed to delete account");
                        }
                      } catch {
                        alert("Failed to delete account. Please try again.");
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    disabled={deleting}
                    className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? "Deleting..." : "Confirm delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="flex-1 px-2 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
