"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useCommunity } from "@/hooks/useCommunity";
import CommunityHeader from "@/components/CommunityHeader";

type Bank = { name: string; code: string };
type Status = {
  status: string;
  bankName: string | null;
  accountLast4: string | null;
  platformFeePercent: number;
  ownerSharePercent: number;
  ready: boolean;
} | null;

export default function PayoutsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, loading, notFound } = useCommunity(slug);
  const [status, setStatus] = useState<Status>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/communities/${slug}/payouts`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
    fetch(`/api/payments/paystack/banks`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b && setBanks(b.banks ?? []))
      .catch(() => {});
  }, [slug]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (notFound || !data) return <div className="p-8 text-center text-slate-500">Community not found.</div>;

  const isOwner = data.membership?.role === "owner" && data.membership?.status === "active";
  if (!isOwner) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-slate-600">Only the community owner can manage payouts.</p>
        <Link href={`/c/${slug}`} className="mt-4 inline-block text-sm text-emerald-700 underline">
          Back to {data.community.name}
        </Link>
      </div>
    );
  }

  if (data.community.is_free) {
    return (
      <div>
        <CommunityHeader data={data} />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-slate-600">This is a free community, so there is nothing to pay out.</p>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const bank = banks.find((b) => b.code === bankCode);
      const res = await fetch(`/api/communities/${slug}/payouts/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          bankCode,
          bankName: bank?.name ?? bankCode,
          accountNumber,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not set up payouts");
        return;
      }
      setDone(true);
      setStatus({
        status: "ready",
        bankName: body.bankName,
        accountLast4: body.accountLast4,
        platformFeePercent: body.platformFeePercent,
        ownerSharePercent: body.ownerSharePercent,
        ready: true,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <CommunityHeader data={data} />
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-xl font-bold text-slate-900">Payouts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Connect your bank account once. Every member payment is then split automatically: you keep{" "}
          <span className="font-semibold">{status?.ownerSharePercent ?? 90}%</span>, the platform keeps{" "}
          <span className="font-semibold">{status?.platformFeePercent ?? 10}%</span>. No manual payouts, ever.
        </p>

        {status?.ready && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Payouts are live. Member payments go straight to {status.bankName} •••• {status.accountLast4}.
          </div>
        )}

        {(!status || !status.ready) && (
          <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {done && <p className="text-sm text-emerald-700">Payouts connected.</p>}
            <div>
              <label className="text-sm font-medium text-slate-700">Business name</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Adaeze Coaching"
                required
                minLength={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Bank</label>
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select your bank…</option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Account number</label>
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit NUBAN account number"
                required
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Connecting…" : "Connect payouts"}
            </button>
            <p className="text-xs text-slate-400">
              Powered by Paystack. Your details go straight to Paystack, never stored here beyond your bank name.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
