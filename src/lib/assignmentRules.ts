import { prisma } from "@/lib/prisma";

/** Pull emails from any text (filename, title, URL, etc.) */
export function extractEmailsFromText(text?: string | null): string[] {
  if (!text) return [];
  try {
    if (/^https?:\/\//i.test(text)) {
      const u = new URL(text);
      text = decodeURIComponent(u.pathname.split("/").pop() || "");
    }
  } catch { /* ignore URL parse errors */ }

  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const found = text.match(emailRe) || [];
  return Array.from(new Set(found.map((e) => e.trim().toLowerCase())));
}

/** Resolve ACTIVE non-admin users whose emails match */
export async function resolveAssigneeIdsByEmails(emails: string[]) {
  if (emails.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { email: { in: emails }, role: "USER", status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
