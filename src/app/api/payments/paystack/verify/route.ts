import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTransaction } from "@/lib/payments/paystack";
import { activateMembership, getCommunityById } from "@/lib/communities";
import { notify } from "@/lib/notifications";

// Paystack redirects the browser here after checkout (callback_url). This
// gives the user an immediate result; the webhook below is the source of
// truth for actually activating access server-to-server.
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.redirect(new URL("/?payment=error", req.url));
  }

  const payment = db.prepare("SELECT * FROM payments WHERE provider = 'paystack' AND provider_ref = ?").get(
    reference
  ) as { id: string; user_id: string; community_id: string; status: string } | undefined;
  if (!payment) {
    return NextResponse.redirect(new URL("/?payment=error", req.url));
  }

  const community = getCommunityById(payment.community_id);

  try {
    const data = await verifyTransaction(reference);
    if (data.status === "success") {
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
