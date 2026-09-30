"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCommunity } from "@/hooks/useCommunity";
import { useUser } from "@/hooks/useUser";
import CommunityHeader from "@/components/CommunityHeader";

type Post = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_name: string;
  like_count: number;
  comment_count: number;
};

type Comment = { id: string; content: string; author_name: string; created_at: string };

function PostCard({ slug, post, userId }: { slug: string; post: Post; userId?: string }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(post.comment_count);

  async function toggleLike() {
    const res = await fetch(`/api/communities/${slug}/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setLiked(data.liked);
    setLikeCount((c) => c + (data.liked ? 1 : -1));
  }

  async function loadComments() {
    setShowComments((s) => !s);
    if (!comments) {
      const res = await fetch(`/api/communities/${slug}/posts/${post.id}/comments`);
      const data = await res.json();
      setComments(data.comments);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const res = await fetch(`/api/communities/${slug}/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText }),
    });
    if (res.ok) {
      const newComment = { id: crypto.randomUUID(), content: commentText, author_name: "You", created_at: new Date().toISOString() };
      setComments((c) => [...(c || []), newComment]);
      setCommentCount((c) => c + 1);
      setCommentText("");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">{post.author_name}</span>
        <span className="text-xs text-slate-400">{new Date(post.created_at).toLocaleString()}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{post.content}</p>
      <div className="mt-3 flex gap-4 text-sm text-slate-500">
        <button onClick={toggleLike} disabled={!userId} className={liked ? "font-medium text-emerald-600" : ""}>
          👍 {likeCount}
        </button>
        <button onClick={loadComments}>💬 {commentCount}</button>
      </div>
      {showComments && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {comments?.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium text-slate-800">{c.author_name}: </span>
              <span className="text-slate-600">{c.content}</span>
            </div>
          ))}
          {userId && (
            <form onSubmit={submitComment} className="mt-2 flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white">
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function CommunityFeedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const payment = searchParams.get("payment");
  const { data, loading, notFound } = useCommunity(slug);
  const { user } = useUser();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [gated, setGated] = useState(false);
  const [query, setQuery] = useState("");
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPosts(search = "") {
    const url = `/api/communities/${slug}/posts${search ? `?q=${encodeURIComponent(search)}` : ""}`;
    const res = await fetch(url);
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      if (body.gated) {
        setGated(true);
        setPosts([]);
        return;
      }
    }
    if (res.ok) {
      setGated(false);
      setPosts((await res.json()).posts);
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    loadPosts(query);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!newPost.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/communities/${slug}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newPost }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not post");
        return;
      }
      setNewPost("");
      loadPosts();
    } finally {
      setPosting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (notFound || !data) return <div className="p-8 text-center text-slate-500">Community not found.</div>;

  const isMember = data.membership && data.membership.status === "active";

  return (
    <div>
      <CommunityHeader data={data} />
      <div className="mx-auto max-w-4xl px-4 py-8">
        {payment === "success" && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Payment confirmed. You are in, welcome to {data.community.name}!
          </div>
        )}
        {payment === "cancelled" && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Payment was cancelled. No charge was made. You can try again whenever you are ready.
          </div>
        )}
        {(payment === "failed" || payment === "error") && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Something went wrong with the payment. You were not charged. Please try again.
          </div>
        )}
        {gated ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-lg font-semibold text-slate-900">Members only</p>
            <p className="mt-2 text-sm text-slate-500">
              Join {data.community.name} to read posts, comment, and take part.
            </p>
            <Link
              href={`/c/${slug}/join`}
              className="mt-4 inline-block rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white"
            >
              Join now
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={onSearch} className="mb-6 flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search posts in this community…"
                className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm"
              />
              <button type="submit" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white">
                Search
              </button>
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    loadPosts("");
                  }}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600"
                >
                  Clear
                </button>
              )}
            </form>
            {isMember && (
          <form onSubmit={submitPost} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Share something with the community…"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={posting}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Post
              </button>
            </div>
          </form>
        )}
        {!isMember && (
          <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
            Join this community to post and comment.
          </div>
        )}
        <div className="space-y-4">
          {posts === null && <p className="text-slate-500">Loading posts…</p>}
          {posts?.length === 0 && !query && <p className="text-slate-500">No posts yet. Be the first to share something.</p>}
          {posts?.length === 0 && query && <p className="text-slate-500">No posts matched your search.</p>}
          {posts?.map((p) => (
            <PostCard key={p.id} slug={slug} post={p} userId={user?.id} />
          ))}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
