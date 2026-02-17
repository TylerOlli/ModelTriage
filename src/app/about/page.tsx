"use client";

/**
 * About Page
 *
 * Public page explaining how ModelTriage works, which models
 * are supported, and the privacy stance. Builds trust and
 * serves as a soft landing page for organic traffic.
 */

import Link from "next/link";
import { useState } from "react";
import { Nav } from "../../components/Nav";
import { LoginModal } from "../../components/auth/LoginModal";
import { availableModels, getProviderName } from "@/lib/models";

const steps = [
  {
    number: "1",
    title: "You describe the task",
    description:
      "Type your prompt and optionally attach files — code screenshots, logs, JSON, or any text file. ModelTriage analyzes the content to understand what you need.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
  },
  {
    number: "2",
    title: "We classify and route",
    description:
      "A deterministic classifier identifies the task type, complexity, and stakes. A scoring engine evaluates each model's fit based on a capability matrix, then selects the best one.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    number: "3",
    title: "You get the best answer",
    description:
      "The response streams in real time with a clear explanation of why that model was chosen. Or use comparison mode to run 2-3 models in parallel and see a structured diff.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const providerColors: Record<string, string> = {
  OpenAI: "bg-green-50 text-green-700 border-green-200",
  Anthropic: "bg-orange-50 text-orange-700 border-orange-200",
  Google: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function AboutPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-4xl mx-auto px-4 pt-12 pb-16">
        <Nav onSignInClick={() => setShowLoginModal(true)} />

        <LoginModal
          open={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />

        {/* Hero */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">
            How ModelTriage works
          </h2>
          <p className="text-base text-neutral-500 mt-2 max-w-xl mx-auto">
            Every prompt is different. ModelTriage automatically picks the right LLM
            for each task — so you get the best answer without guessing which model to use.
          </p>
        </div>

        {/* How it works — 3 steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                {step.icon}
              </div>
              <h3 className="text-base font-semibold text-neutral-900 mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Supported Models */}
        <div className="mb-20">
          <h3 className="text-xl font-semibold text-neutral-900 mb-2 text-center">
            Supported models
          </h3>
          <p className="text-sm text-neutral-500 text-center mb-8 max-w-lg mx-auto">
            ModelTriage routes across leading providers. Each model is scored on coding, writing,
            analysis, speed, and vision capabilities.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {availableModels.map((model) => {
              const provider = getProviderName(model.id);
              const colorClasses = providerColors[provider] || "bg-neutral-50 text-neutral-700 border-neutral-200";
              return (
                <div
                  key={model.id}
                  className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-900">
                      {model.label}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorClasses}`}>
                      {provider}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    {model.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Privacy */}
        <div className="mb-16">
          <h3 className="text-xl font-semibold text-neutral-900 mb-2 text-center">
            Privacy by design
          </h3>
          <p className="text-sm text-neutral-500 text-center mb-8 max-w-lg mx-auto">
            ModelTriage is built with privacy as a core principle, not an afterthought.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                title: "Prompts are never stored",
                description:
                  "Your prompts and model responses are streamed directly to your browser. We only store a SHA-256 hash for routing analytics — it cannot be reversed.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                ),
              },
              {
                title: "No third-party tracking",
                description:
                  "No analytics scripts, no ad trackers, no data brokers. Usage data stays in our database and is only used to enforce limits and improve routing.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ),
              },
              {
                title: "Delete anytime",
                description:
                  "Delete your account and all associated data from your account settings. Removal is immediate and irreversible — we don't keep backups of your data.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-xl border border-neutral-200 p-5"
              >
                <div className="w-9 h-9 rounded-lg bg-neutral-50 text-neutral-600 flex items-center justify-center mb-3">
                  {item.icon}
                </div>
                <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                  {item.title}
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Try it now
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
