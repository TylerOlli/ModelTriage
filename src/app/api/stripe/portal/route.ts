/**
 * Stripe Customer Portal
 *
 * Creates a Stripe Billing Portal session for subscription management.
 * Pro users can update payment method, cancel, and view invoices.
 */

import { getSession, getUserProfile } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const profile = await getUserProfile(user.id);
    if (!profile?.stripeCustomerId) {
      return new Response(JSON.stringify({ error: "No active subscription" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stripe = getStripe();
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${origin}/account`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe portal error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create portal session" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
