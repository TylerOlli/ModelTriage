/**
 * Stripe Checkout Session
 *
 * Creates a Stripe Checkout session for Pro plan upgrade.
 * Requires authenticated user. Creates or reuses Stripe customer.
 */

import { getSession, getUserProfile } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db/prisma";

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
    if (profile?.role === "pro") {
      return new Response(JSON.stringify({ error: "Already on Pro plan" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stripe = getStripe();
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create or reuse Stripe customer
    let customerId = profile?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      // Save Stripe customer ID
      await prisma.userProfile.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Determine URLs
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/account?upgraded=true`,
      cancel_url: `${origin}/pricing`,
      metadata: { userId: user.id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create checkout session" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
