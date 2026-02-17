"use client";

/**
 * Pricing Page
 *
 * Public page showing plan comparison (Free vs Pro).
 * Wired to the auth system — shows "Current plan" badge
 * for logged-in users and opens the login modal for signups.
 */

import { useState } from "react";
import { Nav } from "../../components/Nav";
import { LoginModal } from "../../components/auth/LoginModal";
import { useAuth } from "../../components/auth/AuthProvider";
import { PLANS } from "@/lib/constants";

const faqs = [
  {
    q: "What counts as a request?",
    a: "Each time you submit a prompt — whether in auto-select or comparison mode — counts as one request. Follow-up questions in the same conversation also count as one request each.",
  },
  {
    q: "When do daily limits reset?",
    a: "Daily limits reset at midnight UTC. Your remaining count is always visible in the user menu.",
  },
  {
    q: "Can I try ModelTriage without signing up?",
    a: "Yes. Anonymous users get 3 free requests to try the tool. Sign up for a free account to get 15 requests per day.",
  },
  {
    q: "What happens when I hit my limit?",
    a: "You'll see a message letting you know your limit has been reached. Free users can wait for the daily reset at midnight UTC. Pro users have a much higher daily allowance.",
  },
  {
    q: "How does comparison mode work?",
    a: "Comparison mode runs your prompt through 2-3 models in parallel and shows a side-by-side diff summary. Free users can compare 2 models; Pro users can compare up to 3.",
  },
];

export default function PricingPage() {
  const { user, role } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const currentPlan = user ? (role || "free") : null;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-4xl mx-auto px-4 pt-12 pb-16">
        <Nav onSignInClick={() => setShowLoginModal(true)} />

        <LoginModal
          open={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />

        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">
            Simple, transparent pricing
          </h2>
          <p className="text-base text-neutral-500 mt-2 max-w-lg mx-auto">
            Start free. Upgrade when you need more. No credit card required.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-16">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-neutral-900">
                  {PLANS.free.name}
                </h3>
                {currentPlan === "free" && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    Current plan
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-neutral-900">
                  {PLANS.free.price}
                </span>
                <span className="text-neutral-500 text-sm">
                  {PLANS.free.priceDetail}
                </span>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {PLANS.free.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-neutral-700">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            {currentPlan === "free" ? (
              <div className="text-center text-sm text-neutral-400 font-medium py-2.5">
                Your current plan
              </div>
            ) : !user ? (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full py-2.5 px-4 text-sm font-medium rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                {PLANS.free.cta}
              </button>
            ) : null}
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-sm p-8 flex flex-col relative">
            {/* Highlight badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Most popular
              </span>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-neutral-900">
                  {PLANS.pro.name}
                </h3>
                {currentPlan === "pro" && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    Current plan
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-neutral-900">
                  {PLANS.pro.price}
                </span>
                <span className="text-neutral-500 text-sm">
                  {PLANS.pro.priceDetail}
                </span>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {PLANS.pro.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-neutral-700">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              disabled
              className="w-full py-2.5 px-4 text-sm font-medium rounded-xl bg-blue-600 text-white opacity-60 cursor-not-allowed"
            >
              {PLANS.pro.cta}
            </button>
            <p className="text-xs text-neutral-400 text-center mt-2">
              Stripe integration coming in Phase 2
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold text-neutral-900 mb-6 text-center">
            Frequently asked questions
          </h3>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-neutral-200"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-neutral-900">
                    {faq.q}
                  </span>
                  <svg
                    className={`w-4 h-4 text-neutral-400 transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-neutral-600 leading-relaxed animate-enter">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
