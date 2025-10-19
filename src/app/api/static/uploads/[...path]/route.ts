// src/app/api/static/uploads/[...path]/route.ts
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      error: "deprecated",
      message: "Local /uploads is not used on Vercel. Use /api/files/download/<key> instead (Supabase Storage).",
    },
    { status: 410 }
  );
}
