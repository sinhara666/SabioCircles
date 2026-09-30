import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, id, now } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { awardPoints, getMembership, POINT_VALUES } from "@/lib/points";
import { notify } from "@/lib/notifications";
import { isActiveMember } from "@/lib/access";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = await ctx.params;

  const post = db.prepare("SELECT id, community_id FROM posts WHERE id = ?").get(postId) as
    | { id: string; community_id: string }
    | undefined;
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const community = getCommunityBySlug(slug);
  if (!community || community.id !== post.community_id) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  // Paid communities: comments are members-only, same as posts.
  if (!community.is_free) {
    const user = await getCurrentUser();
    if (!user || !isActiveMember(user.id, community.id)) {
      return NextResponse.json(
        { error: "Membership required to view comments", gated: true },
        { status: 403 }
      );
    }
  }

  const comments = db
    .prepare(
      `SELECT c.id, c.content, c.created_at, u.id as author_id, u.name as author_name
       FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.post_id = ? ORDER BY c.created_at ASC`
    )
    .all(postId);
  return NextResponse.json({ comments });
}

const schema = z.object({ content: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; postId: string }> }) {
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
    return NextResponse.json({ error: "You must be a member to comment" }, { status: 403 });
  }

  const post = db.prepare("SELECT id, author_id FROM posts WHERE id = ?").get(postId) as
    | { id: string; author_id: string }
    | undefined;
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Comment content is required" }, { status: 400 });

  const commentId = id();
  db.prepare("INSERT INTO comments (id, post_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)").run(
    commentId,
    postId,
    user.id,
    parsed.data.content,
    now()
  );

  // Reward the post author for engagement received (not the commenter, to
  // discourage self-comment farming), skipping self-comments.
  if (post.author_id !== user.id) {
    const authorMembership = getMembership(post.author_id, community.id);
    if (authorMembership) {
      awardPoints(authorMembership.id, POINT_VALUES.RECEIVE_COMMENT, "Received a comment");
    }
    notify(
      post.author_id,
      "reply",
      `${user.name} commented on your post`,
      parsed.data.content.slice(0, 120),
      `/c/${slug}`
    );
  }

  return NextResponse.json({ id: commentId }, { status: 201 });
}
