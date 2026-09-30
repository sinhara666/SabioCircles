import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, id, now } from "@/lib/db";
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { notify } from "@/lib/notifications";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(80),
  country: z.string().min(2).max(2).default("NG"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email, password, name, country } = parsed.data;

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const userId = id();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, country, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(userId, email.toLowerCase(), passwordHash, name, country.toUpperCase(), now());

  const token = await createSessionToken(userId);
  await setSessionCookie(token);

  notify(userId, "welcome", "Welcome to SabioCircles!", "Find a circle that feels like home, or start your own.", "/communities");

  return NextResponse.json({ id: userId, email: email.toLowerCase(), name, country: country.toUpperCase() }, { status: 201 });
}
