import { getMembership } from "./points";

export function isOwnerOrAdmin(userId: string, communityId: string): boolean {
  const m = getMembership(userId, communityId);
  return !!m && (m.role === "owner" || m.role === "admin") && m.status === "active";
}

export function isActiveMember(userId: string, communityId: string): boolean {
  const m = getMembership(userId, communityId);
  return !!m && m.status === "active";
}
