import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function verifyApiKey(plainKey?: string | null) {
  if (!plainKey) return null;
  const all = await prisma.apiKey.findMany({ where: { isActive: true }, select: { id: true, keyHash: true } });
  for (const k of all) {
    const ok = await bcrypt.compare(plainKey, k.keyHash);
    if (ok) {
      await prisma.apiKey.update({ where: { id: k.id }, data: { lastUsedAt: new Date() } });
      return k;
    }
  }
  return null;
}
