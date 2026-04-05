import { test, expect } from "@playwright/test";
import {
  loginAs, switchRole, openLesson, SEED_USERS,
  isEditStripVisible,
} from "./helpers/fixtures";

/**
 * PARTIALLY BLOCKED: Permission checks on lesson detail use live Render UI selectors.
 * Revision-specific permissions (approve/reject/withdraw) require the candidate API.
 */

const BLOCKED_REASON = "PRODUCT GAP: Revision API not implemented — cannot test approve/reject/withdraw permissions";

test.describe("Revision permissions — currently testable", () => {
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

test.describe("Revision permissions — review workflow (BLOCKED)", () => {
  test.skip(true, BLOCKED_REASON);

  test("revisioner cannot approve/reject revisions", async ({ page }) => {});
  test("teacher/student cannot see review workspace", async ({ page }) => {});
  test("author cannot withdraw another revisioner's revision", async ({ page }) => {});
  test("administrator cannot withdraw on behalf of author", async ({ page }) => {});
  test("direct URL to review page blocked for non-admin roles", async ({ page }) => {});
});
