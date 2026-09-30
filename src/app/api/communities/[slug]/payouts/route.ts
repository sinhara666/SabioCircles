import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCommunityBySlug } from "@/lib/communities";
import { isOwnerOrAdmin } from "@/lib/access";
import { platformFeePercent } from "@/lib/payments/paystack";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "You must be logged in" }, { status: 401 });

  const community = getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });
  if (!isOwnerOrAdmin(user.id, community.id)) {
    return NextResponse.json({ error: "Only the owner can view payouts" }, { status: 403 });
  }

  const fee = platformFeePercent();
  return NextResponse.json({
    status: community.payout_status || "none",
    bankName: community.payout_bank_name || null,
    accountLast4: community.payout_account_last4 || null,
    platformFeePercent: fee,
    ownerSharePercent: 100 - fee,
    ready: (community.payout_status || "none") === "ready" && !!community.payout_split_code,
  });
}
