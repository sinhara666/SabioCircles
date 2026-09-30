// End-to-end smoke test against a running server (npm run start -- -p 3100).
// Exercises real HTTP requests against real API routes backed by the real
// SQLite database — no mocking. Run with: node scripts/smoke-test.mjs

const BASE = process.env.BASE_URL || "http://localhost:3100";
let failures = 0;

function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`✗ FAIL: ${msg}`);
  } else {
    console.log(`✓ ${msg}`);
  }
}

class Client {
  constructor() {
    this.cookie = "";
  }
  async req(path, opts = {}) {
    const res = await fetch(BASE + path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(opts.headers || {}),
      },
      redirect: "manual",
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    let body = null;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body, headers: res.headers };
  }
}

async function main() {
  const rand = Math.random().toString(36).slice(2, 8);
  const owner = new Client();
  const member = new Client();

  // --- Signup ---
  let r = await owner.req("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: `owner_${rand}@test.dev`, password: "password123", name: "Owner Test", country: "NG" }),
  });
  assert(r.status === 201, `owner signup succeeds (got ${r.status})`);

  r = await member.req("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: `member_${rand}@test.dev`, password: "password123", name: "Member Test", country: "US" }),
  });
  assert(r.status === 201, `member signup succeeds (got ${r.status})`);

  // Duplicate signup should fail
  r = await owner.req("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: `owner_${rand}@test.dev`, password: "password123", name: "Owner Test", country: "NG" }),
  });
  assert(r.status === 409, `duplicate signup rejected (got ${r.status})`);

  // --- Login flow (fresh client) ---
  const loginCheck = new Client();
  r = await loginCheck.req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `owner_${rand}@test.dev`, password: "wrongpassword" }),
  });
  assert(r.status === 401, `login with wrong password rejected (got ${r.status})`);

  r = await loginCheck.req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `owner_${rand}@test.dev`, password: "password123" }),
  });
  assert(r.status === 200, `login with correct password succeeds (got ${r.status})`);

  r = await loginCheck.req("/api/auth/me");
  assert(r.body.user && r.body.user.email === `owner_${rand}@test.dev`, "session reflects logged-in user via /me");

  // --- Create a free community ---
  r = await owner.req("/api/communities", {
    method: "POST",
    body: JSON.stringify({ name: `Free Circle ${rand}`, description: "Test free community", isFree: true }),
  });
  assert(r.status === 201, `create free community succeeds (got ${r.status})`);
  const freeSlug = r.body.slug;

  // --- Create a paid community (NGN + USD) ---
  r = await owner.req("/api/communities", {
    method: "POST",
    body: JSON.stringify({
      name: `Paid Circle ${rand}`,
      description: "Test paid community",
      isFree: false,
      priceNgnKobo: 500000, // ₦5,000
      priceUsdCents: 1000, // $10
    }),
  });
  assert(r.status === 201, `create paid community succeeds (got ${r.status})`);
  const paidSlug = r.body.slug;

  // --- Anonymous cannot create a community ---
  const anon = new Client();
  r = await anon.req("/api/communities", {
    method: "POST",
    body: JSON.stringify({ name: "Should fail" }),
  });
  assert(r.status === 401, `anonymous cannot create community (got ${r.status})`);

  // --- Member joins the free community ---
  r = await member.req(`/api/communities/${freeSlug}/join`, { method: "POST" });
  assert(r.status === 200, `member joins free community (got ${r.status})`);

  // --- Member cannot post to paid community they haven't joined ---
  r = await member.req(`/api/communities/${paidSlug}/posts`, {
    method: "POST",
    body: JSON.stringify({ content: "Should be blocked" }),
  });
  assert(r.status === 403, `non-member blocked from posting in paid community (got ${r.status})`);

  // --- Member posts in free community, owner comments+likes ---
  r = await member.req(`/api/communities/${freeSlug}/posts`, {
    method: "POST",
    body: JSON.stringify({ content: "Hello from the smoke test!" }),
  });
  assert(r.status === 201, `member creates a post (got ${r.status})`);
  const postId = r.body.id;

  r = await owner.req(`/api/communities/${freeSlug}/join`, { method: "POST" });
  // owner is already a member (creator), so this should say alreadyMember
  assert(r.status === 200 && r.body.alreadyMember === true, "owner is already an active member of their own community");

  r = await owner.req(`/api/communities/${freeSlug}/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content: "Nice post!" }),
  });
  assert(r.status === 201, `owner comments on member's post (got ${r.status})`);

  r = await owner.req(`/api/communities/${freeSlug}/posts/${postId}/like`, { method: "POST" });
  assert(r.status === 200 && r.body.liked === true, `owner likes member's post (got ${r.status})`);

  // Toggle unlike
  r = await owner.req(`/api/communities/${freeSlug}/posts/${postId}/like`, { method: "POST" });
  assert(r.status === 200 && r.body.liked === false, "liking again toggles the like off");
  // Re-like so points calc below is deterministic
  await owner.req(`/api/communities/${freeSlug}/posts/${postId}/like`, { method: "POST" });

  // --- Points check: member should have 5 (post) + 1 (comment received) + 1 (like received) = 7 ---
  r = await member.req(`/api/communities/${freeSlug}`);
  assert(r.body.membership && r.body.membership.points === 7, `member has 7 points after post+comment+like (got ${r.body.membership?.points})`);
  assert(r.body.membership.level === 2, `7 points puts member at level 2 (got ${r.body.membership?.level})`);

  // --- Leaderboard reflects points, sorted descending ---
  r = await owner.req(`/api/communities/${freeSlug}/leaderboard`);
  const board = r.body.leaderboard;
  assert(Array.isArray(board) && board.length >= 2, "leaderboard returns entries");
  assert(board[0].points >= board[board.length - 1].points, "leaderboard sorted descending by points");
  const memberEntry = board.find((b) => b.points === 7);
  assert(!!memberEntry, "leaderboard includes the member's 7-point score");

  // --- Courses: only owner/admin can create ---
  r = await member.req(`/api/communities/${freeSlug}/courses`, {
    method: "POST",
    body: JSON.stringify({ title: "Should fail" }),
  });
  assert(r.status === 403, `non-owner blocked from creating a course (got ${r.status})`);

  r = await owner.req(`/api/communities/${freeSlug}/courses`, {
    method: "POST",
    body: JSON.stringify({ title: "Getting Started", description: "Intro course" }),
  });
  assert(r.status === 201, `owner creates a course (got ${r.status})`);
  const courseId = r.body.id;

  r = await owner.req(`/api/communities/${freeSlug}/courses/${courseId}/modules`, {
    method: "POST",
    body: JSON.stringify({ title: "Module 1" }),
  });
  assert(r.status === 201, `owner creates a module (got ${r.status})`);
  const moduleId = r.body.id;

  r = await owner.req(`/api/modules/${moduleId}/lessons`, {
    method: "POST",
    body: JSON.stringify({ title: "Lesson 1", videoUrl: "https://youtu.be/dQw4w9WgXcQ", content: "Watch this." }),
  });
  assert(r.status === 201, `owner creates a lesson (got ${r.status})`);
  const lessonId = r.body.id;

  // --- Member completes the lesson and earns points ---
  r = await member.req(`/api/lessons/${lessonId}/complete`, { method: "POST" });
  assert(r.status === 200, `member marks lesson complete (got ${r.status})`);

  r = await member.req(`/api/communities/${freeSlug}`);
  assert(r.body.membership.points === 17, `member has 17 points after completing a lesson (+10) (got ${r.body.membership?.points})`);

  // Completing again should not double-award points
  r = await member.req(`/api/lessons/${lessonId}/complete`, { method: "POST" });
  assert(r.status === 200 && r.body.alreadyCompleted === true, "completing the same lesson twice is a no-op");
  r = await member.req(`/api/communities/${freeSlug}`);
  assert(r.body.membership.points === 17, "points unchanged after duplicate completion");

  // --- Course view reflects completion ---
  r = await member.req(`/api/communities/${freeSlug}/courses/${courseId}`);
  const lesson = r.body.modules[0].lessons[0];
  assert(lesson.completed === true, "course detail shows lesson as completed for the member");

  // --- Paid community: posting/course access blocked without membership ---
  r = await member.req(`/api/communities/${paidSlug}/courses`);
  assert(r.status === 403, `courses blocked in paid community without membership (got ${r.status})`);

  // --- Payment initialization fails loudly without API keys (expected in this sandbox) ---
  r = await member.req("/api/payments/paystack/initialize", {
    method: "POST",
    body: JSON.stringify({ slug: paidSlug }),
  });
  assert(
    r.status === 502 && /PAYSTACK_SECRET_KEY/.test(r.body.error || ""),
    `Paystack initialize fails clearly without a real secret key configured (got ${r.status}: ${r.body.error})`
  );

  r = await member.req("/api/payments/stripe/checkout", {
    method: "POST",
    body: JSON.stringify({ slug: paidSlug }),
  });
  assert(
    r.status === 502 && /STRIPE_SECRET_KEY/.test(r.body.error || ""),
    `Stripe checkout fails clearly without a real secret key configured (got ${r.status}: ${r.body.error})`
  );

  r = await member.req("/api/payments/flutterwave/initialize", {
    method: "POST",
    body: JSON.stringify({ slug: paidSlug }),
  });
  assert(
    r.status === 502 && /FLUTTERWAVE_SECRET_KEY/.test(r.body.error || ""),
    `Flutterwave initialize fails clearly without a real secret key configured (got ${r.status}: ${r.body.error})`
  );

  // --- Webhook endpoints reject unsigned requests ---
  r = await anon.req("/api/payments/paystack/webhook", { method: "POST", body: JSON.stringify({ event: "charge.success" }) });
  assert(r.status === 401, `Paystack webhook rejects unsigned payloads (got ${r.status})`);

  r = await anon.req("/api/payments/flutterwave/webhook", { method: "POST", body: JSON.stringify({ event: "charge.completed" }) });
  assert(r.status === 401, `Flutterwave webhook rejects unsigned payloads (got ${r.status})`);

  r = await anon.req("/api/payments/stripe/webhook", { method: "POST", body: JSON.stringify({}) });
  assert(r.status === 401, `Stripe webhook rejects requests without signature (got ${r.status})`);

  // --- Logout clears session ---
  r = await member.req("/api/auth/logout", { method: "POST" });
  assert(r.status === 200, "logout succeeds");
  r = await member.req("/api/auth/me");
  assert(r.body.user === null, "session cleared after logout");

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
