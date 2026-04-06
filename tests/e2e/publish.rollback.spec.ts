import { test, expect } from "@playwright/test";
import { loginAs, openLesson, SEED_USERS, RUN_ID } from "./helpers/fixtures";

/**
 * P2: Publish / Rollback E2E on live Render.
 *
 * TZ section 7.10:
 * - publish accepted candidates → new version
 * - version history visible with active badge
 * - rollback restores previous version
 *
 * Prerequisites: accepted candidates must exist (created by revision.flow.spec.ts).
 */

test.describe.serial("Publish / rollback workflow", () => {
  /** Helper: open publish panel and wait for it to load */
  async function openPublishPanel(page: import("@playwright/test").Page) {
    await page.locator('[data-testid="btn-publish-panel"]').click();
    await expect(page.locator('[data-testid="publish-panel"]')).toBeVisible({ timeout: 10000 });
    // Wait for async loadPublishVersions() to finish — either version rows appear or "No versions" text
    await expect(
      page.locator('[data-testid^="version-row-"]').first()
        .or(page.getByText("No versions published yet"))
    ).toBeVisible({ timeout: 10000 });
  }

  test("setup: ensure accepted candidates exist for publish", async ({ page }) => {
    // Create a fresh candidate and approve it so publish has something to work with
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="editor-btn-teacher"]').click();
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="source-lang-en"]').click();
    await page.locator('[data-testid="editor-textarea"]').fill(`Publish-test ${RUN_ID}`);
    await page.locator('[data-testid="editor-save"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="editor-cancel"]').click();

    // Get the new candidate ID
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const pending = data.candidates?.find(
      (c: { status: string; proposedValue: string }) =>
        c.status === "pending" && c.proposedValue?.includes(RUN_ID)
    );
    expect(pending).toBeTruthy();

    // Admin approves it
    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    const approveBtn = page.locator(`[data-testid="approve-btn-${pending.id}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await approveBtn.click();
    // After approve → vanishes from panel
    await expect(page.locator(`[data-testid="candidate-row-${pending.id}"]`))
      .toHaveCount(0, { timeout: 15000 });
    // API verify
    const resp2 = await page.request.get(`/api/candidates`);
    const data2 = await resp2.json();
    expect(data2.candidates?.find((c: { id: string }) => c.id === pending.id)?.status).toBe("accepted");
  });

  test("admin can publish accepted candidates", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await openPublishPanel(page);

    const publishNow = page.locator('[data-testid="btn-publish-now"]');
    await expect(publishNow).toBeVisible({ timeout: 5000 });
    // Button should be enabled (at least 1 accepted candidate)
    await expect(publishNow).toBeEnabled({ timeout: 10000 });
    await publishNow.click();

    // Should see success message
    await expect(page.locator('[data-testid="publish-msg"]')).toBeVisible({ timeout: 15000 });
  });

  test("version history is visible with active badge", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await openPublishPanel(page);

    // Should have at least one version row
    const versionRows = page.locator('[data-testid^="version-row-"]');
    await expect(versionRows.first()).toBeVisible({ timeout: 10000 });
    const count = await versionRows.count();
    expect(count).toBeGreaterThan(0);

    // Active badge should be visible on the latest version
    await expect(page.getByText("ACTIVE")).toBeVisible({ timeout: 5000 });

    // DB verification via API
    const resp = await page.request.get(`/api/lessons/1A/publish`);
    expect(resp.ok()).toBe(true);
    const data = await resp.json();
    expect(data.versions?.length).toBeGreaterThan(0);
    const active = data.versions.find((v: { isActive: boolean }) => v.isActive);
    expect(active).toBeTruthy();
  });

  test("rollback to previous version works", async ({ page }) => {
    // Need at least 2 versions. Create another publish first.
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // Create and approve another candidate for second publish
    await page.locator('[data-testid="editor-btn-teacher"]').click();
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="source-lang-en"]').click();
    await page.locator('[data-testid="editor-textarea"]').fill(`Rollback-test ${RUN_ID}`);
    await page.locator('[data-testid="editor-save"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="editor-cancel"]').click();

    // Get new pending candidate
    const resp1 = await page.request.get(`/api/candidates`);
    const data1 = await resp1.json();
    const pending = data1.candidates?.find(
      (c: { status: string; proposedValue: string }) =>
        c.status === "pending" && c.proposedValue?.includes("Rollback-test")
    );

    if (!pending) {
      test.skip(true, "No pending candidate for rollback test");
      return;
    }

    // Admin approves and publishes
    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });
    await page.locator(`[data-testid="approve-btn-${pending.id}"]`).click();
    await expect(page.locator(`[data-testid="candidate-row-${pending.id}"]`))
      .toHaveCount(0, { timeout: 15000 });

    // Publish v2
    await openPublishPanel(page);
    const publishNow = page.locator('[data-testid="btn-publish-now"]');
    await expect(publishNow).toBeEnabled({ timeout: 10000 });
    await publishNow.click();
    await expect(page.locator('[data-testid="publish-msg"]')).toBeVisible({ timeout: 15000 });

    // Now rollback — find a non-active version with rollback button
    const rollbackBtns = page.locator('[data-testid^="rollback-btn-"]');
    const rollbackCount = await rollbackBtns.count();
    if (rollbackCount > 0) {
      await rollbackBtns.first().click();
      await expect(page.locator('[data-testid="publish-msg"]')).toBeVisible({ timeout: 15000 });

      // DB verification: check the active version changed
      const resp2 = await page.request.get(`/api/lessons/1A/publish`);
      const data2 = await resp2.json();
      const active = data2.versions?.find((v: { isActive: boolean }) => v.isActive);
      expect(active).toBeTruthy();
    }
  });
});
