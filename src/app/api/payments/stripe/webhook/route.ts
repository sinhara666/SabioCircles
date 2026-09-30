import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { constructWebhookEvent } from "@/lib/payments/stripe";
import { activateMembership, getCommunityById } from "@/lib/communities";
import { notify } from "@/lib/notifications";

// https://stripe.com/docs/webhooks
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 401 });
  }

  let event;
  try {
    event = constructWebhookEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string; metadata?: Record<string, string> };
    const payment = db.prepare("SELECT * FROM payments WHERE provider = 'stripe' AND provider_ref = ?").get(
      session.id
    ) as { id: string; user_id: string; community_id: string; status: string } | undefined;

    if (payment && payment.status !== "completed") {
      db.prepare("UPDATE payments SET status = 'completed' WHERE id = ?").run(payment.id);
      activateMembership(payment.user_id, payment.community_id);
      const community = getCommunityById(payment.community_id);
      notify(payment.user_id, "payment", `You're in! Welcome to ${community?.name ?? "the community"}`, "", `/c/${community?.slug ?? ""}`);
    }
  }

  return NextResponse.json({ received: true });
}
