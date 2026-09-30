"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useCommunity } from "@/hooks/useCommunity";
import CommunityHeader from "@/components/CommunityHeader";

type Course = { id: string; title: string; description: string; module_count: number };

export default function ClassroomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, loading, notFound } = useCommunity(slug);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function loadCourses() {
    const res = await fetch(`/api/communities/${slug}/courses`);
    if (res.ok) {
      setCourses((await res.json()).courses);
      setError(null);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not load courses");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/communities/${slug}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        setShowForm(false);
        loadCourses();
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (notFound || !data) return <div className="p-8 text-center text-slate-500">Community not found.</div>;

  const isOwnerOrAdmin = data.membership?.role === "owner" || data.membership?.role === "admin";

  return (
    <div>
      <CommunityHeader data={data} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        {isOwnerOrAdmin && (
          <div className="mb-6">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                + New course
              </button>
            ) : (
              <form onSubmit={createCourse} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Course title"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-slate-500">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {error && <p className="text-sm text-slate-500">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          {courses?.map((c) => (
            <Link
              key={c.id}
              href={`/c/${slug}/classroom/${c.id}`}
              className="rounded-xl border border-slate-200 bg-white p-5 hover:border-emerald-400"
            >
              <h3 className="font-semibold text-slate-900">{c.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.description}</p>
              <p className="mt-3 text-xs text-slate-500">{c.module_count} module{c.module_count === 1 ? "" : "s"}</p>
            </Link>
          ))}
          {courses?.length === 0 && !error && <p className="text-slate-500">No courses yet.</p>}
        </div>
      </div>
    </div>
  );
}
