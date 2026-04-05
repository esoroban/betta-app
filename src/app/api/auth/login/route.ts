import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return Response.json({ error: "Email and password required" }, { status: 400 });
  }

  const { email, password } = body;

  const { allowed, retryAfterMs } = checkRateLimit(`login:${email}`);
  if (!allowed) {
    return Response.json(
      { error: `Too many attempts. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.` },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (user.status !== "active") {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const session = await createSession(user.id, user.baseRole, !!body.rememberMe);

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      baseRole: user.baseRole,
    },
    sessionId: session.id,
    activeRoleMode: session.activeRoleMode,
  });
}
