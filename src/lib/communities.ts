import { db, id, now } from "./db";

export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  owner_id: string;
  price_ngn_kobo: number;
  price_usd_cents: number;
  is_free: number;
  created_at: string;
  payout_subaccount_code: string;
  payout_split_code: string;
  payout_status: string;
  payout_bank_name: string;
  payout_account_last4: string;
};

export function getCommunityBySlug(slug: string): Community | undefined {
  return db.prepare("SELECT * FROM communities WHERE slug = ?").get(slug) as Community | undefined;
}

export function getCommunityById(communityId: string): Community | undefined {
  return db.prepare("SELECT * FROM communities WHERE id = ?").get(communityId) as Community | undefined;
}

// Activates (or creates) an active membership for a user in a community,
// used after a payment has been confirmed successful.
export function activateMembership(userId: string, communityId: string) {
  const existing = db
    .prepare("SELECT id FROM memberships WHERE user_id = ? AND community_id = ?")
    .get(userId, communityId) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE memberships SET status = 'active' WHERE id = ?").run(existing.id);
    return existing.id;
  }
  const membershipId = id();
  db.prepare(
    "INSERT INTO memberships (id, user_id, community_id, role, status, points, created_at) VALUES (?, ?, ?, 'member', 'active', 0, ?)"
  ).run(membershipId, userId, communityId, now());
  return membershipId;
}
