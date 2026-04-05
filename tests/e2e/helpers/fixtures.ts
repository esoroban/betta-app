import { Page, expect } from "@playwright/test";

// ═══════════ Test data isolation ═══════════

const RUN_ID = `t${Date.now().toString(36)}`;

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${RUN_ID}@example.test`;
}

export function uniqueName(prefix: string): string {
  return `${prefix}-${RUN_ID}`;
}

export { RUN_ID };

// ═══════════ Seed accounts ═══════════

export const SEED_USERS = {
  owner: { email: "owner@sylaslova.com", password: "owner123" },
  admin: { email: "admin@sylaslova.com", password: "admin123" },
  revisioner: { email: "revisioner@sylaslova.com", password: "rev123" },
  teacher: { email: "teacher1@sylaslova.com", password: "teach123" },
  student: { email: "student1@sylaslova.com", password: "stud123" },
} as const;

// ═══════════ Auth helpers ═══════════

export async function loginAs(
  page: Page,
  user: { email: string; password: string }
) {
  await page.goto("/login");
  await page.locator('[data-testid="login-email"]').fill(user.email);
  await page.locator('[data-testid="login-password"]').fill(user.password);
  await page.locator('[data-testid="login-submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function logout(page: Page) {
  await page.locator('[data-testid="logout-btn"]').waitFor({ timeout: 10_000 });
  await page.locator('[data-testid="logout-btn"]').click();
  await page.waitForURL("**/login", { timeout: 10_000 });
}

// ═══════════ Role helpers ═══════════

export async function switchRole(page: Page, role: string) {
  await page.locator('[data-testid="role-switch"]').click();
  // Wait for dropdown to appear
  await expect(page.locator(`[data-testid="role-option-${role}"]`)).toBeVisible({ timeout: 5_000 });
  await page.locator(`[data-testid="role-option-${role}"]`).click();
  // Wait for dropdown to close (options disappear) — this means the switch completed
  await expect(page.locator(`[data-testid="role-option-${role}"]`)).toHaveCount(0, { timeout: 5_000 });
  // Verify the active role actually changed by reading the chip text
  const actualRole = await getCurrentRole(page);
  if (actualRole !== role) {
    throw new Error(`switchRole: expected active role "${role}" but got "${actualRole}"`);
  }
}

export async function returnToBaseRole(page: Page) {
  const returnBtn = page.locator('[data-testid="role-return"]');
  if (await returnBtn.isVisible()) {
    await returnBtn.click();
    // Wait for impersonation banner to disappear
    await expect(page.locator('[data-testid="role-banner"]')).toHaveCount(0, { timeout: 5_000 });
  }
}

export async function getCurrentRole(page: Page): Promise<string> {
  const chip = page.locator('[data-testid="role-switch"]');
  const text = await chip.innerText();
  // The chip shows "baseRole → activeRole" or just "activeRole"
  const parts = text.split("→");
  return parts[parts.length - 1].replace("▾", "").trim();
}

// ═══════════ User management helpers ═══════════

export async function createUserViaAdmin(
  page: Page,
  user: { email: string; password: string; displayName: string; role: string }
) {
  // Navigate to Admin tab
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await expect(page.getByText("Users")).toBeVisible({ timeout: 5_000 });

  // Open create modal
  await page.getByRole("button", { name: "+ Create User" }).click();
  // Wait for modal to appear by checking for the Email input
  await expect(page.locator('input[placeholder="Email"]')).toBeVisible({ timeout: 5_000 });

  // Fill form
  await page.locator('input[placeholder="Email"]').fill(user.email);
  await page.locator('input[placeholder="Display Name"]').fill(user.displayName);
  await page.locator('input[placeholder="Password"]').fill(user.password);
  await page.locator("select").selectOption(user.role);

  // Submit and wait for new user to appear in the list behind the modal
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText(user.email)).toBeVisible({ timeout: 10_000 });
}

// ═══════════ Lesson helpers ═══════════

export async function openLesson(page: Page, lessonId: string) {
  // Ensure we're on dashboard Lessons tab
  if (!page.url().includes("/dashboard")) {
    await page.goto("/dashboard");
  }
  await page.getByRole("button", { name: "Lessons" }).click();
  // Wait for lesson card to appear — works on both deployed (with testid) and without
  const card = page.locator(`[data-testid="lesson-card-${lessonId}"]`);
  await card.waitFor({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(`**/lessons/${lessonId}`, { timeout: 15_000 });
  // Wait for lesson to render — use step info text pattern (present on all deployed versions)
  await expect(page.getByText(/Step \d+\/\d+/)).toBeVisible({ timeout: 15_000 });
}

// ═══════════ Lesson page selectors (no data-testid required) ═══════════

/** Step info text like "sc1 · Step 1/12 · Scene 1/11" */
export function stepInfoLocator(page: Page) {
  return page.getByText(/sc\d+ · Step \d+\/\d+ · Scene \d+\/\d+/);
}

/** The "Next →" or "Next Scene →" button */
export function nextButton(page: Page) {
  return page.getByRole("button", { name: /Next/ });
}

/** The "← Back" button */
export function backButton(page: Page) {
  return page.getByRole("button", { name: "← Back" });
}

/** The "←" button that goes back to dashboard (first button in header) */
export function backToDashboardButton(page: Page) {
  return page.locator("header").getByRole("button", { name: "←", exact: true });
}

/** Edit action buttons — only visible for revisioner/administrator/owner */
export function editActionButtons(page: Page) {
  return {
    image: page.getByRole("button", { name: "Image", exact: true }),
    brief: page.getByRole("button", { name: "Brief", exact: true }),
    poll: page.getByRole("button", { name: "Poll", exact: true }),
    overlay: page.getByRole("button", { name: "Overlay", exact: true }),
    teacherText: page.getByRole("button", { name: "Teacher Text", exact: true }),
  };
}

/** Check if edit action strip is visible (has any editor buttons) */
export async function isEditStripVisible(page: Page): Promise<boolean> {
  const btn = page.getByRole("button", { name: "Teacher Text", exact: true });
  return btn.isVisible();
}

/** Language switch buttons */
export function langButton(page: Page, lang: "EN" | "RU" | "UK") {
  // Use header to avoid matching other elements with same text
  return page.locator("header").getByRole("button", { name: lang, exact: true });
}

// ═══════════ Health check (browser-only) ═══════════

/**
 * Waits for the service to respond by trying to load the login page.
 * No API calls — purely browser navigation.
 * Handles Render cold start by retrying with page reloads.
 */
export async function waitForServiceReady(page: Page, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto("/login", { timeout: 20_000 });
      // If we can see the login form, the service is up
      await expect(page.locator('[data-testid="login-email"]')).toBeVisible({ timeout: 10_000 });
      return;
    } catch {
      // Render cold start — wait and retry
      await page.waitForTimeout(3000);
    }
  }
  throw new Error("Service not ready — login page did not load after retries");
}
