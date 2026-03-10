import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getAdminClient,
  getBucket,
  supabasePutBuffer,
  supabaseRemove,
  supabaseCreateSignedUrl,
} from "@/lib/storage-supabase";

export const runtime = "nodejs";

function mask(value?: string | null) {
  if (!value) return null;
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const bucket = getBucket();

  const rawUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;

  const rawKey =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    null;

  const debugKey = `debug/storage-check-${Date.now()}.txt`;

  const result: any = {
    ok: true,
    env: {
      bucket,
      supabaseUrlMasked: mask(rawUrl),
      serviceKeyMasked: mask(rawKey),
      has_SUPABASE_URL: !!process.env.SUPABASE_URL,
      has_NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
      has_SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      has_SUPABASE_BUCKET: !!process.env.SUPABASE_BUCKET,
    },
    tests: {
      upload: null,
      listRoot: null,
      listDebugPrefix: null,
      signedUrl: null,
      delete: null,
    },
  };

  try {
    const supabase = getAdminClient();

    // 1) upload test file
    await supabasePutBuffer(
      debugKey,
      Buffer.from(`storage debug ${new Date().toISOString()}`, "utf8"),
      "text/plain"
    );
    result.tests.upload = { ok: true, key: debugKey };

    // 2) list root
    {
      const { data, error } = await supabase.storage.from(bucket).list("", {
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

      result.tests.listRoot = {
        ok: !error,
        error: error?.message || null,
        items: (data || []).map((x: any) => ({
          name: x.name,
          id: x.id ?? null,
        })),
      };
    }

    // 3) list debug prefix
    {
      const { data, error } = await supabase.storage.from(bucket).list("debug", {
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

      result.tests.listDebugPrefix = {
        ok: !error,
        error: error?.message || null,
        items: (data || []).map((x: any) => ({
          name: x.name,
          id: x.id ?? null,
        })),
      };
    }

    // 4) signed url
    try {
      const signed = await supabaseCreateSignedUrl(debugKey, 300);
      result.tests.signedUrl = {
        ok: true,
        key: debugKey,
        signedUrlPreview: mask(signed.signedUrl),
      };
    } catch (e: any) {
      result.tests.signedUrl = {
        ok: false,
        error: e?.message || "sign failed",
      };
    }

    // 5) delete test file
    try {
      await supabaseRemove([debugKey]);
      result.tests.delete = {
        ok: true,
        key: debugKey,
      };
    } catch (e: any) {
      result.tests.delete = {
        ok: false,
        error: e?.message || "delete failed",
      };
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "storage_debug_failed",
        detail: err?.message || "Unknown error",
        partial: result,
      },
      { status: 500 }
    );
  }
}