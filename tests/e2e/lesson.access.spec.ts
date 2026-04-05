import { test, expect } from "@playwright/test";
import {
  loginAs, switchRole, openLesson, SEED_USERS,
  stepInfoLocator, nextButton, backButton, backToDashboardButton,
  editActionButtons, isEditStripVisible, langButton,
} from "./helpers/fixtures";

test.describe("Lesson access and navigation", () => {
  test("revisioner sees lesson list with 25 cards", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);

    await test.step("Lesson cards are visible", async () => {
      await page.locator('[data-testid="lesson-card-1A"]').waitFor({ timeout: 15_000 });
      const cards = await page.locator('[data-testid^="lesson-card-"]').count();
      expect(cards).toBe(25);
    });
  });

  test("lesson card opens lesson detail", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await test.step("Lesson detail shows lesson ID in header", async () => {
      // Lesson ID appears as a span in the header
      await expect(page.locator("header")).toContainText("1A");
    });

    await test.step("Step info is visible", async () => {
      await expect(stepInfoLocator(page)).toBeVisible();
    });

    await test.step("Navigation controls are visible", async () => {
      await expect(nextButton(page)).toBeVisible();
      await expect(backButton(page)).toBeVisible();
    });
  });

  test("lesson detail renders fully without error", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // All key UI elements rendered — header with lesson ID, step info, controls
    await expect(page.locator("header")).toContainText("1A");
    await expect(stepInfoLocator(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reveal" })).toBeVisible();
  });

  test("steps navigate forward and backward within a scene", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await test.step("Read initial step info", async () => {
      await expect(stepInfoLocator(page)).toContainText("Step 1/");
    });

    await test.step("Click Next — step counter advances", async () => {
      await nextButton(page).click();
      await expect(stepInfoLocator(page)).toContainText("Step 2/");
    });

    await test.step("Click Back — step counter returns", async () => {
      await backButton(page).click();
      await expect(stepInfoLocator(page)).toContainText("Step 1/");
    });
  });

  test("scene navigation via hamburger menu", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await test.step("Open scene drawer", async () => {
      // Hamburger is the second button in header (after ← back), has no text
      const hamburger = page.locator("header button").nth(1);
      await hamburger.click();
      // Scene drawer appears — look for "Scenes" heading
      await expect(page.getByText("Scenes")).toBeVisible({ timeout: 3_000 });
    });

    await test.step("Click a different scene", async () => {
      // Scene rows have text with step counts like "N steps · scN"
      const sceneButtons = page.getByText(/steps · sc/);
      const count = await sceneButtons.count();
      expect(count).toBeGreaterThan(1);

      // Click the second scene
      await sceneButtons.nth(1).click();

      // Wait for step info to show Scene 2
      await expect(stepInfoLocator(page)).toContainText("Scene 2/");
    });
  });

  test("cross-scene navigation — Next transitions to next scene at scene end", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // Click Next until we see "Next Scene →"
    for (let i = 0; i < 30; i++) {
      const btn = nextButton(page);
      if (await btn.isDisabled()) break;

      const btnText = await btn.innerText();
      if (btnText.includes("Next Scene")) {
        await test.step("Click Next Scene button", async () => {
          await btn.click();
          await expect(stepInfoLocator(page)).toContainText("Scene 2/");
          await expect(stepInfoLocator(page)).toContainText("Step 1/");
        });
        return;
      }
      await btn.click();
      // Wait for step counter to change
      await expect(stepInfoLocator(page)).toContainText(`Step ${i + 2}/`);
    }
    // If only 1 scene, just verify we're still on the page
    await expect(stepInfoLocator(page)).toContainText("Scene");
  });

  test("language switch does not break lesson view", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await test.step("Switch to Russian", async () => {
      await langButton(page, "RU").click();
      // Step info should still be visible (page not crashed)
      await expect(stepInfoLocator(page)).toBeVisible();
    });

    await test.step("Switch to Ukrainian", async () => {
      await langButton(page, "UK").click();
      await expect(stepInfoLocator(page)).toBeVisible();
    });

    await test.step("Switch back to English", async () => {
      await langButton(page, "EN").click();
      await expect(stepInfoLocator(page)).toBeVisible();
    });
  });

  test("revisioner sees edit controls (action strip)", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    const btns = editActionButtons(page);
    await expect(btns.teacherText).toBeVisible();
    await expect(btns.image).toBeVisible();
    await expect(btns.poll).toBeVisible();
    await expect(btns.overlay).toBeVisible();
    await expect(btns.brief).toBeVisible();
  });

  test("student does NOT see edit controls", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "student");
    await openLesson(page, "1A");

    expect(await isEditStripVisible(page)).toBe(false);
  });

  test("teacher does NOT see edit controls", async ({ page }) => {
    await loginAs(page, SEED_USERS.owner);
    await switchRole(page, "teacher");
    await openLesson(page, "1A");

    expect(await isEditStripVisible(page)).toBe(false);
  });

  test("administrator sees edit controls", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    expect(await isEditStripVisible(page)).toBe(true);
  });

  test("editor drawer opens and closes", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await test.step("Open teacher text editor", async () => {
      await page.getByRole("button", { name: "Teacher Text", exact: true }).click();
      // Editor drawer shows heading "Edit Teacher Text"
      await expect(page.getByText("Edit Teacher Text")).toBeVisible({ timeout: 3_000 });
    });

    await test.step("Editor has textarea and save/cancel", async () => {
      await expect(page.getByRole("textbox").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    });

    await test.step("Cancel closes editor drawer", async () => {
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByText("Edit Teacher Text")).toHaveCount(0, { timeout: 3_000 });
    });
  });

  test("back button returns to dashboard", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await backToDashboardButton(page).click();
    await page.waitForURL("**/dashboard", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
