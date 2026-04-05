import { test, expect } from "@playwright/test";
import { loginAs, logout, switchRole, getCurrentRole, SEED_USERS } from "./helpers/fixtures";

test.describe("Role switch browser flows", () => {
  test("owner can switch to administrator", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "administrator");
    expect(await getCurrentRole(page)).toBe("administrator");
  });

  test("owner can switch to revisioner", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "revisioner");
    expect(await getCurrentRole(page)).toBe("revisioner");
  });

  test("owner can switch to teacher", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "teacher");
    expect(await getCurrentRole(page)).toBe("teacher");
  });

  test("owner can switch to student", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "student");
    expect(await getCurrentRole(page)).toBe("student");
  });

  test("owner can return to base role via return button", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "teacher");

    await test.step("Impersonation banner visible", async () => {
      await expect(page.locator('[data-testid="role-banner"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-banner"]')).toContainText("teacher");
    });

    await test.step("Return to base role via banner button", async () => {
      // Use the impersonation banner button (more reliable than dropdown's return)
      const bannerBtn = page.locator('[data-testid="role-banner"] button');
      await expect(bannerBtn).toBeVisible({ timeout: 5_000 });
      await bannerBtn.click();
      // Wait for banner to disappear — means role switch completed
      await expect(page.locator('[data-testid="role-banner"]')).toHaveCount(0, { timeout: 5_000 });
      expect(await getCurrentRole(page)).toBe("owner");
    });
  });

  test("administrator can switch to revisioner then to teacher", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);

    await switchRole(page, "revisioner");
    expect(await getCurrentRole(page)).toBe("revisioner");

    await switchRole(page, "teacher");
    expect(await getCurrentRole(page)).toBe("teacher");
  });

  test("administrator can return to base role from impersonation", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await switchRole(page, "teacher");
    expect(await getCurrentRole(page)).toBe("teacher");

    // Return via banner button
    const bannerBtn = page.locator('[data-testid="role-banner"] button');
    await expect(bannerBtn).toBeVisible({ timeout: 5_000 });
    await bannerBtn.click();
    await expect(page.locator('[data-testid="role-banner"]')).toHaveCount(0, { timeout: 5_000 });
    expect(await getCurrentRole(page)).toBe("administrator");
  });

  test("administrator cannot switch to owner — option not in dropdown", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await page.locator('[data-testid="role-switch"]').click();

    // owner option should not exist
    const ownerOption = page.locator('[data-testid="role-option-owner"]');
    await expect(ownerOption).toHaveCount(0);
  });

  test("revisioner can switch down but not up", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await page.locator('[data-testid="role-switch"]').click();

    // Should have teacher, student
    await expect(page.locator('[data-testid="role-option-teacher"]')).toBeVisible();
    await expect(page.locator('[data-testid="role-option-student"]')).toBeVisible();

    // Should NOT have administrator, owner
    await expect(page.locator('[data-testid="role-option-administrator"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="role-option-owner"]')).toHaveCount(0);
  });

  test("impersonation UI is shown when role differs from base", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);

    await test.step("No banner at base role", async () => {
      await expect(page.locator('[data-testid="role-banner"]')).toHaveCount(0);
    });

    await test.step("Switch to revisioner — banner appears", async () => {
      await switchRole(page, "revisioner");
      await expect(page.locator('[data-testid="role-banner"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-banner"]')).toContainText("revisioner");
    });
  });

  test("active role mode persists after refresh", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "teacher");
    expect(await getCurrentRole(page)).toBe("teacher");

    await page.reload();
    await page.locator('[data-testid="role-switch"]').waitFor({ timeout: 10_000 });
    expect(await getCurrentRole(page)).toBe("teacher");
  });

  test("student has no role switch options (only student in dropdown)", async ({ page }) => {
    await loginAs(page, SEED_USERS.student);
    await page.locator('[data-testid="role-switch"]').click();

    // Only student option should exist
    await expect(page.locator('[data-testid="role-option-student"]')).toBeVisible();
    const allOptions = await page.locator('[data-testid^="role-option-"]').count();
    expect(allOptions).toBe(1);
  });
});
