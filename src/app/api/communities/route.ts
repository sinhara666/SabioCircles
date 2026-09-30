import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, id, now } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const rows = db
    .prepare(
      `SELECT c.id, c.slug, c.name, c.description, c.is_free, c.price_ngn_kobo, c.price_usd_cents, c.created_at,
              u.name as owner_name,
              (SELECT COUNT(*) FROM memberships m WHERE m.community_id = c.id AND m.status = 'active') as member_count
       FROM communities c JOIN users u ON u.id = c.owner_id
       ORDER BY c.created_at DESC`
    )
    .all();
  return NextResponse.json({ communities: rows });
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

const schema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(2000).default(""),
  isFree: z.boolean().default(true),
  priceNgnKobo: z.number().int().min(0).default(0),
  priceUsdCents: z.number().int().min(0).default(0),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, description, isFree, priceNgnKobo, priceUsdCents } = parsed.data;

  let slug = slugify(name);
  if (!slug) slug = id().slice(0, 8);
  const existing = db.prepare("SELECT id FROM communities WHERE slug = ?").get(slug);
  if (existing) slug = `${slug}-${id().slice(0, 6)}`;

  const communityId = id();
  const ts = now();
  db.prepare(
    `INSERT INTO communities (id, slug, name, description, owner_id, price_ngn_kobo, price_usd_cents, is_free, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(communityId, slug, name, description, user.id, isFree ? 0 : priceNgnKobo, isFree ? 0 : priceUsdCents, isFree ? 1 : 0, ts);

  db.prepare(
    "INSERT INTO memberships (id, user_id, community_id, role, status, points, created_at) VALUES (?, ?, ?, 'owner', 'active', 0, ?)"
  ).run(id(), user.id, communityId, ts);

  return NextResponse.json({ id: communityId, slug }, { status: 201 });
}
