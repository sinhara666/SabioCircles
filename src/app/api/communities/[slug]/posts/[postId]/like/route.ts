import { NextResponse } from "next/server";
import { db, id, now } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities";
import { requireUser } from "@/lib/auth";
import { awardPoints, getMembership, POINT_VALUES } from "@/lib/points";

// Toggle like on/off.
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = await ctx.params;
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
    return NextResponse.json({ error: "You must be a member to like posts" }, { status: 403 });
  }

  const post = db.prepare("SELECT id, author_id FROM posts WHERE id = ?").get(postId) as
    | { id: string; author_id: string }
    | undefined;
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const existing = db.prepare("SELECT id FROM likes WHERE post_id = ? AND user_id = ?").get(postId, user.id);
  if (existing) {
    db.prepare("DELETE FROM likes WHERE id = ?").run((existing as { id: string }).id);
    if (post.author_id !== user.id) {
      const authorMembership = getMembership(post.author_id, community.id);
      if (authorMembership) {
        awardPoints(authorMembership.id, -POINT_VALUES.RECEIVE_LIKE, "Like removed");
      }
    }
    return NextResponse.json({ liked: false });
  }

  db.prepare("INSERT INTO likes (id, post_id, user_id, created_at) VALUES (?, ?, ?, ?)").run(
    id(),
    postId,
    user.id,
    now()
  );

  if (post.author_id !== user.id) {
    const authorMembership = getMembership(post.author_id, community.id);
    if (authorMembership) {
      awardPoints(authorMembership.id, POINT_VALUES.RECEIVE_LIKE, "Received a like");
    }
  }

  return NextResponse.json({ liked: true });
}
