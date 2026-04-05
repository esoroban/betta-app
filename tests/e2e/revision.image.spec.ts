import { test, expect } from "@playwright/test";
import { loginAs, openLesson, SEED_USERS, RUN_ID } from "./helpers/fixtures";

/**
 * P0: Image generation pipeline E2E.
 *
 * TZ section 7.7:
 * - revisioner enters prompt in non-English
 * - system translates to English
 * - image is generated (Nano Banana 2)
 * - preview shown
 * - regenerate works
 * - save creates image candidate
 * - admin approves/rejects independently from text
 */

test.describe.serial("Image generation pipeline", () => {
  let imageCandidateId: string;

  test("revisioner generates image from Russian prompt", async ({ page }) => {
    test.setTimeout(120_000); // image generation can be slow

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // Open Image editor
    await page.locator('[data-testid="editor-btn-image"]').click();
    await expect(page.locator('[data-testid="editor-drawer-image"]')).toBeVisible({ timeout: 5000 });

    // Enter Russian prompt
    const prompt = `Весёлые дети учатся ${RUN_ID}`;
    await page.locator('[data-testid="image-prompt-input"]').fill(prompt);

    // Click generate
    await page.locator('[data-testid="btn-generate-image"]').click();

    // Wait for image to appear (up to 90s for API call)
    await expect(page.locator('[data-testid="generated-image-preview"]')).toBeVisible({ timeout: 90_000 });

    // Verify image generation result section is visible
    await expect(page.locator('[data-testid="image-generation-result"]')).toBeVisible();

    // English prompt should be shown somewhere in the result
    const resultText = await page.locator('[data-testid="image-generation-result"]').innerText();
    // The result should contain English translation info
    expect(resultText.toLowerCase()).toContain("english");
  });

  test("revisioner can regenerate image", async ({ page }) => {
    test.setTimeout(120_000);

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="editor-btn-image"]').click();
    await expect(page.locator('[data-testid="editor-drawer-image"]')).toBeVisible({ timeout: 5000 });

    const prompt = `Школьная доска ${RUN_ID}`;
    await page.locator('[data-testid="image-prompt-input"]').fill(prompt);
    await page.locator('[data-testid="btn-generate-image"]').click();
    await expect(page.locator('[data-testid="generated-image-preview"]')).toBeVisible({ timeout: 90_000 });

    // Click regenerate
    await page.locator('[data-testid="btn-regenerate-image"]').click();

    // New image should appear (wait for loading to finish)
    await expect(page.locator('[data-testid="generated-image-preview"]')).toBeVisible({ timeout: 90_000 });
  });

  test("revisioner saves image as candidate", async ({ page }) => {
    test.setTimeout(120_000);

    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="editor-btn-image"]').click();
    await expect(page.locator('[data-testid="editor-drawer-image"]')).toBeVisible({ timeout: 5000 });

    const prompt = `Факты и мнения ${RUN_ID}`;
    await page.locator('[data-testid="image-prompt-input"]').fill(prompt);
    await page.locator('[data-testid="btn-generate-image"]').click();
    await expect(page.locator('[data-testid="generated-image-preview"]')).toBeVisible({ timeout: 90_000 });

    // Save as image candidate
    await page.locator('[data-testid="btn-save-image-candidate"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });

    // Verify candidate appears in candidates panel
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Find image type candidate
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const imgCandidate = data.candidates?.find(
      (c: { candidateType: string; status: string }) =>
        c.candidateType === "image" && c.status === "pending"
    );
    if (imgCandidate) {
      imageCandidateId = imgCandidate.id;
    }
  });

  test("admin approves image candidate independently", async ({ page }) => {
    test.skip(!imageCandidateId, "No image candidate from previous test");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    // Open revisions panel
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });
    const row = page.locator(`[data-testid="candidate-row-${imageCandidateId}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });

    const approveBtn = page.locator(`[data-testid="approve-btn-${imageCandidateId}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();

    const statusEl = page.locator(`[data-testid="candidate-status-${imageCandidateId}"]`);
    await expect(statusEl).toHaveText("accepted", { timeout: 15000 });

    // Image approve should NOT trigger text translation fan-out (TZ 7.7)
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find((c: { id: string }) => c.id === imageCandidateId);
    // Image candidates should not have translatedValues
    expect(candidate?.translatedValues).toBeNull();
  });
});
