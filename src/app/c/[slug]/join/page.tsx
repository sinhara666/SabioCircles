"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCommunity } from "@/hooks/useCommunity";
import { useUser } from "@/hooks/useUser";

export default function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, loading, notFound, refresh } = useCommunity(slug);
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading || userLoading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (notFound || !data) return <div className="p-8 text-center text-slate-500">Community not found.</div>;

  const { community } = data;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-slate-700">Log in or sign up to join {community.name}.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/login" className="rounded-full border border-slate-300 px-5 py-2">
            Log in
          </Link>
          <Link href="/signup" className="rounded-full bg-slate-900 px-5 py-2 text-white">
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  async function joinFree() {
    setBusy("free");
    setError(null);
    try {
      const res = await fetch(`/api/communities/${slug}/join`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not join");
        return;
      }
      await refresh();
      router.push(`/c/${slug}`);
    } finally {
      setBusy(null);
    }
  }

  async function payWithPaystack() {
    setBusy("paystack");
    setError(null);
    try {
      const res = await fetch("/api/payments/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not start payment");
        return;
      }
      window.location.href = body.authorizationUrl;
    } finally {
      setBusy(null);
    }
  }

  async function payWithFlutterwave() {
    setBusy("flutterwave");
    setError(null);
    try {
      const res = await fetch("/api/payments/flutterwave/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not start payment");
        return;
      }
      window.location.href = body.link;
    } finally {
      setBusy(null);
    }
  }

  async function payWithStripe() {
    setBusy("stripe");
    setError(null);
    try {
      const res = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not start payment");
        return;
      }
      window.location.href = body.url;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Join {community.name}</h1>
      <p className="mt-2 text-sm text-slate-600">{community.description}</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 space-y-3">
        {community.is_free ? (
          <button
            onClick={joinFree}
            disabled={busy !== null}
            className="w-full rounded-full bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy === "free" ? "Joining…" : "Join for free"}
          </button>
        ) : (
          <>
            {community.price_ngn_kobo > 0 && (
              <button
                onClick={payWithPaystack}
                disabled={busy !== null}
                className="w-full rounded-full bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy === "paystack"
                  ? "Redirecting…"
                  : `Pay ₦${(community.price_ngn_kobo / 100).toLocaleString()} with Paystack`}
              </button>
            )}
            {community.price_ngn_kobo > 0 && (
              <button
                onClick={payWithFlutterwave}
                disabled={busy !== null}
                className="w-full rounded-full border-2 border-slate-900 px-4 py-3 font-semibold text-slate-900 disabled:opacity-50"
              >
                {busy === "flutterwave"
                  ? "Redirecting…"
                  : `Pay ₦${(community.price_ngn_kobo / 100).toLocaleString()} with Flutterwave`}
              </button>
            )}
            {community.price_usd_cents > 0 && (
              <button
                onClick={payWithStripe}
                disabled={busy !== null}
                className="w-full rounded-full bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy === "stripe"
                  ? "Redirecting…"
                  : `Pay $${(community.price_usd_cents / 100).toLocaleString()} with Stripe`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
