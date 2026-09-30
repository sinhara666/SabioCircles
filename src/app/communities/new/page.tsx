"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";

export default function NewCommunityPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [priceNgn, setPriceNgn] = useState("5000");
  const [priceUsd, setPriceUsd] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-700">You need an account to create a community.</p>
        <a href="/signup" className="mt-4 inline-block rounded-full bg-slate-900 px-5 py-2 text-white">
          Sign up
        </a>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          isFree,
          priceNgnKobo: isFree ? 0 : Math.round(parseFloat(priceNgn || "0") * 100),
          priceUsdCents: isFree ? 0 : Math.round(parseFloat(priceUsd || "0") * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      router.push(`/c/${data.slug}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Start a community</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="e.g. Lagos Founders Circle"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
            Free to join
          </label>
        </div>
        {!isFree && (
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Price (₦ / month)</label>
              <input
                type="number"
                min={0}
                value={priceNgn}
                onChange={(e) => setPriceNgn(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-500">Charged via Paystack</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Price ($ / month)</label>
              <input
                type="number"
                min={0}
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <p className="mt-1 text-xs text-slate-500">Charged via Stripe</p>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create community"}
        </button>
      </form>
    </div>
  );
}
