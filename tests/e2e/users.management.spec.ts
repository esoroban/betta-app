import { test, expect } from "@playwright/test";
import {
  loginAs, logout, SEED_USERS,
  createUserViaAdmin, uniqueEmail, uniqueName, RUN_ID,
} from "./helpers/fixtures";

test.describe("User management via browser UI", () => {
  const newRevisioner = {
    email: uniqueEmail("rev-a"),
    password: "TestPass1!",
    displayName: uniqueName("RevA"),
    role: "revisioner",
  };

  test("owner creates revisioner via Admin panel", async ({ page }) => {
    await test.step("Login as owner", async () => {
      await loginAs(page, SEED_USERS.owner);
    });

    await test.step("Navigate to Admin tab", async () => {
      await page.getByRole("button", { name: "Admin", exact: true }).click();
      await expect(page.getByText("Users")).toBeVisible();
    });

    await test.step("Open create user modal and fill form", async () => {
      await createUserViaAdmin(page, newRevisioner);
    });

    await test.step("New user appears in users list", async () => {
      // The user table should contain the new user's email
      await expect(page.getByText(newRevisioner.email)).toBeVisible({ timeout: 5000 });
    });
  });

  test("newly created revisioner can login immediately", async ({ page }) => {
    // First create the user
    await loginAs(page, SEED_USERS.owner);
    await createUserViaAdmin(page, {
      email: uniqueEmail("rev-login"),
      password: "LoginTest1!",
      displayName: uniqueName("RevLogin"),
      role: "revisioner",
    });
    await logout(page);

    // Now login as the new user
    await test.step("Login as newly created user", async () => {
      await page.goto("/login");
      await page.locator('[data-testid="login-email"]').fill(uniqueEmail("rev-login"));
      await page.locator('[data-testid="login-password"]').fill("LoginTest1!");
      await page.locator('[data-testid="login-submit"]').click();
      await page.waitForURL("**/dashboard", { timeout: 15_000 });
      await expect(page).toHaveURL(/\/dashboard/);
    });

    await test.step("Role shows revisioner", async () => {
      await expect(page.locator('[data-testid="role-switch"]')).toContainText("revisioner");
    });
  });

  test("administrator can create revisioner", async ({ page }) => {
    const user = {
      email: uniqueEmail("rev-by-admin"),
      password: "AdminCreate1!",
      displayName: uniqueName("RevByAdmin"),
      role: "revisioner",
    };

    await loginAs(page, SEED_USERS.admin);
    await createUserViaAdmin(page, user);
    await expect(page.getByText(user.email)).toBeVisible({ timeout: 5000 });
  });

  test("revisioner cannot access Admin tab / create user flow", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);

    // Admin tab should not be visible for revisioner
    const adminTab = page.getByRole("button", { name: "Admin" });
    await expect(adminTab).toHaveCount(0);
  });

  test("duplicate email shows error", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);

    await test.step("Try to create user with existing email", async () => {
      await page.getByRole("button", { name: "Admin", exact: true }).click();
      await expect(page.getByText("Users")).toBeVisible({ timeout: 5_000 });
      await page.getByRole("button", { name: "+ Create User" }).click();
      await expect(page.locator('input[placeholder="Email"]')).toBeVisible({ timeout: 5_000 });

      await page.locator('input[placeholder="Email"]').fill(SEED_USERS.revisioner.email);
      await page.locator('input[placeholder="Display Name"]').fill("Duplicate");
      await page.locator('input[placeholder="Password"]').fill("dup12345");
      await page.locator("select").selectOption("revisioner");
      await page.getByRole("button", { name: "Create", exact: true }).click();
    });

    await test.step("Error message is shown", async () => {
      // Should show an error about duplicate email
      await expect(page.getByText(/already exists|duplicate/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test("cannot create user with higher role than own", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await expect(page.getByText("Users")).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "+ Create User" }).click();
    await expect(page.locator('input[placeholder="Email"]')).toBeVisible({ timeout: 5_000 });

    // The role dropdown should NOT contain "owner" for administrator
    const options = await page.locator("select option").allTextContents();
    expect(options).not.toContain("owner");
    // But should contain revisioner, teacher, student
    expect(options).toContain("revisioner");
    expect(options).toContain("teacher");
    expect(options).toContain("student");
  });
});
