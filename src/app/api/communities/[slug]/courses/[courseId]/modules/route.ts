import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, id, now } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities";
import { requireUser } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/access";

const schema = z.object({ title: z.string().min(1).max(120) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; courseId: string }> }) {
  const { slug, courseId } = await ctx.params;
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const community = getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });
  if (!isOwnerOrAdmin(user.id, community.id)) {
    return NextResponse.json({ error: "Only owners/admins can add modules" }, { status: 403 });
  }

  const course = db.prepare("SELECT id FROM courses WHERE id = ? AND community_id = ?").get(courseId, community.id);
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const position = (
    db.prepare("SELECT COALESCE(MAX(position), -1) as p FROM modules WHERE course_id = ?").get(courseId) as {
      p: number;
    }
  ).p + 1;

  const moduleId = id();
  db.prepare("INSERT INTO modules (id, course_id, title, position, created_at) VALUES (?, ?, ?, ?, ?)").run(
    moduleId,
    courseId,
    parsed.data.title,
    position,
    now()
  );

  return NextResponse.json({ id: moduleId }, { status: 201 });
}
