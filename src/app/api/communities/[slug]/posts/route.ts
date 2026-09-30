import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, id, now } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { awardPoints, getMembership, POINT_VALUES } from "@/lib/points";
import { isActiveMember } from "@/lib/access";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const community = getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

  // Paid communities: content is members-only. Free communities stay public.
  if (!community.is_free) {
    const user = await getCurrentUser();
    if (!user || !isActiveMember(user.id, community.id)) {
      return NextResponse.json(
        { error: "Membership required to view posts", gated: true },
        { status: 403 }
      );
    }
  }

  // Optional ?q= search over post content (LIKE metacharacters escaped).
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const params: (string | number)[] = [community.id];
  let where = "WHERE p.community_id = ?";
  if (q) {
    where += " AND p.content LIKE ? ESCAPE '\\'";
    params.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }

  const posts = db
    .prepare(
      `SELECT p.id, p.content, p.created_at, u.id as author_id, u.name as author_name,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
       FROM posts p JOIN users u ON u.id = p.author_id
       ${where}
       ORDER BY p.created_at DESC`
    )
    .all(...params);

  return NextResponse.json({ posts });
}

const schema = z.object({ content: z.string().min(1).max(5000) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const community = getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

  const membership = getMembership(user.id, community.id);
  if (!membership || membership.status !== "active") {
    return NextResponse.json({ error: "You must be a member of this community to post" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Post content is required" }, { status: 400 });
  }

  const postId = id();
  db.prepare(
    "INSERT INTO posts (id, community_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(postId, community.id, user.id, parsed.data.content, now());

  awardPoints(membership.id, POINT_VALUES.CREATE_POST, "Created a post");

  return NextResponse.json({ id: postId }, { status: 201 });
}
