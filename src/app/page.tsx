import Link from "next/link";

export default function Home() {
  return (
    <div>
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Build a paid community that works everywhere —{" "}
          <span className="text-emerald-600">including Nigeria</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Communities, courses, and gamified engagement like the platforms you know — but priced
          in Naira and paid for with cards, bank transfer, or USSD via Paystack, alongside Stripe
          for members everywhere else.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/communities/new"
            className="rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500"
          >
            Start a community
          </Link>
          <Link
            href="/communities"
            className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Discover communities
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 pb-20 sm:grid-cols-3">
        {[
          {
            title: "Community feed",
            body: "Posts, comments, and likes so members actually talk to each other, not just watch videos.",
          },
          {
            title: "Classroom",
            body: "Modules and lessons your members work through, with progress tracked automatically.",
          },
          {
            title: "Points & leaderboard",
            body: "Real activity earns points and levels, with a live per-community leaderboard.",
          },
          {
            title: "Naira-first payments",
            body: "Price memberships in Naira and get paid via Paystack — cards, transfer, USSD.",
          },
          {
            title: "Stripe for the rest of the world",
            body: "Members outside Africa check out in USD with Stripe, no extra work for you.",
          },
          {
            title: "You own it",
            body: "Your community, your data, your rules — no algorithm deciding who sees your posts.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
