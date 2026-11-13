import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getUser } from "@/lib/auth";

// Development fallback: when no Vercel Blob token is configured, store uploads in /public/uploads.
// Never used on Vercel (the filesystem there is read-only) — configure Blob storage instead.
const localMode = () => !process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL;

export async function GET() {
  return NextResponse.json({ mode: localMode() ? "local" : "blob" });
}

export async function PUT(req: Request) {
  if (!localMode()) return NextResponse.json({ error: "Local uploads disabled" }, { status: 400 });
  if (!(await getUser())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const name = new URL(req.url).searchParams.get("name") || "file";
  const safe = name.replace(/\.\.+/g, ".").replace(/[^\w./\- ]+/g, "_");
  const rel = path.posix.join("uploads", `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, path.posix.basename(safe));
  const abs = path.join(process.cwd(), "public", rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await req.arrayBuffer()));
  return NextResponse.json({ url: "/" + rel });
}
