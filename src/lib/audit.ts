import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

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
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}
