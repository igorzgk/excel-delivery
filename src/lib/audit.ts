import { prisma } from "@/lib/prisma";

type LogParams = {
  actorId?: string | null;
  action:
    | "USER_CREATED"
    | "SUBSCRIPTION_TOGGLED"
    | "FILE_UPLOADED"
    | "FILE_ASSIGNED"
    | "APIKEY_CREATED"
    | "APIKEY_REVOKED"
    | "DOWNLOAD_GRANTED";
  targetId?: string | null;
  target?: string | null;
  meta?: Record<string, any> | null;
};

export async function logAudit(p: LogParams) {
  await prisma.auditLog.create({
    data: {
      actorId: p.actorId ?? null,
      action: p.action,
      targetId: p.targetId ?? null,
      target: p.target ?? null,
      meta: p.meta ?? null,
    },
  });
}
