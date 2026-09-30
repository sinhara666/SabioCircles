import { NextResponse } from "next/server";
import { db, id, now } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities";
import { requireUser } from "@/lib/auth";
import { getMembership } from "@/lib/points";
import { notify, communityStaffIds } from "@/lib/notifications";

export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const community = getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

  if (!community.is_free) {
    return NextResponse.json(
      { error: "This community requires payment. Use /api/payments to join.", paymentRequired: true },
      { status: 402 }
    );
  }

  const existing = getMembership(user.id, community.id);
  if (existing) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  db.prepare(
    "INSERT INTO memberships (id, user_id, community_id, role, status, points, created_at) VALUES (?, ?, ?, 'member', 'active', 0, ?)"
  ).run(id(), user.id, community.id, now());

  // Tell the community owners/admins someone new joined.
  for (const staffId of communityStaffIds(community.id)) {
    if (staffId !== user.id) {
      notify(staffId, "new_member", `${user.name} joined ${community.name}`, "", `/c/${slug}`);
    }
  }

  return NextResponse.json({ ok: true });
}
