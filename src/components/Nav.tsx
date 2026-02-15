"use client";

/**
 * Shared Navigation Component
 *
 * Renders the ModelTriage brand, page links, and user menu.
 * Used across all pages. Supports a compact mode for inner pages
 * and a dynamic mode for the homepage (shows tagline when no results).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth/AuthProvider";
import { UserMenu } from "./auth/UserMenu";

interface NavProps {
  /** When true, shows the tagline beneath the logo (homepage idle state) */
  showTagline?: boolean;
  /** Callback to open the sign-in modal */
  onSignInClick?: () => void;
}

const navLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

const authedLinks = [
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav({ showTagline = false, onSignInClick }: NavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="mb-10 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          {/* Brand */}
          <Link href="/" className="group">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Model<span className="text-blue-600">Triage</span>
            </h1>
          </Link>

          {/* Page Links */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  pathname === link.href
                    ? "text-blue-600 bg-blue-50"
                    : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user &&
              authedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    pathname === link.href
                      ? "text-blue-600 bg-blue-50"
                      : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
          </nav>
        </div>

        {/* User Menu */}
        <UserMenu
          onSignInClick={onSignInClick ?? (() => {})}
        />
      </div>

      {/* Tagline — only on homepage idle state */}
      {showTagline && (
        <p className="text-base text-neutral-500 mt-1">
          Right LLM. Every time.
        </p>
      )}
    </header>
  );
}
