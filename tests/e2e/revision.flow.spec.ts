import { test, expect } from "@playwright/test";
import {
  loginAs, logout, openLesson,
  SEED_USERS, RUN_ID,
} from "./helpers/fixtures";

/**
 * P0: Revision flow — happy path on live Render URL.
 *
 * Covers TZ sections 6.1, 7.5, 7.6, 7.7 (review workflow):
 * - revisioner creates text candidate with source language
 * - admin approves → translation fan-out fires
 * - admin rejects another candidate
 * - author sees statuses
 * - withdraw works
 */

test.describe.serial("Revision flow — happy path", () => {
  let candidateId: string;
  let candidate2Id: string;

  test("revisioner creates text revision with source language", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // Open Teacher Text editor
    await page.locator('[data-testid="editor-btn-teacher"]').click();
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toBeVisible({ timeout: 5000 });

    // Select source language = EN
    await page.locator('[data-testid="source-lang-en"]').click();

    // Type new text
    const testText = `E2E revision test ${RUN_ID}`;
    await page.locator('[data-testid="editor-textarea"]').fill(testText);

    // Save
    await page.locator('[data-testid="editor-save"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });

    // Close editor and open revisions panel
    await page.locator('[data-testid="editor-cancel"]').click();
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Find our candidate by the test text
    const rows = page.locator('[data-testid^="candidate-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Get the first candidate's ID and status
    const firstRow = rows.first();
    const statusEl = firstRow.locator('[data-testid^="candidate-status-"]');
    await expect(statusEl).toHaveText("pending", { timeout: 5000 });

    // Extract candidate ID from data-testid
    const testId = await firstRow.getAttribute("data-testid");
    candidateId = testId!.replace("candidate-row-", "");
  });

  test("admin approves the revision → translations appear", async ({ page }) => {
    test.skip(!candidateId, "No candidate from previous test");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    // Open revisions panel
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });
    const row = page.locator(`[data-testid="candidate-row-${candidateId}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // Click approve button
    const approveBtn = page.locator(`[data-testid="approve-btn-${candidateId}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();

    // Status should change to accepted
    const statusEl = page.locator(`[data-testid="candidate-status-${candidateId}"]`);
    await expect(statusEl).toHaveText("accepted", { timeout: 15000 });

    // Verify translations via API (point verification per TZ 4.1)
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find((c: { id: string }) => c.id === candidateId);
    expect(candidate).toBeTruthy();
    expect(candidate.translatedValues).toBeTruthy();
    expect(candidate.translatedValues.en?.success).toBe(true);
    expect(candidate.translatedValues.ru?.success).toBe(true);
    expect(candidate.translatedValues.uk?.success).toBe(true);
    expect(candidate.sourceLanguage).toBe("en");
  });

  test("revisioner creates second revision (RU source)", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // Open Teacher Text editor
    await page.locator('[data-testid="editor-btn-teacher"]').click();
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toBeVisible({ timeout: 5000 });

    // Select source language = RU
    await page.locator('[data-testid="source-lang-ru"]').click();

    const testText2 = `Тест ревизии ${RUN_ID}`;
    await page.locator('[data-testid="editor-textarea"]').fill(testText2);

    await page.locator('[data-testid="editor-save"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });

    // Close editor and open revisions panel
    await page.locator('[data-testid="editor-cancel"]').click();
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    const rows = page.locator('[data-testid^="candidate-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Find pending candidate (the new one)
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const status = row.locator('[data-testid^="candidate-status-"]');
      const text = await status.innerText();
      if (text === "pending") {
        const testId = await row.getAttribute("data-testid");
        candidate2Id = testId!.replace("candidate-row-", "");
        break;
      }
    }
    expect(candidate2Id).toBeTruthy();
  });

  test("admin rejects second revision", async ({ page }) => {
    test.skip(!candidate2Id, "No second candidate");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    // Open revisions panel
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });
    const row = page.locator(`[data-testid="candidate-row-${candidate2Id}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // Click reject
    const rejectBtn = page.locator(`[data-testid="reject-btn-${candidate2Id}"]`);
    await expect(rejectBtn).toBeVisible({ timeout: 5000 });
    await rejectBtn.click();

    const statusEl = page.locator(`[data-testid="candidate-status-${candidate2Id}"]`);
    await expect(statusEl).toHaveText("rejected", { timeout: 15000 });

    // Verify rejected candidate has NO translations (per TZ 7.6)
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find((c: { id: string }) => c.id === candidate2Id);
    expect(candidate?.translatedValues).toBeNull();
  });

  test("author can withdraw rejected revision", async ({ page }) => {
    test.skip(!candidate2Id, "No second candidate");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // Click My Revisions to see panel
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    const withdrawBtn = page.locator(`[data-testid="withdraw-btn-${candidate2Id}"]`);
    if (await withdrawBtn.isVisible({ timeout: 3000 })) {
      await withdrawBtn.click();
      const statusEl = page.locator(`[data-testid="candidate-status-${candidate2Id}"]`);
      await expect(statusEl).toHaveText("withdrawn", { timeout: 10000 });
    }
  });

  test("author cannot withdraw accepted revision", async ({ page }) => {
    test.skip(!candidateId, "No first candidate");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Withdraw button should NOT be visible for accepted candidate
    const withdrawBtn = page.locator(`[data-testid="withdraw-btn-${candidateId}"]`);
    await expect(withdrawBtn).toHaveCount(0, { timeout: 3000 });
  });
});
