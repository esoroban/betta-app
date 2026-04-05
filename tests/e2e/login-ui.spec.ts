import { test, expect } from "@playwright/test";

test.describe("Login UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("login page shows form with email, password, submit", async ({ page }) => {
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toHaveText("Login");
  });

  test("title shows SylaSlova Beta", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("SylaSlova Beta");
  });

  test("password toggle shows/hides password", async ({ page }) => {
    const input = page.locator('[data-testid="login-password"]');
    const toggle = page.locator('[data-testid="login-password-toggle"]');
    await expect(input).toHaveAttribute("type", "password");
    await toggle.click();
    await expect(input).toHaveAttribute("type", "text");
    await toggle.click();
    await expect(input).toHaveAttribute("type", "password");
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    await page.locator('[data-testid="login-email"]').fill("owner@sylaslova.com");
    await page.locator('[data-testid="login-password"]').fill("owner123");
    await page.locator('[data-testid="login-submit"]').click();
    await page.waitForURL("**/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("wrong password shows error", async ({ page }) => {
    await page.locator('[data-testid="login-email"]').fill("owner@sylaslova.com");
    await page.locator('[data-testid="login-password"]').fill("wrongpass");
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-error"]')).toContainText("Invalid");
  });

  test("root path redirects to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("dashboard redirects to login without session", async ({ page }) => {
    await page.goto("/dashboard");
    // Client-side redirect — wait for it
    await page.waitForURL("**/login", { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("login then logout then dashboard redirects to login", async ({ page }) => {
    // Login
    await page.locator('[data-testid="login-email"]').fill("admin@sylaslova.com");
    await page.locator('[data-testid="login-password"]').fill("admin123");
    await page.locator('[data-testid="login-submit"]').click();
    await page.waitForURL("**/dashboard");

    // Wait for dashboard to fully render
    await page.locator('[data-testid="logout-btn"]').waitFor({ timeout: 10000 });

    // Logout
    await page.locator('[data-testid="logout-btn"]').click();
    await page.waitForURL("**/login", { timeout: 10000 });

    // Try dashboard again — should redirect back to login
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
