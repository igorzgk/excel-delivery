// src/lib/apiKeyAuth.ts
export function requireApiKey(req: Request) {
  const header = req.headers.get("x-api-key");
  const expected = process.env.INTEGRATIONS_API_KEY;
  if (!expected || !header || header !== expected) {
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
