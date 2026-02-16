# Multi-Page Architecture

## Overview

ModelTriage uses Next.js 16 App Router to serve multiple pages beyond the original single-page homepage. Pages are split into **public** (accessible to anyone) and **authenticated** (require login).

## Page Inventory

### Public Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Homepage — prompt input, streaming responses, comparison mode |
| `/pricing` | `src/app/pricing/page.tsx` | Free and Pro plan comparison, features, FAQ |
| `/about` | `src/app/about/page.tsx` | What ModelTriage is, supported models, privacy guarantees |

### Authenticated Pages

| Route | File | Guard | Description |
|-------|------|-------|-------------|
| `/dashboard` | `src/app/dashboard/page.tsx` | `<RequireAuth>` | Usage stats, model distribution, routing history table |
| `/account` | `src/app/account/page.tsx` | `<RequireAuth>` | Profile, password change, data export, account deletion |

## Navigation

The `Nav` component (`src/components/Nav.tsx`) provides shared navigation across all pages:

- **Brand** (left) — "ModelTriage" links to `/`
- **Page links + user menu** (right) — Pricing, About (always), Dashboard (authenticated only)
- **Sign in** — styled as a bordered button for visual weight when logged out

```
┌──────────────────────────────────────────────────────┐
│ ModelTriage              Pricing  About  Dashboard  👤│
└──────────────────────────────────────────────────────┘
```

## Authentication Guard

Protected pages use the `<RequireAuth>` wrapper component (`src/components/auth/RequireAuth.tsx`):

1. Shows a loading spinner while auth initializes
2. If unauthenticated, redirects to `/` via `router.replace("/")`
3. If authenticated, renders children

```tsx
// Usage in any authenticated page
export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
```

## Plan Constants

Plan details (limits, features, pricing, CTA text) are centralized in `lib/constants.ts`:

```typescript
export const PLANS = {
  anonymous: { name: "Anonymous", dailyLimit: 3, ... },
  free:      { name: "Free",  price: "$0",  dailyLimit: 15,  ... },
  pro:       { name: "Pro",   price: "$20", dailyLimit: 200, ... },
} as const;
```

This ensures the pricing page, auth gate, upgrade banner, and backend limits all stay in sync.

## API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/dashboard` | GET | Required | Daily usage chart data, model distribution, paginated routing decisions |
| `/api/account/export` | GET | Required | Download user data as JSON (profile, usage, decisions) |
| `/api/account/delete` | DELETE | Required | Full account + data removal via Supabase admin API |
| `/api/usage` | GET | Required | Current usage stats for the auth UI components |

## Dashboard Features

The dashboard page (`src/app/dashboard/page.tsx`) includes:

- **Daily usage chart** — bar chart of requests per day (last 14 days)
- **Stats cards** — total requests, today's count, remaining quota
- **Model distribution** — breakdown of which models were selected
- **Routing decisions table** — expandable rows with:
  - Prompt text (from client-side cache, matched by SHA-256 hash)
  - Classification details (category, task type, complexity)
  - Expected success with color-coded bar
  - Key factors with neutral progress bars
  - Input signals (only active ones shown)
  - Compare mode verdict (when applicable)

## Account Page Features

The account page (`src/app/account/page.tsx`) includes:

- **Profile section** — email display, plan tier
- **Password change** — via Supabase `updateUser()` API
- **Data export** — downloads all user data as JSON
- **Account deletion** — confirmation flow, calls `/api/account/delete`

## Implementation Notes

- All pages use Tailwind CSS for styling, matching the homepage aesthetic
- The pricing page reads from `lib/constants.ts` so limits/features update in one place
- The dashboard uses client-side prompt caching (see [prompt-cache.md](./prompt-cache.md)) to display prompt text without storing it server-side
- Protected API routes validate auth via `lib/auth/session.ts` before processing
