import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTransactionByRef } from "@/lib/payments/flutterwave";
import { activateMembership, getCommunityById } from "@/lib/communities";
import { notify } from "@/lib/notifications";

// Flutterwave redirects the browser back here (redirect_url) after checkout.
export async function GET(req: NextRequest) {
  const txRef = req.nextUrl.searchParams.get("tx_ref");
  const status = req.nextUrl.searchParams.get("status");

  if (!txRef) return NextResponse.redirect(new URL("/?payment=error", req.url));

  const payment = db.prepare("SELECT * FROM payments WHERE provider = 'flutterwave' AND provider_ref = ?").get(
    txRef
  ) as { id: string; user_id: string; community_id: string; status: string } | undefined;
  if (!payment) return NextResponse.redirect(new URL("/?payment=error", req.url));

  const community = getCommunityById(payment.community_id);

  if (status === "cancelled") {
    return NextResponse.redirect(new URL(`/c/${community?.slug ?? ""}?payment=cancelled`, req.url));
  }

  try {
    const data = await verifyTransactionByRef(txRef);
    if (data.status === "successful") {
      if (payment.status !== "completed") {
        db.prepare("UPDATE payments SET status = 'completed' WHERE id = ?").run(payment.id);
        activateMembership(payment.user_id, payment.community_id);
        notify(payment.user_id, "payment", `You're in! Welcome to ${community?.name ?? "the community"}`, "", `/c/${community?.slug ?? ""}`);
      }
      return NextResponse.redirect(new URL(`/c/${community?.slug ?? ""}?payment=success`, req.url));
    }
    db.prepare("UPDATE payments SET status = 'failed' WHERE id = ?").run(payment.id);
    return NextResponse.redirect(new URL(`/c/${community?.slug ?? ""}?payment=failed`, req.url));
  } catch {
    return NextResponse.redirect(new URL(`/c/${community?.slug ?? ""}?payment=error`, req.url));
  }
}
