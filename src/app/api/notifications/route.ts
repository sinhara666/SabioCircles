import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listNotifications, unreadCount } from "@/lib/notifications";

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }
  return NextResponse.json({
    notifications: listNotifications(user.id),
    unread: unreadCount(user.id),
  });
}
