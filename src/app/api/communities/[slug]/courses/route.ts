import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, id, now } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities";
import { requireUser, getCurrentUser } from "@/lib/auth";
import { isActiveMember, isOwnerOrAdmin } from "@/lib/access";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const community = getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

  const user = await getCurrentUser();
  if (!community.is_free) {
    if (!user || !isActiveMember(user.id, community.id)) {
      return NextResponse.json({ error: "Membership required to view courses" }, { status: 403 });
    }
  }

  const courses = db
    .prepare(
      `SELECT c.id, c.title, c.description, c.position,
              (SELECT COUNT(*) FROM modules mo WHERE mo.course_id = c.id) as module_count
       FROM courses c WHERE c.community_id = ? ORDER BY c.position ASC, c.created_at ASC`
    )
    .all(community.id);

  return NextResponse.json({ courses });
}

const schema = z.object({ title: z.string().min(1).max(120), description: z.string().max(2000).default("") });

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

  if (!isOwnerOrAdmin(user.id, community.id)) {
    return NextResponse.json({ error: "Only community owners/admins can create courses" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const position = (
    db.prepare("SELECT COALESCE(MAX(position), -1) as p FROM courses WHERE community_id = ?").get(community.id) as {
      p: number;
    }
  ).p + 1;

  const courseId = id();
  db.prepare(
    "INSERT INTO courses (id, community_id, title, description, position, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(courseId, community.id, parsed.data.title, parsed.data.description, position, now());

  return NextResponse.json({ id: courseId }, { status: 201 });
}
