import { test, expect } from "@playwright/test";
import {
  loginAs, logout, openLesson,
  SEED_USERS, RUN_ID,
} from "./helpers/fixtures";

/**
 * P0: Revision flow — happy path on live Render URL.
 *
 * Panel shows pending + rejected (actionable). Accepted/withdrawn hidden.
 */

test.describe.serial("Revision flow — happy path", () => {
  let candidateId: string;
  let candidate2Id: string;

  test("revisioner creates text revision with source language", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="editor-btn-teacher"]').click();
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="source-lang-en"]').click();

    const testText = `E2E revision test ${RUN_ID}`;
    await page.locator('[data-testid="editor-textarea"]').fill(testText);
    await page.locator('[data-testid="editor-save"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="editor-cancel"]').click();
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    const rows = page.locator('[data-testid^="candidate-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const firstRow = rows.first();
    const statusEl = firstRow.locator('[data-testid^="candidate-status-"]');
    await expect(statusEl).toHaveText("pending", { timeout: 5000 });

    const testId = await firstRow.getAttribute("data-testid");
    candidateId = testId!.replace("candidate-row-", "");
  });

  test("admin approves the revision → vanishes from panel, translations in API", async ({ page }) => {
    test.skip(!candidateId, "No candidate from previous test");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });
    const approveBtn = page.locator(`[data-testid="approve-btn-${candidateId}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await approveBtn.click();

    // After approve → row vanishes (accepted = hidden)
    await expect(page.locator(`[data-testid="candidate-row-${candidateId}"]`)).toHaveCount(0, { timeout: 15000 });

    // API verification
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find((c: { id: string }) => c.id === candidateId);
    expect(candidate?.status).toBe("accepted");
    expect(candidate?.translatedValues?.en?.success).toBe(true);
    expect(candidate?.translatedValues?.ru?.success).toBe(true);
    expect(candidate?.translatedValues?.uk?.success).toBe(true);
    expect(candidate?.sourceLanguage).toBe("en");
  });

  test("revisioner creates second revision (RU source)", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="editor-btn-teacher"]').click();
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="source-lang-ru"]').click();

    const testText2 = `Тест ревизии ${RUN_ID}`;
    await page.locator('[data-testid="editor-textarea"]').fill(testText2);
    await page.locator('[data-testid="editor-save"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="editor-cancel"]').click();

    // Get candidate2Id via API
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const pending = data.candidates?.filter(
      (c: { status: string; proposedValue: string }) =>
        c.status === "pending" && c.proposedValue?.includes(RUN_ID)
    );
    expect(pending?.length).toBeGreaterThan(0);
    candidate2Id = pending[pending.length - 1].id;
  });

  test("admin rejects second revision → stays visible as rejected", async ({ page }) => {
    test.skip(!candidate2Id, "No second candidate");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });
    const rejectBtn = page.locator(`[data-testid="reject-btn-${candidate2Id}"]`);
    await expect(rejectBtn).toBeVisible({ timeout: 10000 });
    await rejectBtn.click();

    // After reject → stays in panel (rejected = actionable, author can withdraw)
    const statusEl = page.locator(`[data-testid="candidate-status-${candidate2Id}"]`);
    await expect(statusEl).toHaveText("rejected", { timeout: 15000 });

    // API: no translations
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find((c: { id: string }) => c.id === candidate2Id);
    expect(candidate?.translatedValues).toBeNull();
  });

  test("accepted candidate not visible in panel", async ({ page }) => {
    test.skip(!candidateId, "No first candidate");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Accepted = hidden from panel
    await expect(page.locator(`[data-testid="candidate-row-${candidateId}"]`)).toHaveCount(0, { timeout: 3000 });
  });
});
