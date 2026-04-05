import { requireAuth } from "@/lib/auth";

export async function GET() {
  const { error, status, session } = await requireAuth();
  if (error || !session) {
    return Response.json({ error: error ?? "Unauthorized" }, { status });
  }

  return Response.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      baseRole: session.user.baseRole,
      preferredLang: session.user.preferredLang,
    },
    activeRoleMode: session.activeRoleMode,
    sessionId: session.id,
  });
}
