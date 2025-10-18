import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({
    INTEGRATIONS_API_KEY: !!process.env.INTEGRATIONS_API_KEY,
    runtime: process.env.VERCEL ? "vercel" : "local",
  });
}
