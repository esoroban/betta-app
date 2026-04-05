import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSwitchTo } from "@/lib/roles";

export async function POST(request: NextRequest) {
  const { error, status, session } = await requireAuth();
  if (error || !session) {
    return Response.json({ error: error ?? "Unauthorized" }, { status });
  }

  const body = await request.json().catch(() => null);
  const targetRole = body?.role as Role;

  if (!targetRole || !Object.values(Role).includes(targetRole)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!canSwitchTo(session.baseRole, targetRole)) {
    return Response.json({ error: "Cannot switch to this role" }, { status: 403 });
  }

  await prisma.appSession.update({
    where: { id: session.id },
    data: { activeRoleMode: targetRole },
  });

  return Response.json({
    activeRoleMode: targetRole,
    baseRole: session.baseRole,
  });
}
