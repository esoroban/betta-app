import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canReview, canCreateUser } from "@/lib/roles";
import { Role } from "@prisma/client";

export async function GET() {
  const { error, status, session } = await requireAuth();
  if (error || !session) return Response.json({ error }, { status });

  if (!canReview(session.activeRoleMode as Role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      baseRole: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ users });
}

export async function POST(request: NextRequest) {
  const { error, status, session } = await requireAuth();
  if (error || !session) return Response.json({ error }, { status });

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password || !body?.displayName || !body?.role) {
    return Response.json({ error: "email, password, displayName, role required" }, { status: 400 });
  }

  const targetRole = body.role as Role;
  if (!Object.values(Role).includes(targetRole)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!canCreateUser(session.activeRoleMode as Role, targetRole)) {
    return Response.json({ error: "Cannot create user with this role" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return Response.json({ error: "Email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash: await bcrypt.hash(body.password, 10),
      displayName: body.displayName,
      baseRole: targetRole,
      createdBy: session.userId,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      baseRole: true,
      status: true,
    },
  });

  return Response.json({ user }, { status: 201 });
}
