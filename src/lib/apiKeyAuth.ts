// src/lib/apiKeyAuth.ts
export function requireApiKey(req: Request) {
  const header1 = req.headers.get("x-api-key")?.trim();
  const auth = req.headers.get("authorization") || "";
  const header2 = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : undefined;
  const provided = header1 || header2;

  const expected = (process.env.INTEGRATIONS_API_KEY || "").trim();
  if (!expected || !provided || provided !== expected) {
    return {
      ok: false as const,
      res: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  return { ok: true as const };
}
