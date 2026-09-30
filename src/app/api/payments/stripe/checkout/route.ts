import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, id, now } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getCommunityBySlug } from "@/lib/communities";
import { createCheckoutSession } from "@/lib/payments/stripe";

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
  if (community.is_free || community.price_usd_cents <= 0) {
    return NextResponse.json({ error: "This community does not have a USD price set" }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const paymentId = id();

  try {
    const session = await createCheckoutSession({
      email: user.email,
      amountCents: community.price_usd_cents,
      currency: "usd",
      communityName: community.name,
      successUrl: `${origin}/c/${community.slug}?payment=success`,
      cancelUrl: `${origin}/c/${community.slug}?payment=cancelled`,
      metadata: { communityId: community.id, userId: user.id, paymentId },
    });

    db.prepare(
      `INSERT INTO payments (id, user_id, community_id, provider, provider_ref, amount, currency, status, created_at)
       VALUES (?, ?, ?, 'stripe', ?, ?, 'USD', 'pending', ?)`
    ).run(paymentId, user.id, community.id, session.id, community.price_usd_cents, now());

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Stripe error" }, { status: 502 });
  }
}
