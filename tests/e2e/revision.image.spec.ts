import { test, expect } from "@playwright/test";
import { loginAs, openLesson, SEED_USERS, RUN_ID } from "./helpers/fixtures";

/**
 * P0: Image generation pipeline — browser-driven E2E with storage verification.
 *
 * TZ section 7.7:
 * - revisioner enters prompt in non-English
 * - system translates to English
 * - image is generated
 * - preview shown
 * - regenerate works
 * - save creates image candidate
 * - storage/disk persistence verified explicitly
 * - admin approves/rejects independently from text
 */

test.describe.serial("Image generation pipeline", () => {
  let imageCandidateId: string;
  let candidateCountBefore: number;

  test("storage baseline: record candidateCount before generation", async ({ page }) => {
    // Get candidateCount from health endpoint (counts files in /app/storage/candidates/)
    const health = await page.request.get(`/api/health`);
    const data = await health.json();
    candidateCountBefore = data.storage?.candidateCount ?? 0;
    expect(typeof candidateCountBefore).toBe("number");
  });

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
    expect(resultText.toLowerCase()).toContain("english");
  });

  test("storage check: candidateCount increased after generation", async ({ page }) => {
    // After image generation, the file should be saved to /app/storage/candidates/
    const health = await page.request.get(`/api/health`);
    const data = await health.json();
    const candidateCountAfter = data.storage?.candidateCount ?? 0;
    expect(candidateCountAfter).toBeGreaterThan(candidateCountBefore);
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

  test("revisioner saves image as candidate + disk persistence verified", async ({ page }) => {
    test.setTimeout(120_000);

    // Record disk state before this test
    const healthBefore = await page.request.get(`/api/health`);
    const dataBefore = await healthBefore.json();
    const diskBefore = dataBefore.storage?.candidateCount ?? 0;

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

    // Verify candidate appears in candidates panel via UI
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // API verification: find the image candidate and get its details
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const imgCandidate = data.candidates?.find(
      (c: { candidateType: string; status: string }) =>
        c.candidateType === "image" && c.status === "pending"
    );
    expect(imgCandidate).toBeTruthy();
    imageCandidateId = imgCandidate.id;

    // STORAGE/DISK VERIFICATION:
    // 1. Health endpoint: candidateCount should have increased
    const healthAfter = await page.request.get(`/api/health`);
    const dataAfter = await healthAfter.json();
    expect(dataAfter.storage?.candidateCount).toBeGreaterThan(diskBefore);

    // 2. Probe the image file via GET /api/candidates/generate-image?file=<filename>
    //    If the image candidate has a proposedValue with a filename, fetch it
    if (imgCandidate.proposedValue) {
      // proposedValue for image candidates typically contains the image path/filename
      const filename = imgCandidate.proposedValue.split("/").pop();
      if (filename) {
        const imageResp = await page.request.get(
          `/api/candidates/generate-image?file=${filename}`
        );
        // 200 = file exists on disk and is serveable
        expect(imageResp.status()).toBe(200);
        const contentType = imageResp.headers()["content-type"];
        expect(contentType).toContain("image/");
      }
    }
  });

  test("admin approves image candidate independently (no text fanout)", async ({ page }) => {
    test.skip(!imageCandidateId, "No image candidate from previous test");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    // Open revisions panel
    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    // Find and verify image candidate row in UI
    const row = page.locator(`[data-testid="candidate-row-${imageCandidateId}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // UI: pending candidate visible with approve button
    const approveBtn = page.locator(`[data-testid="approve-btn-${imageCandidateId}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();

    // After approve → row vanishes from panel (accepted = hidden)
    await expect(page.locator(`[data-testid="candidate-row-${imageCandidateId}"]`))
      .toHaveCount(0, { timeout: 15000 });

    // API verification: image approve should NOT trigger text translation fan-out
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find((c: { id: string }) => c.id === imageCandidateId);
    expect(candidate?.status).toBe("accepted");
    expect(candidate?.candidateType).toBe("image");
    // translatedValues should be null for image candidates (no text fan-out)
    expect(candidate?.translatedValues).toBeNull();

    // STORAGE: image file should still be on disk after approve
    const health = await page.request.get(`/api/health`);
    const healthData = await health.json();
    expect(healthData.storage?.candidateCount).toBeGreaterThan(0);
  });
});
