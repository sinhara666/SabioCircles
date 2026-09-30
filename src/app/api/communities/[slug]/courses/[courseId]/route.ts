import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities";
import { getCurrentUser } from "@/lib/auth";
import { isActiveMember } from "@/lib/access";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; courseId: string }> }) {
  const { slug, courseId } = await ctx.params;
  const community = getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

  const user = await getCurrentUser();
  if (!community.is_free) {
    if (!user || !isActiveMember(user.id, community.id)) {
      return NextResponse.json({ error: "Membership required" }, { status: 403 });
    }
  }

  const course = db.prepare("SELECT * FROM courses WHERE id = ? AND community_id = ?").get(courseId, community.id);
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const modules = db
    .prepare("SELECT * FROM modules WHERE course_id = ? ORDER BY position ASC, created_at ASC")
    .all(courseId) as { id: string; title: string; position: number }[];

  const lessonsByModule: Record<string, unknown[]> = {};
  for (const mod of modules) {
    const lessons = db
      .prepare("SELECT id, title, video_url, content, position FROM lessons WHERE module_id = ? ORDER BY position ASC, created_at ASC")
      .all(mod.id) as { id: string }[];

    const withCompletion = lessons.map((l) => {
      const completed = user
        ? !!db.prepare("SELECT id FROM lesson_completions WHERE lesson_id = ? AND user_id = ?").get(l.id, user.id)
        : false;
      return { ...l, completed };
    });
    lessonsByModule[mod.id] = withCompletion;
  }

  return NextResponse.json({
    course,
    modules: modules.map((m) => ({ ...m, lessons: lessonsByModule[m.id] })),
  });
}
