import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, id, now } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCommunityBySlug } from "@/lib/communities";
import { initializeTransaction } from "@/lib/payments/paystack";

const schema = z.object({ slug: z.string().min(1) });

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "slug is required" }, { status: 400 });

  const community = getCommunityBySlug(parsed.data.slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });
  if (community.is_free || community.price_ngn_kobo <= 0) {
    return NextResponse.json({ error: "This community does not have a Naira price set" }, { status: 400 });
  }

  const reference = `sng_${id()}`;
  const origin = req.nextUrl.origin;

  db.prepare(
    `INSERT INTO payments (id, user_id, community_id, provider, provider_ref, amount, currency, status, created_at)
     VALUES (?, ?, ?, 'paystack', ?, ?, 'NGN', 'pending', ?)`
  ).run(id(), user.id, community.id, reference, community.price_ngn_kobo, now());

  try {
    const data = await initializeTransaction({
      email: user.email,
      amountKobo: community.price_ngn_kobo,
      reference,
      callbackUrl: `${origin}/api/payments/paystack/verify`,
      metadata: { communityId: community.id, userId: user.id, slug: community.slug },
      // If the owner connected payouts, the payment splits automatically.
      splitCode: community.payout_split_code || undefined,
    });
    return NextResponse.json({ authorizationUrl: data.authorization_url, reference });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Paystack error" }, { status: 502 });
  }
}
