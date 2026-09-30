# NaijaCircles

A Skool-style paid community platform (communities, discussion feed, courses,
points/levels/leaderboard) built to actually work for a Nigerian audience:
Naira pricing and payment via **Paystack** and **Flutterwave**, alongside
**Stripe** for members paying from outside Africa.

This is a real, working Next.js application — a proper database, real
password hashing and sessions, real payment SDK integrations, and real file
uploads for lesson videos. Nothing here is mocked or simulated. The one
thing that genuinely cannot be faked: to *accept real money*, you need your
own Paystack/Flutterwave/Stripe account and API keys (see below) — that's
true of any payment integration, not a limitation of this build.

## What's built

- **Auth** — email/password signup & login, bcrypt-hashed passwords,
  signed JWT session cookies.
- **Communities** — create a community (free or paid), join, member counts.
- **Feed** — posts, comments, likes, all scoped per-community.
- **Classroom** — courses → modules → lessons, with video via YouTube/Vimeo
  URL or direct file upload, and per-user lesson-completion tracking.
- **Gamification** — points for posting, receiving comments/likes, and
  completing lessons; automatic levels; a live per-community leaderboard.
- **Payments** — Paystack and Flutterwave for Naira-priced communities,
  Stripe for USD-priced communities. Webhooks are the source of truth for
  activating membership; the checkout redirect just gives the user instant
  feedback.
- **File uploads** — lesson videos/images are uploaded and served for real
  (stored on disk, streamed back with correct content types; protected
  against path traversal).

## Tech stack

- Next.js 16 (App Router, TypeScript, Tailwind v4)
- SQLite via Node's built-in `node:sqlite` — zero native dependencies, so
  there's nothing to compile or download to get the database running
- `jose` for JWT sessions, `bcryptjs` for password hashing
- `stripe` official SDK; Paystack and Flutterwave are called directly via
  their REST APIs (both are simple enough not to need a wrapper library)

## Getting started

```bash
npm install
cp .env.example .env    # then fill in the keys you have (see below)
npm run build
npm run start -- -p 3000
```

Or for local development with hot reload: `npm run dev`.

The SQLite database file is created automatically at `data/app.db` on first
run — no setup step needed. Uploaded lesson files land in `uploads/`.

### Environment variables

See `.env.example` for the full list with links to where to get each key.
At minimum, set `SESSION_SECRET` to a random string
(`openssl rand -base64 32`) before deploying anywhere real — the app runs
without it (using a fixed development fallback) but that is **not safe for
production**, since anyone with the source could forge session cookies.

Payments only work once you add real keys:

| Provider    | Env vars                                        | Where to get them |
|-------------|--------------------------------------------------|--------------------|
| Paystack    | `PAYSTACK_SECRET_KEY`                            | dashboard.paystack.com → Settings → API Keys |
| Flutterwave | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH` | dashboard.flutterwave.com → Settings → API + Webhooks |
| Stripe      | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`     | dashboard.stripe.com → API keys / Webhooks |

Without these set, the app still runs fully — signup, communities, the
feed, courses, gamification all work — but a "Pay with X" button will
return a clear error instead of pretending to succeed. That's intentional:
this build never fakes a successful payment.

For webhooks to reach your app during local development, use a tunnel
(e.g. `ngrok http 3000`) and point each provider's webhook URL at
`https://<your-tunnel>/api/payments/<provider>/webhook`.

### Deploying

This is a standard Next.js app, so it deploys to Vercel, Render, Railway,
or any Node host. Two things to keep in mind:

1. **Persistent disk.** SQLite and uploaded files live on local disk. Most
   serverless platforms (including Vercel's default deployment) don't give
   you persistent disk, so the database would reset on every deploy. For
   production, either deploy to a host with a persistent volume (Railway,
   Render, a plain VPS), or swap `src/lib/db.ts` for a hosted database —
   the SQL is plain enough that moving to Postgres later is a
   straightforward rewrite of that one file.
2. Set `SESSION_SECRET` and whichever payment provider keys you're using
   as environment variables on the host.

## Testing

Two layers of real tests are included, both passing:

```bash
npm run test         # unit tests (points/levels math) via Vitest
npm run build && npm run start -- -p 3100   # in one terminal
npm run smoke-test   # in another: full HTTP flow against the real server
```

The smoke test signs up two real users, creates a free and a paid
community, posts/comments/likes, verifies exact point totals and
leaderboard ordering, creates a course/module/lesson, completes it and
checks points again, confirms access control (non-members blocked from
paid content, non-owners blocked from creating courses), and confirms
every payment endpoint fails clearly — not silently — without real API
keys configured. It's not mocked: it's hitting the actual running server
and actual SQLite database.

## Project structure

```
src/
  app/                 pages (App Router) + API routes under app/api
  components/          shared UI (nav, community header)
  hooks/               client-side data hooks (useUser, useCommunity)
  lib/
    db.ts              SQLite connection + schema migration
    auth.ts            password hashing, JWT sessions
    points.ts           points/levels logic
    access.ts           membership/role checks
    communities.ts       community lookups + membership activation
    payments/            paystack.ts, flutterwave.ts, stripe.ts
scripts/
  smoke-test.mjs       end-to-end HTTP test suite
data/                  SQLite database file (gitignored, created at runtime)
uploads/               uploaded lesson videos/images (gitignored)
```

## What's intentionally out of scope for this MVP

To keep this a real, working build rather than an over-scoped one:
subscription renewals/cancellation flows (payments here are one-time
membership charges — recurring billing is a natural next step using each
provider's subscription APIs), admin moderation tools, email
notifications, and a native mobile app. The data model and API are
structured so all of these are additive, not rewrites.
