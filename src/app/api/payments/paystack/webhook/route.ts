import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/payments/paystack";
import { activateMembership } from "@/lib/communities";

// Authoritative payment confirmation, per Paystack's webhook docs:
// https://paystack.com/docs/payments/webhooks/
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  let valid = false;
  try {
    valid = verifyWebhookSignature(rawBody, signature);
  } catch {
    // PAYSTACK_SECRET_KEY missing — reject rather than silently accept.
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event.event === "charge.success") {
    const reference: string = event.data.reference;
    const payment = db
      .prepare("SELECT * FROM payments WHERE provider = 'paystack' AND provider_ref = ?")
      .get(reference) as { id: string; user_id: string; community_id: string; status: string } | undefined;

    if (payment && payment.status !== "completed") {
      db.prepare("UPDATE payments SET status = 'completed' WHERE id = ?").run(payment.id);
      activateMembership(payment.user_id, payment.community_id);
    }
  }

  return NextResponse.json({ received: true });
}
