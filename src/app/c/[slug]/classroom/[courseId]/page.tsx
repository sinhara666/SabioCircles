"use client";

import { useEffect, useState, use } from "react";
import { useCommunity } from "@/hooks/useCommunity";
import CommunityHeader from "@/components/CommunityHeader";

type Lesson = { id: string; title: string; video_url: string; content: string; position: number; completed: boolean };
type Module = { id: string; title: string; position: number; lessons: Lesson[] };
type Course = { id: string; title: string; description: string };

function VideoEmbed({ url }: { url: string }) {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([\w-]+)/);
  if (yt) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${yt[1]}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe className="h-full w-full" src={`https://player.vimeo.com/video/${vimeo[1]}`} allowFullScreen />
      </div>
    );
  }
  if (url.startsWith("/api/uploads/") || /\.(mp4|webm|mov)$/i.test(url)) {
    return (
      <video controls className="w-full rounded-lg bg-black">
        <source src={url} />
      </video>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-sm text-emerald-600 underline">
      Open video
    </a>
  );
}

function LessonRow({
  lesson,
  onComplete,
}: {
  lesson: Lesson;
  onComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function markComplete() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/complete`, { method: "POST" });
      if (res.ok) onComplete();
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
      >
        <span className={lesson.completed ? "text-slate-400 line-through" : "text-slate-800"}>{lesson.title}</span>
        <span className="text-xs text-emerald-600">{lesson.completed ? "✓ Done" : ""}</span>
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          <VideoEmbed url={lesson.video_url} />
          {lesson.content && <p className="text-sm text-slate-600 whitespace-pre-wrap">{lesson.content}</p>}
          {!lesson.completed && (
            <button
              onClick={markComplete}
              disabled={completing}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Mark complete (+10 pts)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddLessonForm({ moduleId, onAdded }: { moduleId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) setVideoUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/modules/${moduleId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, videoUrl, content }),
      });
      if (res.ok) {
        setTitle("");
        setVideoUrl("");
        setContent("");
        onAdded();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-slate-100 px-4 py-3">
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Lesson title"
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="YouTube / Vimeo URL, or upload a file →"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
          {uploading ? "Uploading…" : "Upload"}
          <input type="file" accept="video/*,image/*" onChange={handleFile} className="hidden" />
        </label>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Lesson notes (optional)"
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        Add lesson
      </button>
    </form>
  );
}

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string; courseId: string }> }) {
  const { slug, courseId } = use(params);
  const { data, loading, notFound } = useCommunity(slug);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  async function load() {
    const res = await fetch(`/api/communities/${slug}/courses/${courseId}`);
    if (res.ok) {
      const d = await res.json();
      setCourse(d.course);
      setModules(d.modules);
      setError(null);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not load course");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, courseId]);

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/communities/${slug}/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newModuleTitle }),
    });
    if (res.ok) {
      setNewModuleTitle("");
      load();
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (notFound || !data) return <div className="p-8 text-center text-slate-500">Community not found.</div>;

  const isOwnerOrAdmin = data.membership?.role === "owner" || data.membership?.role === "admin";

  return (
    <div>
      <CommunityHeader data={data} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        {error && <p className="text-slate-500">{error}</p>}
        {course && (
          <>
            <h1 className="text-xl font-bold text-slate-900">{course.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{course.description}</p>

            <div className="mt-6 space-y-4">
              {modules?.map((m) => (
                <div key={m.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <h3 className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">{m.title}</h3>
                  {m.lessons.map((l) => (
                    <LessonRow key={l.id} lesson={l} onComplete={load} />
                  ))}
                  {isOwnerOrAdmin && <AddLessonForm moduleId={m.id} onAdded={load} />}
                </div>
              ))}
            </div>

            {isOwnerOrAdmin && (
              <form onSubmit={addModule} className="mt-6 flex gap-2">
                <input
                  required
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  placeholder="New module title"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  + Module
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
