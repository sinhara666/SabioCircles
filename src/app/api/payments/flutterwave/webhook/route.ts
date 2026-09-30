import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookHash } from "@/lib/payments/flutterwave";
import { activateMembership } from "@/lib/communities";

export async function POST(req: NextRequest) {
  const hashHeader = req.headers.get("verif-hash");
  if (!verifyWebhookHash(hashHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = await req.json();
  if (event.event === "charge.completed" && event.data?.status === "successful") {
    const txRef: string = event.data.tx_ref;
    const payment = db
      .prepare("SELECT * FROM payments WHERE provider = 'flutterwave' AND provider_ref = ?")
      .get(txRef) as { id: string; user_id: string; community_id: string; status: string } | undefined;

    if (payment && payment.status !== "completed") {
      db.prepare("UPDATE payments SET status = 'completed' WHERE id = ?").run(payment.id);
      activateMembership(payment.user_id, payment.community_id);
    }
  }

  return NextResponse.json({ received: true });
}
