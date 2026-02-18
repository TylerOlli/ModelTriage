/**
 * Stripe Webhook Handler
 *
 * Handles Stripe events for subscription lifecycle:
 * - checkout.session.completed → upgrade to pro
 * - customer.subscription.deleted → downgrade to free
 * - invoice.payment_failed → log warning
 */

import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db/prisma";
import { invalidateProfileCache } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;

        if (!userId) {
          console.error("checkout.session.completed: missing userId in metadata");
          break;
        }

        // Upgrade user to pro
        await prisma.userProfile.update({
          where: { id: userId },
          data: {
            role: "pro",
            stripeCustomerId: customerId,
          },
        });

        invalidateProfileCache(userId);
        console.log(`[Stripe] User ${userId} upgraded to pro`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const profile = await prisma.userProfile.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (!profile) {
          console.error(`customer.subscription.deleted: no profile for customer ${customerId}`);
          break;
        }

        // Downgrade to free
        await prisma.userProfile.update({
          where: { id: profile.id },
          data: { role: "free" },
        });

        invalidateProfileCache(profile.id);
        console.log(`[Stripe] User ${profile.id} downgraded to free`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;
        console.warn(`[Stripe] Payment failed for customer ${customerId}`);
        break;
      }

      default:
        // Unhandled event type — ignore silently
        break;
    }
  } catch (error) {
    console.error(`[Stripe] Error handling ${event.type}:`, error);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
