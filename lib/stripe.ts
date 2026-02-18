/**
 * Stripe Client Singleton
 *
 * Server-side Stripe client for checkout, webhooks, and portal.
 * Uses STRIPE_SECRET_KEY from environment variables.
 */

import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeInstance = new Stripe(key, {
      typescript: true,
    });
  }
  return stripeInstance;
}
