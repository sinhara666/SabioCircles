"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_free: number;
  price_ngn_kobo: number;
  price_usd_cents: number;
  owner_name: string;
  member_count: number;
};

function priceLabel(c: Community) {
  if (c.is_free) return "Free";
  const parts: string[] = [];
  if (c.price_ngn_kobo > 0) parts.push(`₦${(c.price_ngn_kobo / 100).toLocaleString()}`);
  if (c.price_usd_cents > 0) parts.push(`$${(c.price_usd_cents / 100).toLocaleString()}`);
  return parts.join(" / ") || "Paid";
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[] | null>(null);

  useEffect(() => {
    fetch("/api/communities")
      .then((r) => r.json())
      .then((d) => setCommunities(d.communities));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Discover communities</h1>
        <Link href="/communities/new" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Start a community
        </Link>
      </div>

      {communities === null && <p className="mt-8 text-slate-500">Loading…</p>}
      {communities?.length === 0 && (
        <p className="mt-8 text-slate-500">No communities yet — be the first to create one.</p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {communities?.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.slug}`}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-emerald-400 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{c.name}</h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {priceLabel(c)}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.description || "No description yet."}</p>
            <p className="mt-3 text-xs text-slate-500">
              {c.member_count} member{c.member_count === 1 ? "" : "s"} · by {c.owner_name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
