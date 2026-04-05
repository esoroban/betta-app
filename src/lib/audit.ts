import { prisma } from "./prisma";

export async function createAuditEvent(
  actorUserId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
) {
  return prisma.auditEvent.create({
    data: {
      actorUserId,
      actionType,
      targetType,
      targetId,
      metadata: metadata ?? undefined,
    },
  });
}
