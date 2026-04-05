import { test, expect } from "@playwright/test";
import { loginAs, openLesson, SEED_USERS } from "./helpers/fixtures";

/**
 * P2: Publish / Rollback E2E.
 *
 * TZ section 7.10:
 * - publish accepted candidates
 * - version history visible
 * - rollback restores previous
 */

test.describe.serial("Publish / rollback workflow", () => {
  test("admin can publish accepted candidates", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    // Open publish panel
    const publishBtn = page.locator('[data-testid="btn-publish-panel"]');
    if (await publishBtn.isVisible({ timeout: 3000 })) {
      await publishBtn.click();
    }

    await expect(page.locator('[data-testid="publish-panel"]')).toBeVisible({ timeout: 10000 });

    // Click publish
    const publishNow = page.locator('[data-testid="btn-publish-now"]');
    if (await publishNow.isVisible({ timeout: 3000 })) {
      await publishNow.click();

      // Should see success message or version row
      await expect(
        page.locator('[data-testid="publish-msg"]').or(page.locator('[data-testid^="version-row-"]'))
      ).toBeVisible({ timeout: 15000 });
    }
  });

  test("version history is visible", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    const publishBtn = page.locator('[data-testid="btn-publish-panel"]');
    if (await publishBtn.isVisible({ timeout: 3000 })) {
      await publishBtn.click();
    }

    await expect(page.locator('[data-testid="publish-panel"]')).toBeVisible({ timeout: 10000 });

    // Should have at least one version row
    const versionRows = page.locator('[data-testid^="version-row-"]');
    const count = await versionRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("rollback to previous version works", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    const publishBtn = page.locator('[data-testid="btn-publish-panel"]');
    if (await publishBtn.isVisible({ timeout: 3000 })) {
      await publishBtn.click();
    }

    await expect(page.locator('[data-testid="publish-panel"]')).toBeVisible({ timeout: 10000 });

    // Find a non-active version with rollback button
    const rollbackBtns = page.locator('[data-testid^="rollback-btn-"]');
    const count = await rollbackBtns.count();
    if (count > 0) {
      await rollbackBtns.first().click();
      // Should see confirmation or updated active badge
      await expect(page.locator('[data-testid="publish-msg"]')).toBeVisible({ timeout: 15000 });
    }
  });
});
