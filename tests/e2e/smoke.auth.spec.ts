import { test, expect } from "@playwright/test";
import { loginAs, logout, SEED_USERS, waitForServiceReady } from "./helpers/fixtures";

test.describe("Smoke: Auth browser flows", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await waitForServiceReady(page);
    await page.close();
  });

  test("owner can login via browser and sees dashboard", async ({ page }) => {
    await test.step("Fill login form", async () => {
      await page.goto("/login");
      await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
      await page.locator('[data-testid="login-email"]').fill(SEED_USERS.owner.email);
      await page.locator('[data-testid="login-password"]').fill(SEED_USERS.owner.password);
    });

    await test.step("Submit and verify redirect to dashboard", async () => {
      await page.locator('[data-testid="login-submit"]').click();
      await page.waitForURL("**/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);
    });

    await test.step("Dashboard shows user info and lessons", async () => {
      await expect(page.locator('[data-testid="logout-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-switch"]')).toBeVisible();
    });
  });

  test("administrator can login via browser", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await expect(page.locator('[data-testid="role-switch"]')).toContainText("administrator");
  });

  test("revisioner can login via browser", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await expect(page.locator('[data-testid="role-switch"]')).toContainText("revisioner");
  });

  test("wrong password shows error in browser", async ({ page }) => {
    await page.goto("/login");
    await page.locator('[data-testid="login-email"]').fill(SEED_USERS.owner.email);
    await page.locator('[data-testid="login-password"]').fill("wrongpassword");
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-error"]')).toContainText("Invalid");
  });

  test("logout clears access — dashboard redirects to login", async ({ page }) => {
    await test.step("Login as owner", async () => {
      await loginAs(page, SEED_USERS.owner);
    });

    await test.step("Logout", async () => {
      await logout(page);
      await expect(page).toHaveURL(/\/login/);
    });

    await test.step("Dashboard redirects to login after logout", async () => {
      await page.goto("/dashboard");
      await page.waitForURL("**/login", { timeout: 10_000 });
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test("unauthenticated access to dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to lesson detail redirects to login", async ({ page }) => {
    await page.goto("/lessons/1A");
    await page.waitForURL("**/login", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("session survives page reload", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await page.reload();
    // Wait for dashboard to re-render after reload — verify by UI element presence
    await expect(page.locator('[data-testid="logout-btn"]')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("after login, correct active role mode is shown", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    const roleText = await page.locator('[data-testid="role-switch"]').innerText();
    expect(roleText).toContain("revisioner");
  });

  test("password toggle shows/hides password", async ({ page }) => {
    await page.goto("/login");
    const input = page.locator('[data-testid="login-password"]');
    const toggle = page.locator('[data-testid="login-password-toggle"]');
    await expect(input).toHaveAttribute("type", "password");
    await toggle.click();
    await expect(input).toHaveAttribute("type", "text");
    await toggle.click();
    await expect(input).toHaveAttribute("type", "password");
  });
});
