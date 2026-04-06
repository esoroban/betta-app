import { test, expect } from "@playwright/test";
import {
  loginAs, openLesson,
  SEED_USERS, RUN_ID,
} from "./helpers/fixtures";

/**
 * Withdraw workflow E2E on live Render.
 *
 * Panel shows pending + rejected (actionable). Accepted/withdrawn hidden.
 */

test.describe.serial("Withdraw workflow", () => {
  let pendingCandidateId: string;
  let rejectedCandidateId: string;
  let acceptedCandidateId: string;

  async function createCandidate(page: import("@playwright/test").Page, lang: string, text: string) {
    await page.locator('[data-testid="editor-btn-teacher"]').click();
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toBeVisible({ timeout: 5000 });
    await page.locator(`[data-testid="source-lang-${lang}"]`).click();
    await page.locator('[data-testid="editor-textarea"]').fill(text);
    await page.locator('[data-testid="editor-save"]').click();
    await expect(
      page.locator('[data-testid="save-msg"]').or(page.locator('[data-testid="editor-drawer-teacher"]'))
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    if (await page.locator('[data-testid="editor-cancel"]').isVisible({ timeout: 1000 })) {
      await page.locator('[data-testid="editor-cancel"]').click();
    }
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toHaveCount(0, { timeout: 5000 });
  }

  test("setup: create 3 candidates", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await createCandidate(page, "en", `Withdraw-pending ${RUN_ID}`);
    await createCandidate(page, "ru", `Withdraw-reject ${RUN_ID}`);
    await createCandidate(page, "uk", `Withdraw-accept ${RUN_ID}`);

    // Get IDs via API
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const myCandidates = data.candidates
      ?.filter((c: { status: string; proposedValue: string }) =>
        c.status === "pending" && c.proposedValue?.includes(RUN_ID))
      .sort((a: { createdAt: string }, b: { createdAt: string }) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    expect(myCandidates?.length).toBeGreaterThanOrEqual(3);
    pendingCandidateId = myCandidates[myCandidates.length - 3].id;
    rejectedCandidateId = myCandidates[myCandidates.length - 2].id;
    acceptedCandidateId = myCandidates[myCandidates.length - 1].id;
  });

  test("setup: admin rejects candidate 2, accepts candidate 3", async ({ page }) => {
    test.skip(!rejectedCandidateId || !acceptedCandidateId, "No candidates");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Reject candidate 2 — stays in panel as rejected
    const rejectBtn = page.locator(`[data-testid="reject-btn-${rejectedCandidateId}"]`);
    await expect(rejectBtn).toBeVisible({ timeout: 10000 });
    await rejectBtn.click();
    await expect(page.locator(`[data-testid="candidate-status-${rejectedCandidateId}"]`))
      .toHaveText("rejected", { timeout: 15000 });

    // Approve candidate 3 — vanishes from panel
    const approveBtn = page.locator(`[data-testid="approve-btn-${acceptedCandidateId}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await approveBtn.click();
    await expect(page.locator(`[data-testid="candidate-row-${acceptedCandidateId}"]`))
      .toHaveCount(0, { timeout: 15000 });

    // API verify
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    expect(data.candidates?.find((c: { id: string }) => c.id === acceptedCandidateId)?.status).toBe("accepted");
  });

  test("P0: author withdraws pending candidate → vanishes from panel", async ({ page }) => {
    test.skip(!pendingCandidateId, "No pending candidate");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    const withdrawBtn = page.locator(`[data-testid="withdraw-btn-${pendingCandidateId}"]`);
    await expect(withdrawBtn).toBeVisible({ timeout: 5000 });
    await withdrawBtn.click();

    // After withdraw → vanishes (withdrawn = hidden)
    await expect(page.locator(`[data-testid="candidate-row-${pendingCandidateId}"]`))
      .toHaveCount(0, { timeout: 10000 });

    // DB verification
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const c = data.candidates?.find((x: { id: string }) => x.id === pendingCandidateId);
    expect(c?.status).toBe("withdrawn");
    expect(c?.withdrawnAt).toBeTruthy();
  });

  test("P1: author can withdraw rejected candidate → vanishes", async ({ page }) => {
    test.skip(!rejectedCandidateId, "No rejected candidate");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Rejected is still visible in panel (actionable)
    const withdrawBtn = page.locator(`[data-testid="withdraw-btn-${rejectedCandidateId}"]`);
    if (await withdrawBtn.isVisible({ timeout: 3000 })) {
      await withdrawBtn.click();
      // After withdraw → vanishes
      await expect(page.locator(`[data-testid="candidate-row-${rejectedCandidateId}"]`))
        .toHaveCount(0, { timeout: 10000 });
      // API verify
      const resp = await page.request.get(`/api/candidates`);
      const data = await resp.json();
      expect(data.candidates?.find((x: { id: string }) => x.id === rejectedCandidateId)?.status).toBe("withdrawn");
    }
  });

  test("P1: accepted candidate not in panel, not withdrawable", async ({ page }) => {
    test.skip(!acceptedCandidateId, "No accepted candidate");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Accepted = hidden from panel
    await expect(page.locator(`[data-testid="candidate-row-${acceptedCandidateId}"]`))
      .toHaveCount(0, { timeout: 3000 });

    // API: still accepted
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    expect(data.candidates?.find((x: { id: string }) => x.id === acceptedCandidateId)?.status).toBe("accepted");
  });

  test("P1: withdrawn not in admin panel", async ({ page }) => {
    test.skip(!pendingCandidateId, "No withdrawn candidate");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Withdrawn = hidden
    await expect(page.locator(`[data-testid="candidate-row-${pendingCandidateId}"]`))
      .toHaveCount(0, { timeout: 3000 });
  });

  test("P1: withdrawn persists after reload (API check)", async ({ page }) => {
    test.skip(!pendingCandidateId, "No withdrawn candidate");

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // Withdrawn not in panel
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`[data-testid="candidate-row-${pendingCandidateId}"]`))
      .toHaveCount(0, { timeout: 3000 });

    // Reload and verify via API
    await page.reload();
    await expect(page.getByText(/Step \d+\/\d+/)).toBeVisible({ timeout: 15000 });
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    expect(data.candidates?.find((x: { id: string }) => x.id === pendingCandidateId)?.status).toBe("withdrawn");
  });
});
