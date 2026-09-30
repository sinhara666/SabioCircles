import { NextResponse } from "next/server";
import { db, id, now } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { awardPoints, getMembership, POINT_VALUES } from "@/lib/points";
import { isActiveMember } from "@/lib/access";

export async function POST(_req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await ctx.params;
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const lesson = db
    .prepare(
      `SELECT le.id, co.community_id FROM lessons le
       JOIN modules mo ON mo.id = le.module_id
       JOIN courses co ON co.id = mo.course_id
       WHERE le.id = ?`
    )
    .get(lessonId) as { id: string; community_id: string } | undefined;
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  if (!isActiveMember(user.id, lesson.community_id)) {
    return NextResponse.json({ error: "You must be a member to track progress" }, { status: 403 });
  }

  const already = db
    .prepare("SELECT id FROM lesson_completions WHERE lesson_id = ? AND user_id = ?")
    .get(lessonId, user.id);
  if (already) {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  db.prepare("INSERT INTO lesson_completions (id, lesson_id, user_id, created_at) VALUES (?, ?, ?, ?)").run(
    id(),
    lessonId,
    user.id,
    now()
  );

  const membership = getMembership(user.id, lesson.community_id)!;
  awardPoints(membership.id, POINT_VALUES.COMPLETE_LESSON, "Completed a lesson");

  return NextResponse.json({ ok: true });
}
