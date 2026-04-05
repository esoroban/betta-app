import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE = "betta_session";
const SHORT_SESSION_MS = 24 * 60 * 60 * 1000;      // 1 day (browser session)
const LONG_SESSION_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days (remember me)

export async function createSession(userId: string, baseRole: string, rememberMe = false) {
  const maxAge = rememberMe ? LONG_SESSION_MS : SHORT_SESSION_MS;

  const session = await prisma.appSession.create({
    data: {
      userId,
      baseRole: baseRole as never,
      activeRoleMode: baseRole as never,
      expiresAt: new Date(Date.now() + maxAge),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(rememberMe ? { maxAge: maxAge / 1000 } : {}),
    // No maxAge = session cookie (dies when browser closes)
  });

  return session;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await prisma.appSession.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;
  if (session.isRevoked) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.user.status !== "active") return null;

  // Touch lastSeenAt
  await prisma.appSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return session;
}

export async function revokeSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return;

  await prisma.appSession.update({
    where: { id: sessionId },
    data: { isRevoked: true },
  }).catch(() => {});

  cookieStore.delete(SESSION_COOKIE);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    return { error: "Unauthorized", status: 401, session: null };
  }
  return { error: null, status: 200, session };
}
