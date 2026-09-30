import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ filename: string }> }) {
  const { filename } = await ctx.params;
  // Prevent path traversal — only allow bare filenames we generated.
  if (filename.includes("/") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  const ext = path.extname(filename).toLowerCase();
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
