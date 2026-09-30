import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCommunityBySlug } from "@/lib/communities";
import { isOwnerOrAdmin } from "@/lib/access";
import { createSubaccount, createSplit, platformFeePercent } from "@/lib/payments/paystack";

const schema = z.object({
  businessName: z.string().min(2).max(100),
  bankCode: z.string().min(1).max(10),
  bankName: z.string().min(1).max(100),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
});

/**
 * Owner connects their bank account for automatic payouts. Creates a
 * Paystack subaccount + split so every member payment is divided
 * automatically: owner keeps their share, the platform keeps its fee.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "You must be logged in" }, { status: 401 });

  const community = getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });
  if (!isOwnerOrAdmin(user.id, community.id)) {
    return NextResponse.json({ error: "Only the owner can set up payouts" }, { status: 403 });
  }
  if (community.is_free) {
    return NextResponse.json({ error: "Free communities do not need payouts" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payout details" },
      { status: 400 }
    );
  }

  const fee = platformFeePercent();
  const ownerShare = 100 - fee;

  try {
    const sub = await createSubaccount({
      businessName: parsed.data.businessName,
      bankCode: parsed.data.bankCode,
      accountNumber: parsed.data.accountNumber,
      sharePercent: ownerShare,
    });

    const split = await createSplit({
      name: `${community.name} revenue split`,
      subaccountCode: sub.subaccount_code,
      ownerSharePercent: ownerShare,
    });

    db.prepare(
      `UPDATE communities
       SET payout_subaccount_code = ?, payout_split_code = ?, payout_status = 'ready',
           payout_bank_name = ?, payout_account_last4 = ?
       WHERE id = ?`
    ).run(
      sub.subaccount_code,
      split.split_code,
      parsed.data.bankName,
      parsed.data.accountNumber.slice(-4),
      community.id
    );

    return NextResponse.json({
      ok: true,
      ownerSharePercent: ownerShare,
      platformFeePercent: fee,
      bankName: parsed.data.bankName,
      accountLast4: parsed.data.accountNumber.slice(-4),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payout setup failed" },
      { status: 502 }
    );
  }
}
