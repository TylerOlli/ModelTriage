# Stripe Integration

## Overview

ModelTriage uses Stripe for Pro plan subscriptions. The integration covers:

1. **Checkout** — Stripe Checkout for initial purchase
2. **Webhooks** — Subscription lifecycle events
3. **Customer Portal** — Self-service subscription management

## Environment Variables

```bash
STRIPE_SECRET_KEY=sk_test_...        # Stripe API secret key
STRIPE_PUBLISHABLE_KEY=pk_test_...   # Stripe publishable key (unused server-side)
STRIPE_WEBHOOK_SECRET=whsec_...      # Webhook endpoint signing secret
STRIPE_PRO_PRICE_ID=price_...        # Price ID for Pro plan ($20/month)
```

## Flow

### Upgrade to Pro

1. User clicks "Upgrade to Pro" on `/pricing`
2. Frontend POSTs to `/api/stripe/checkout`
3. Server creates/reuses Stripe Customer, creates Checkout Session
4. User is redirected to Stripe Checkout
5. On success, Stripe sends `checkout.session.completed` webhook
6. Webhook handler upgrades user to `role: "pro"`
7. User is redirected to `/account?upgraded=true`

### Manage Subscription

1. User clicks "Manage subscription" on `/account`
2. Frontend POSTs to `/api/stripe/portal`
3. Server creates a Billing Portal session
4. User manages subscription in Stripe's portal
5. On cancellation, Stripe sends `customer.subscription.deleted`
6. Webhook handler downgrades user to `role: "free"`

## Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set `role = "pro"`, save `stripeCustomerId` |
| `customer.subscription.deleted` | Set `role = "free"` |
| `invoice.payment_failed` | Log warning (no immediate action) |

## Database Fields

The `user_profiles` table includes:

- `stripe_customer_id` — Stripe Customer ID (set on first checkout)
- `role` — `"free"` or `"pro"` (updated by webhooks)

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/stripe/checkout` | Create Checkout Session |
| `POST` | `/api/stripe/webhook` | Handle Stripe events |
| `POST` | `/api/stripe/portal` | Create Customer Portal session |

## Testing

### Stripe CLI (local development)

```bash
# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
```

### Test cards

- `4242 4242 4242 4242` — Succeeds
- `4000 0000 0000 0002` — Declines
- `4000 0000 0000 3220` — Requires 3D Secure

## Implementation Files

- `lib/stripe.ts` — Stripe client singleton
- `src/app/api/stripe/checkout/route.ts` — Checkout session creation
- `src/app/api/stripe/webhook/route.ts` — Webhook handler
- `src/app/api/stripe/portal/route.ts` — Customer Portal
- `src/app/pricing/page.tsx` — Checkout trigger UI
- `src/app/account/page.tsx` — Portal trigger UI
