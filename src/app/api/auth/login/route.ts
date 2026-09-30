import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = db
    .prepare("SELECT id, email, name, country, password_hash FROM users WHERE email = ?")
    .get(email.toLowerCase()) as
    | { id: string; email: string; name: string; country: string; password_hash: string }
    | undefined;

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSessionToken(user.id);
  await setSessionCookie(token);

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, country: user.country });
}
