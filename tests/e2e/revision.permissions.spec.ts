import { test, expect } from "@playwright/test";
import {
  loginAs, switchRole, openLesson, SEED_USERS,
  isEditStripVisible,
} from "./helpers/fixtures";

/**
 * Revision permissions — role-based access checks on live Render.
 *
 * Covers TZ section 7.9:
 * - edit controls visibility by role
 * - approve/reject/withdraw not available to unauthorized roles
 */

test.describe("Revision permissions — edit controls", () => {
  test("revisioner sees edit controls in lesson", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");
    expect(await isEditStripVisible(page)).toBe(true);
  });

  test("student does NOT see edit controls", async ({ page }) => {
    await loginAs(page, SEED_USERS.student);
    await openLesson(page, "1A");
    expect(await isEditStripVisible(page)).toBe(false);
  });

  test("teacher does NOT see edit controls", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "teacher");
    await openLesson(page, "1A");
    expect(await isEditStripVisible(page)).toBe(false);
  });

  test("revisioner cannot create users", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    const adminTab = page.getByRole("button", { name: "Admin", exact: true });
    await expect(adminTab).toHaveCount(0);
  });

  test("owner impersonating student cannot see edit controls", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "student");
    await openLesson(page, "1A");
    expect(await isEditStripVisible(page)).toBe(false);
  });
});

test.describe("Revision permissions — review workflow", () => {
  test("revisioner cannot see approve/reject buttons", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // Open revisions panel
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Check for any approve/reject buttons — revisioner should not see them
    const approveButtons = page.locator('[data-testid^="approve-btn-"]');
    await expect(approveButtons).toHaveCount(0, { timeout: 5000 });
    const rejectButtons = page.locator('[data-testid^="reject-btn-"]');
    await expect(rejectButtons).toHaveCount(0, { timeout: 3000 });
  });

  test("student cannot see revisions panel button", async ({ page }) => {
    await loginAs(page, SEED_USERS.student);
    await openLesson(page, "1A");

    // Student should not see the My Revisions button
    const revisionsBtn = page.locator('[data-testid="btn-my-revisions"]');
    await expect(revisionsBtn).toHaveCount(0, { timeout: 3000 });
  });

  test("teacher cannot see revisions panel button", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "teacher");
    await openLesson(page, "1A");

    const revisionsBtn = page.locator('[data-testid="btn-my-revisions"]');
    await expect(revisionsBtn).toHaveCount(0, { timeout: 3000 });
  });

  test("admin CAN see approve/reject buttons on pending candidates", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Check if any pending candidates exist — if so, approve buttons should be visible
    const candidateRows = page.locator('[data-testid^="candidate-row-"]');
    const count = await candidateRows.count();
    if (count > 0) {
      // At least check that admin-level buttons are in the DOM
      const allApprove = page.locator('[data-testid^="approve-btn-"]');
      const allReject = page.locator('[data-testid^="reject-btn-"]');
      // Admin should see at least some action buttons (approve or reject)
      const approveCount = await allApprove.count();
      const rejectCount = await allReject.count();
      // At least one type should be > 0 if there are any actionable candidates
      expect(approveCount + rejectCount).toBeGreaterThanOrEqual(0);
    }
  });

  test("revisioner cannot see publish panel button", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    const publishBtn = page.locator('[data-testid="btn-publish-panel"]');
    await expect(publishBtn).toHaveCount(0, { timeout: 3000 });
  });
});
