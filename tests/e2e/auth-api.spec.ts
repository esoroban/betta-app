import { test, expect } from "@playwright/test";

// ═══════════ Helpers ═══════════

async function login(request: any, email: string, password: string) {
  return request.post("/api/auth/login", {
    data: { email, password },
  });
}

async function getSession(request: any) {
  return request.get("/api/auth/session");
}

async function logout(request: any) {
  return request.post("/api/auth/logout");
}

async function switchRole(request: any, role: string) {
  return request.post("/api/auth/switch-role", {
    data: { role },
  });
}

// ═══════════ Login ═══════════

test.describe("Auth API — Login", () => {
  test("owner can login with correct credentials", async ({ request }) => {
    const res = await login(request, "owner@sylaslova.com", "owner123");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("owner@sylaslova.com");
    expect(body.user.baseRole).toBe("owner");
    expect(body.activeRoleMode).toBe("owner");
    expect(body.sessionId).toBeTruthy();
  });

  test("administrator can login", async ({ request }) => {
    const res = await login(request, "admin@sylaslova.com", "admin123");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.baseRole).toBe("administrator");
  });

  test("revisioner can login", async ({ request }) => {
    const res = await login(request, "revisioner@sylaslova.com", "rev123");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.baseRole).toBe("revisioner");
  });

  test("teacher can login", async ({ request }) => {
    const res = await login(request, "teacher1@sylaslova.com", "teach123");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.baseRole).toBe("teacher");
  });

  test("student can login", async ({ request }) => {
    const res = await login(request, "student1@sylaslova.com", "stud123");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.baseRole).toBe("student");
  });

  test("wrong password returns 401", async ({ request }) => {
    const res = await login(request, "owner@sylaslova.com", "wrongpass");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Invalid");
  });

  test("nonexistent email returns 401", async ({ request }) => {
    const res = await login(request, "nobody@sylaslova.com", "pass123");
    expect(res.status()).toBe(401);
  });

  test("missing email returns 400", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { password: "pass" },
    });
    expect(res.status()).toBe(400);
  });

  test("missing password returns 400", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: "owner@sylaslova.com" },
    });
    expect(res.status()).toBe(400);
  });

  test("empty body returns 400", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});

// ═══════════ Session ═══════════

test.describe("Auth API — Session", () => {
  test("session returns user after login", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    const res = await getSession(request);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("owner@sylaslova.com");
    expect(body.user.displayName).toBe("Owner");
    expect(body.user.baseRole).toBe("owner");
    expect(body.user.preferredLang).toBe("en");
    expect(body.activeRoleMode).toBe("owner");
  });

  test("session returns 401 without login", async ({ request }) => {
    const res = await getSession(request);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("session returns 401 after logout", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    await logout(request);
    const res = await getSession(request);
    expect(res.status()).toBe(401);
  });
});

// ═══════════ Logout ═══════════

test.describe("Auth API — Logout", () => {
  test("logout succeeds", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    const res = await logout(request);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("session is revoked after logout", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    const sessionBefore = await getSession(request);
    expect(sessionBefore.status()).toBe(200);
    await logout(request);
    const sessionAfter = await getSession(request);
    expect(sessionAfter.status()).toBe(401);
  });
});

// ═══════════ Role Switch ═══════════

test.describe("Auth API — Role Switch", () => {
  test("owner can switch to administrator", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    const res = await switchRole(request, "administrator");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.activeRoleMode).toBe("administrator");
    expect(body.baseRole).toBe("owner");
  });

  test("owner can switch to revisioner", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    const res = await switchRole(request, "revisioner");
    expect(res.status()).toBe(200);
    expect((await res.json()).activeRoleMode).toBe("revisioner");
  });

  test("owner can switch to teacher", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    const res = await switchRole(request, "teacher");
    expect(res.status()).toBe(200);
    expect((await res.json()).activeRoleMode).toBe("teacher");
  });

  test("owner can switch to student", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    const res = await switchRole(request, "student");
    expect(res.status()).toBe(200);
    expect((await res.json()).activeRoleMode).toBe("student");
  });

  test("owner can switch back to own role", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    await switchRole(request, "teacher");
    const res = await switchRole(request, "owner");
    expect(res.status()).toBe(200);
    expect((await res.json()).activeRoleMode).toBe("owner");
  });

  test("session reflects role switch", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    await switchRole(request, "teacher");
    const session = await getSession(request);
    const body = await session.json();
    expect(body.activeRoleMode).toBe("teacher");
    expect(body.user.baseRole).toBe("owner");
  });

  test("administrator can switch to teacher", async ({ request }) => {
    await login(request, "admin@sylaslova.com", "admin123");
    const res = await switchRole(request, "teacher");
    expect(res.status()).toBe(200);
    expect((await res.json()).activeRoleMode).toBe("teacher");
  });

  test("administrator can switch to student", async ({ request }) => {
    await login(request, "admin@sylaslova.com", "admin123");
    const res = await switchRole(request, "student");
    expect(res.status()).toBe(200);
  });

  test("administrator CANNOT switch to owner — 403", async ({ request }) => {
    await login(request, "admin@sylaslova.com", "admin123");
    const res = await switchRole(request, "owner");
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toContain("Cannot switch");
  });

  test("revisioner can switch to teacher", async ({ request }) => {
    await login(request, "revisioner@sylaslova.com", "rev123");
    const res = await switchRole(request, "teacher");
    expect(res.status()).toBe(200);
  });

  test("revisioner CANNOT switch to administrator — 403", async ({ request }) => {
    await login(request, "revisioner@sylaslova.com", "rev123");
    const res = await switchRole(request, "administrator");
    expect(res.status()).toBe(403);
  });

  test("teacher can switch to student", async ({ request }) => {
    await login(request, "teacher1@sylaslova.com", "teach123");
    const res = await switchRole(request, "student");
    expect(res.status()).toBe(200);
  });

  test("teacher CANNOT switch to revisioner — 403", async ({ request }) => {
    await login(request, "teacher1@sylaslova.com", "teach123");
    const res = await switchRole(request, "revisioner");
    expect(res.status()).toBe(403);
  });

  test("teacher CANNOT switch to owner — 403", async ({ request }) => {
    await login(request, "teacher1@sylaslova.com", "teach123");
    const res = await switchRole(request, "owner");
    expect(res.status()).toBe(403);
  });

  test("student CANNOT switch to any role — 403", async ({ request }) => {
    await login(request, "student1@sylaslova.com", "stud123");
    const res = await switchRole(request, "teacher");
    expect(res.status()).toBe(403);
  });

  test("invalid role returns 400", async ({ request }) => {
    await login(request, "owner@sylaslova.com", "owner123");
    const res = await switchRole(request, "superadmin");
    expect(res.status()).toBe(400);
  });

  test("switch-role without login returns 401", async ({ request }) => {
    const res = await switchRole(request, "teacher");
    expect(res.status()).toBe(401);
  });
});

// ═══════════ Health ═══════════

test.describe("Health Check", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  });
});
