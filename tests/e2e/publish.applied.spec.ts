import { test, expect } from "@playwright/test";
import { loginAs, openLesson, SEED_USERS, RUN_ID } from "./helpers/fixtures";

/**
 * Critical gap test: verify that published revisions are actually applied
 * to the lesson read model and visible in UI on reopen.
 *
 * This is NOT about "candidate exists" or "publish version created".
 * This is about: after publish, the lesson shows the approved text.
 */

test.describe.serial("Published revision applied to lesson", () => {
  const UNIQUE_TEXT = `E2E_APPLIED_TEXT_${RUN_ID}`;
  let candidateId: string;

  test("1. revisioner creates text revision with unique text", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // Open teacher text editor
    await page.locator('[data-testid="editor-btn-teacher"]').click();
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toBeVisible({ timeout: 5000 });

    // Set source language to EN
    await page.locator('[data-testid="source-lang-en"]').click();

    // Enter unique text
    await page.locator('[data-testid="editor-textarea"]').fill(UNIQUE_TEXT);
    await page.locator('[data-testid="editor-save"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="editor-cancel"]').click();

    // Get candidate ID from API
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const pending = data.candidates?.find(
      (c: { status: string; proposedValue: string }) =>
        c.status === "pending" && c.proposedValue?.includes(UNIQUE_TEXT)
    );
    expect(pending).toBeTruthy();
    candidateId = pending.id;
  });

  test("2. admin approves the revision", async ({ page }) => {
    test.skip(!candidateId, "No candidate from step 1");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    const approveBtn = page.locator(`[data-testid="approve-btn-${candidateId}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await approveBtn.click();

    // Wait for approval to complete (row vanishes = accepted)
    await expect(page.locator(`[data-testid="candidate-row-${candidateId}"]`))
      .toHaveCount(0, { timeout: 15000 });

    // API verify: status = accepted
    const resp = await page.request.get(`/api/candidates/${candidateId}`);
    const data = await resp.json();
    expect(data.candidate?.status).toBe("accepted");
  });

  test("3. admin publishes the revision", async ({ page }) => {
    test.skip(!candidateId, "No candidate");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    // Open publish panel
    await page.locator('[data-testid="btn-publish-panel"]').click();
    await expect(page.locator('[data-testid="publish-panel"]')).toBeVisible({ timeout: 10000 });

    const publishBtn = page.locator('[data-testid="btn-publish-now"]');
    await expect(publishBtn).toBeEnabled({ timeout: 10000 });
    await publishBtn.click();

    // Wait for publish success
    await expect(page.locator('[data-testid="publish-msg"]')).toBeVisible({ timeout: 15000 });

    // API verify: candidate now has publishVersionId
    const resp = await page.request.get(`/api/candidates/${candidateId}`);
    const data = await resp.json();
    expect(data.candidate?.publishVersionId).toBeTruthy();
  });

  test("4. GET /api/lessons/1A returns the applied text in lesson data", async ({ page }) => {
    test.skip(!candidateId, "No candidate");

    // Fresh session — login and check API directly
    await loginAs(page, SEED_USERS.admin);

    const resp = await page.request.get(`/api/lessons/1A`);
    expect(resp.ok()).toBe(true);
    const data = await resp.json();
    const lesson = data.lesson;

    // The unique text must be somewhere in the lesson steps (prompt or explanation)
    const allText = JSON.stringify(lesson.steps);
    expect(allText).toContain(UNIQUE_TEXT);
  });

  test("5. lesson UI shows applied text on reopen", async ({ page }) => {
    test.skip(!candidateId, "No candidate");

    // Fresh login, reopen lesson
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // The teacher panel or stage should contain the unique text
    // Check full page content
    const pageContent = await page.textContent("body");
    expect(pageContent).toContain(UNIQUE_TEXT);
  });

  test("6. published snapshot contains materialized lessonData", async ({ page }) => {
    test.skip(!candidateId, "No candidate");

    await loginAs(page, SEED_USERS.admin);

    // Check the active publish version snapshot
    const resp = await page.request.get(`/api/lessons/1A/publish`);
    expect(resp.ok()).toBe(true);
    const data = await resp.json();

    const activeVersion = data.versions?.find((v: { isActive: boolean }) => v.isActive);
    expect(activeVersion).toBeTruthy();

    // snapshot.lessonData must contain the applied text (not just appliedChanges)
    const snapshotStr = JSON.stringify(activeVersion.snapshot?.lessonData);
    expect(snapshotStr).toContain(UNIQUE_TEXT);

    // Also verify appliedChanges exist as audit metadata
    expect(activeVersion.snapshot?.appliedChanges?.length).toBeGreaterThan(0);
  });

  test("7. translated values are applied to lesson languages", async ({ page }) => {
    test.skip(!candidateId, "No candidate");

    await loginAs(page, SEED_USERS.admin);

    // Check candidate has translations
    const candResp = await page.request.get(`/api/candidates/${candidateId}`);
    const candData = await candResp.json();
    const translatedValues = candData.candidate?.translatedValues;

    // If translations exist, they must be in the lesson read model too
    if (translatedValues?.ru?.success && translatedValues?.ru?.text) {
      const lessonResp = await page.request.get(`/api/lessons/1A`);
      const lessonData = await lessonResp.json();
      const allText = JSON.stringify(lessonData.lesson.steps);

      // The Russian translation should be in the lesson data
      expect(allText).toContain(translatedValues.ru.text);
    }

    if (translatedValues?.uk?.success && translatedValues?.uk?.text) {
      const lessonResp = await page.request.get(`/api/lessons/1A`);
      const lessonData = await lessonResp.json();
      const allText = JSON.stringify(lessonData.lesson.steps);

      expect(allText).toContain(translatedValues.uk.text);
    }
  });
});
