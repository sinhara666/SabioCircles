import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities";
import { getCurrentUser } from "@/lib/auth";
import { levelForPoints } from "@/lib/points";
import { isActiveMember } from "@/lib/access";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const community = getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

  // Paid communities: leaderboard is members-only.
  if (!community.is_free) {
    const user = await getCurrentUser();
    if (!user || !isActiveMember(user.id, community.id)) {
      return NextResponse.json(
        { error: "Membership required to view leaderboard", gated: true },
        { status: 403 }
      );
    }
  }

  const rows = db
    .prepare(
      `SELECT u.id as user_id, u.name, m.points
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.community_id = ? AND m.status = 'active'
       ORDER BY m.points DESC, m.created_at ASC
       LIMIT 100`
    )
    .all(community.id) as { user_id: string; name: string; points: number }[];

  const leaderboard = rows.map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    name: r.name,
    points: r.points,
    level: levelForPoints(r.points),
  }));

  return NextResponse.json({ leaderboard });
}
