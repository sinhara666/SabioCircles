"use client";

import { useEffect, useState, use } from "react";
import { useCommunity } from "@/hooks/useCommunity";
import CommunityHeader from "@/components/CommunityHeader";

type Row = { rank: number; userId: string; name: string; points: number; level: number };

export default function LeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, loading, notFound } = useCommunity(slug);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`/api/communities/${slug}/leaderboard`)
      .then((r) => r.json())
      .then((d) => setRows(d.leaderboard));
  }, [slug]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (notFound || !data) return <div className="p-8 text-center text-slate-500">Community not found.</div>;

  return (
    <div>
      <CommunityHeader data={data} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Points</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.userId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">#{r.rank}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.level}</td>
                  <td className="px-4 py-3">{r.points}</td>
                </tr>
              ))}
              {rows?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
