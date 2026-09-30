import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities";
import { getCurrentUser } from "@/lib/auth";
import { getMembership, levelForPoints } from "@/lib/points";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const community = getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

  const memberCount = (
    db
      .prepare("SELECT COUNT(*) as c FROM memberships WHERE community_id = ? AND status = 'active'")
      .get(community.id) as { c: number }
  ).c;

  const user = await getCurrentUser();
  const membership = user ? getMembership(user.id, community.id) : undefined;

  return NextResponse.json({
    community,
    memberCount,
    membership: membership
      ? { role: membership.role, status: membership.status, points: membership.points, level: levelForPoints(membership.points) }
      : null,
  });
}
