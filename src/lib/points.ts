import { db, id, now } from "./db";

// Points required to reach each level, Skool-style escalating curve.
// Level = index + 1 (level 1 starts at 0 points).
export const LEVEL_THRESHOLDS = [0, 5, 20, 65, 155, 320, 590, 985, 1520, 2200];

export function levelForPoints(points: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

export function pointsToNextLevel(points: number): { next: number | null; remaining: number } {
  const level = levelForPoints(points);
  const nextThreshold = LEVEL_THRESHOLDS[level]; // index === level (0-based next)
  if (nextThreshold === undefined) return { next: null, remaining: 0 };
  return { next: level + 1, remaining: Math.max(0, nextThreshold - points) };
}

export const POINT_VALUES = {
  CREATE_POST: 5,
  RECEIVE_COMMENT: 1,
  RECEIVE_LIKE: 1,
  COMPLETE_LESSON: 10,
} as const;

export function awardPoints(membershipId: string, amount: number, reason: string) {
  db.prepare(
    "INSERT INTO points_transactions (id, membership_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id(), membershipId, amount, reason, now());
  db.prepare("UPDATE memberships SET points = points + ? WHERE id = ?").run(amount, membershipId);
}

export function getMembership(userId: string, communityId: string) {
  return db
    .prepare("SELECT * FROM memberships WHERE user_id = ? AND community_id = ?")
    .get(userId, communityId) as
    | { id: string; user_id: string; community_id: string; role: string; status: string; points: number }
    | undefined;
}
