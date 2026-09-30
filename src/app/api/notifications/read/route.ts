import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { markAllRead } from "@/lib/notifications";

export async function POST() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }
  markAllRead(user.id);
  return NextResponse.json({ ok: true });
}
