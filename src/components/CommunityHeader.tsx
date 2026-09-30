"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CommunityDetail } from "@/hooks/useCommunity";

function priceLabel(c: CommunityDetail["community"]) {
  if (c.is_free) return "Free";
  const parts: string[] = [];
  // One-time join payments: no "/mo" — that implied a subscription that does not exist.
  if (c.price_ngn_kobo > 0) parts.push(`₦${(c.price_ngn_kobo / 100).toLocaleString()} one-time`);
  if (c.price_usd_cents > 0) parts.push(`$${(c.price_usd_cents / 100).toLocaleString()} one-time`);
  return parts.join(" · ");
}

export default function CommunityHeader({ data }: { data: CommunityDetail }) {
  const { community, memberCount, membership } = data;
  const pathname = usePathname();
  const base = `/c/${community.slug}`;

  const tabs = [
    { href: base, label: "Community" },
    { href: `${base}/classroom`, label: "Classroom" },
    { href: `${base}/leaderboard`, label: "Leaderboard" },
    // Owners get a Payouts tab so they can connect their bank for split payouts.
    ...(membership?.role === "owner" && membership?.status === "active"
      ? [{ href: `${base}/payouts`, label: "Payouts" }]
      : []),
  ];

  const isMember = membership && membership.status === "active";

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-4xl px-4 pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{community.name}</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">{community.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              {memberCount} member{memberCount === 1 ? "" : "s"} · {priceLabel(community) || "Free"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isMember && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                Level {membership!.level} · {membership!.points} pts
              </span>
            )}
            {!isMember && (
              <Link
                href={`${base}/join`}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {community.is_free ? "Join community" : "Join for " + priceLabel(community)}
              </Link>
            )}
          </div>
        </div>
        <nav className="mt-6 flex gap-6 text-sm">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`border-b-2 pb-3 ${
                  active ? "border-emerald-600 font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
