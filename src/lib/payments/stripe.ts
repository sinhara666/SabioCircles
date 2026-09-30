import Stripe from "stripe";

// Real Stripe integration for members outside Nigeria/Africa paying in USD
// (or their local currency via Stripe's supported methods). Requires
// STRIPE_SECRET_KEY from the user's own Stripe dashboard.

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add your Stripe secret key to .env to accept international card payments."
    );
  }
  if (!client) client = new Stripe(key);
  return client;
}

export async function createCheckoutSession(params: {
  email: string;
  amountCents: number;
  currency: string;
  communityName: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}) {
  const stripe = stripeClient();
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.email,
    line_items: [
      {
        price_data: {
          currency: params.currency,
          unit_amount: params.amountCents,
          product_data: { name: `${params.communityName} membership` },
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });
}

export function constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string) {
  const stripe = stripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
