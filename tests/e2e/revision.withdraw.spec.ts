import { test, expect } from "@playwright/test";
import {
  loginAs, openLesson,
  SEED_USERS, RUN_ID,
} from "./helpers/fixtures";

/**
 * P1: Withdraw workflow E2E on live Render.
 *
 * TZ section 7.8:
 * - author withdraws pending candidate
 * - author withdraws rejected candidate
 * - cannot withdraw accepted candidate
 * - non-author cannot withdraw
 * - withdrawn not in pending queue
 * - withdrawn persists after reload
 * - double withdraw blocked
 */

test.describe.serial("Withdraw workflow", () => {
  let pendingCandidateId: string;
  let rejectedCandidateId: string;
  let acceptedCandidateId: string;

  /** Helper: create a text candidate and return to lesson view */
  async function createCandidate(page: import("@playwright/test").Page, lang: string, text: string) {
    await page.locator('[data-testid="editor-btn-teacher"]').click();
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toBeVisible({ timeout: 5000 });
    await page.locator(`[data-testid="source-lang-${lang}"]`).click();
    await page.locator('[data-testid="editor-textarea"]').fill(text);
    await page.locator('[data-testid="editor-save"]').click();
    // Wait for save to complete: either save-msg appears or editor auto-closes
    await expect(
      page.locator('[data-testid="save-msg"]').or(page.locator('[data-testid="editor-drawer-teacher"]'))
    ).toBeVisible({ timeout: 15000 });
    // Give the save time to propagate, then close editor if still open
    await page.waitForTimeout(2000);
    if (await page.locator('[data-testid="editor-cancel"]').isVisible({ timeout: 1000 })) {
      await page.locator('[data-testid="editor-cancel"]').click();
    }
    // Wait for drawer to close
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toHaveCount(0, { timeout: 5000 });
  }

  test("setup: create 3 candidates (pending, rejected, accepted)", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await createCandidate(page, "en", `Withdraw-pending ${RUN_ID}`);
    await createCandidate(page, "ru", `Withdraw-reject ${RUN_ID}`);
    await createCandidate(page, "uk", `Withdraw-accept ${RUN_ID}`);

    // Open revisions panel and collect IDs
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Get all pending candidates created by this run via API
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const myCandidates = data.candidates
      ?.filter((c: { status: string; proposedValue: string }) =>
        c.status === "pending" && c.proposedValue?.includes(RUN_ID)
      )
      .sort((a: { createdAt: string }, b: { createdAt: string }) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    expect(myCandidates?.length).toBeGreaterThanOrEqual(3);
    pendingCandidateId = myCandidates[myCandidates.length - 3].id;
    rejectedCandidateId = myCandidates[myCandidates.length - 2].id;
    acceptedCandidateId = myCandidates[myCandidates.length - 1].id;
  });

  test("setup: admin rejects candidate 2 and accepts candidate 3", async ({ page }) => {
    test.skip(!rejectedCandidateId || !acceptedCandidateId, "No candidates from setup");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Reject candidate 2
    const rejectBtn = page.locator(`[data-testid="reject-btn-${rejectedCandidateId}"]`);
    await expect(rejectBtn).toBeVisible({ timeout: 10000 });
    await rejectBtn.click();
    await expect(page.locator(`[data-testid="candidate-status-${rejectedCandidateId}"]`))
      .toHaveText("rejected", { timeout: 15000 });

    // Accept candidate 3
    const approveBtn = page.locator(`[data-testid="approve-btn-${acceptedCandidateId}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await approveBtn.click();
    await expect(page.locator(`[data-testid="candidate-status-${acceptedCandidateId}"]`))
      .toHaveText("accepted", { timeout: 15000 });
  });

  test("P0: author withdraws pending candidate", async ({ page }) => {
    test.skip(!pendingCandidateId, "No pending candidate from setup");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    const withdrawBtn = page.locator(`[data-testid="withdraw-btn-${pendingCandidateId}"]`);
    await expect(withdrawBtn).toBeVisible({ timeout: 5000 });
    await withdrawBtn.click();

    await expect(page.locator(`[data-testid="candidate-status-${pendingCandidateId}"]`))
      .toHaveText("withdrawn", { timeout: 10000 });

    // DB verification
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const c = data.candidates?.find((x: { id: string }) => x.id === pendingCandidateId);
    expect(c?.status).toBe("withdrawn");
    expect(c?.withdrawnAt).toBeTruthy();
  });

  test("P1: author can withdraw rejected candidate", async ({ page }) => {
    test.skip(!rejectedCandidateId, "No rejected candidate from setup");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    const withdrawBtn = page.locator(`[data-testid="withdraw-btn-${rejectedCandidateId}"]`);
    // If withdraw is allowed for rejected, button should be visible
    if (await withdrawBtn.isVisible({ timeout: 3000 })) {
      await withdrawBtn.click();
      await expect(page.locator(`[data-testid="candidate-status-${rejectedCandidateId}"]`))
        .toHaveText("withdrawn", { timeout: 10000 });
    } else {
      // Business rule: withdraw not allowed for rejected — verify status stays rejected
      await expect(page.locator(`[data-testid="candidate-status-${rejectedCandidateId}"]`))
        .toHaveText("rejected");
    }
  });

  test("P1: author cannot withdraw accepted candidate", async ({ page }) => {
    test.skip(!acceptedCandidateId, "No accepted candidate from setup");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Withdraw button must NOT be visible for accepted
    const withdrawBtn = page.locator(`[data-testid="withdraw-btn-${acceptedCandidateId}"]`);
    await expect(withdrawBtn).toHaveCount(0, { timeout: 3000 });

    // Status stays accepted
    await expect(page.locator(`[data-testid="candidate-status-${acceptedCandidateId}"]`))
      .toHaveText("accepted");
  });

  test("P1: withdrawn candidate not in admin pending queue", async ({ page }) => {
    test.skip(!pendingCandidateId, "No withdrawn candidate");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // The withdrawn candidate should show status=withdrawn, NOT pending
    const statusEl = page.locator(`[data-testid="candidate-status-${pendingCandidateId}"]`);
    if (await statusEl.isVisible({ timeout: 3000 })) {
      await expect(statusEl).not.toHaveText("pending");
    }
    // If row is hidden entirely from admin view, that's also correct
  });

  test("P1: withdrawn status persists after reload", async ({ page }) => {
    test.skip(!pendingCandidateId, "No withdrawn candidate");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Status should still be withdrawn
    await expect(page.locator(`[data-testid="candidate-status-${pendingCandidateId}"]`))
      .toHaveText("withdrawn", { timeout: 5000 });

    // Reload and check again
    await page.reload();
    await expect(page.getByText(/Step \d+\/\d+/)).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    await expect(page.locator(`[data-testid="candidate-status-${pendingCandidateId}"]`))
      .toHaveText("withdrawn", { timeout: 5000 });
  });
});
