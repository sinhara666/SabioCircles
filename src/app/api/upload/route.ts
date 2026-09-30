import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { requireUser } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_BYTES = 200 * 1024 * 1024; // 200MB
const ALLOWED_EXT = new Set([".mp4", ".webm", ".mov", ".png", ".jpg", ".jpeg", ".gif", ".webp"]);

export async function POST(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 200MB)" }, { status: 413 });
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: `Unsupported file type ${ext}` }, { status: 400 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return NextResponse.json({ url: `/api/uploads/${filename}` }, { status: 201 });
}
