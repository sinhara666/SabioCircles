import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, id, now } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/access";

const schema = z.object({
  title: z.string().min(1).max(120),
  videoUrl: z.string().max(500).default(""),
  content: z.string().max(10000).default(""),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await ctx.params;
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const mod = db
    .prepare(
      `SELECT mo.id, co.community_id FROM modules mo
       JOIN courses co ON co.id = mo.course_id
       WHERE mo.id = ?`
    )
    .get(moduleId) as { id: string; community_id: string } | undefined;
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  if (!isOwnerOrAdmin(user.id, mod.community_id)) {
    return NextResponse.json({ error: "Only owners/admins can add lessons" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const position = (
    db.prepare("SELECT COALESCE(MAX(position), -1) as p FROM lessons WHERE module_id = ?").get(moduleId) as {
      p: number;
    }
  ).p + 1;

  const lessonId = id();
  db.prepare(
    "INSERT INTO lessons (id, module_id, title, video_url, content, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(lessonId, moduleId, parsed.data.title, parsed.data.videoUrl, parsed.data.content, position, now());

  return NextResponse.json({ id: lessonId }, { status: 201 });
}
