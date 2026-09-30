import { db, id, now } from "./db";

export type NotificationKind = "reply" | "new_member" | "payment" | "welcome";

export type Notification = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  is_read: number;
  created_at: string;
};

export function notify(
  userId: string,
  kind: NotificationKind,
  title: string,
  body = "",
  link = ""
): void {
  db.prepare(
    "INSERT INTO notifications (id, user_id, kind, title, body, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
  ).run(id(), userId, kind, title, body, link, now());
}

export function listNotifications(userId: string, limit = 30): Notification[] {
  return db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(userId, limit) as Notification[];
}

export function unreadCount(userId: string): number {
  return (db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0").get(userId) as { c: number }).c;
}

export function markAllRead(userId: string): void {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(userId);
}

/** user_ids of owners and admins of a community (for new-member alerts). */
export function communityStaffIds(communityId: string): string[] {
  return (
    db
      .prepare("SELECT user_id FROM memberships WHERE community_id = ? AND role IN ('owner','admin') AND status = 'active'")
      .all(communityId) as { user_id: string }[]
  ).map((r) => r.user_id);
}
