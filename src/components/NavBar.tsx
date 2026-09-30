"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  is_read: number;
  created_at: string;
};

function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const body = await res.json();
      setItems(body.notifications ?? []);
      setUnread(body.unread ?? 0);
    } catch {
      /* offline: keep quiet */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications/read", { method: "POST" });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative rounded-full p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-900">
            Notifications
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Nothing yet. You are all caught up.</p>
            )}
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.link || "/"}
                onClick={() => setOpen(false)}
                className={`block border-b border-slate-50 px-4 py-3 hover:bg-slate-50 ${n.is_read ? "" : "bg-emerald-50/50"}`}
              >
                <p className="text-sm font-medium text-slate-900">{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const { user, loading, refresh } = useUser();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          Sabio<span className="text-emerald-600">Circles</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/communities" className="text-slate-600 hover:text-slate-900">
            Discover
          </Link>
          {!loading && user && (
            <Link href="/communities/new" className="text-slate-600 hover:text-slate-900">
              Create
            </Link>
          )}
          {!loading && !user && (
            <>
              <Link href="/login" className="text-slate-600 hover:text-slate-900">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-slate-900 px-4 py-1.5 font-medium text-white hover:bg-slate-700"
              >
                Sign up
              </Link>
            </>
          )}
          {!loading && user && (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <span className="text-slate-500">Hi, {user.name.split(" ")[0]}</span>
              <button onClick={logout} className="text-slate-600 hover:text-slate-900">
                Log out
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
