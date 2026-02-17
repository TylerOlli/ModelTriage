/**
 * Shared Constants
 *
 * Usage limits and plan definitions used by both the frontend
 * (pricing page, upgrade banners) and backend (gates, limits).
 *
 * Keep these in sync with the environment variable defaults
 * in lib/auth/gates.ts. The env vars override at runtime;
 * these are the defaults for display purposes.
 */

export const PLANS = {
  anonymous: {
    name: "Anonymous",
    limit: 3,
    period: "lifetime" as const,
  },
  free: {
    name: "Free",
    price: "$0",
    priceDetail: "forever",
    limit: 15,
    period: "daily" as const,
    features: [
      "15 requests per day",
      "Auto-select model routing",
      "Compare up to 2 models",
      "File attachments",
      "Conversation follow-ups",
      "Routing explanations",
    ],
    cta: "Get started",
  },
  pro: {
    name: "Pro",
    price: "$20",
    priceDetail: "/month",
    limit: 200,
    period: "daily" as const,
    features: [
      "200 requests per day",
      "Auto-select model routing",
      "Compare up to 3 models",
      "File attachments",
      "Conversation follow-ups",
      "Routing explanations",
      "Priority support",
    ],
    cta: "Coming soon",
    highlighted: true,
  },
} as const;
