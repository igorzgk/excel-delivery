import { NextResponse } from "next/server";
import { createReadStream, stat } from "fs/promises";
import { createReadStream as fsRead } from "fs";
import path from "path";

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const fullPath = path.join(process.cwd(), "uploads", ...parts);
  try {
    const s = await stat(fullPath);
    if (!s.isFile()) throw new Error("not a file");
    const stream = fsRead(fullPath);
    return new Response(stream as any, {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
