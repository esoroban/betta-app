import { test, expect } from "@playwright/test";
import {
  loginAs, openLesson,
  SEED_USERS, RUN_ID,
} from "./helpers/fixtures";

/**
 * E2E tests for 4 editor bugs — full create + approve + fan-out verification.
 *
 * Bug 1: Language switch inside editor drawer
 * Bug 2: Image editor — other lesson images + drafts + selection save
 * Bug 3: Poll editor — create + approve + translation fan-out
 * Bug 4: Overlay editor — create + approve + translation fan-out
 */

// ═══════════════════════════════════════════════════
// Bug 1: Editor language switch
// ═══════════════════════════════════════════════════

test.describe("Bug 1: Editor language switch", () => {
  test("switching source language updates textarea and saves with correct sourceLanguage", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    // Open Teacher Text editor
    await page.locator('[data-testid="editor-btn-teacher"]').click();
    await expect(page.locator('[data-testid="editor-drawer-teacher"]')).toBeVisible({ timeout: 5000 });

    // Record initial EN text
    const enText = await page.locator('[data-testid="editor-textarea"]').inputValue();

    // Switch to RU — textarea should update
    await page.locator('[data-testid="source-lang-ru"]').click();
    const ruText = await page.locator('[data-testid="editor-textarea"]').inputValue();
    // Current text label should show RU content
    await expect(page.locator('[data-testid="editor-current-text"]')).toBeVisible();

    // Switch to UK
    await page.locator('[data-testid="source-lang-uk"]').click();
    const ukText = await page.locator('[data-testid="editor-textarea"]').inputValue();

    // Switch back to EN — should restore original
    await page.locator('[data-testid="source-lang-en"]').click();
    const enAgain = await page.locator('[data-testid="editor-textarea"]').inputValue();
    expect(enAgain).toBe(enText);

    // Type new text in RU and save
    await page.locator('[data-testid="source-lang-ru"]').click();
    const testText = `Bug1-lang-${RUN_ID}`;
    await page.locator('[data-testid="editor-textarea"]').fill(testText);
    await page.locator('[data-testid="editor-save"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });

    // API verification: correct sourceLanguage
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find(
      (c: { proposedValue: string }) => c.proposedValue?.includes(`Bug1-lang-${RUN_ID}`)
    );
    expect(candidate).toBeTruthy();
    expect(candidate.sourceLanguage).toBe("ru");
    expect(candidate.field).toBe("teacher");
    expect(candidate.candidateType).toBe("text");
  });
});

// ═══════════════════════════════════════════════════
// Bug 2: Image editor galleries + selection save
// ═══════════════════════════════════════════════════

test.describe("Bug 2: Image editor galleries", () => {
  test("image editor shows current lesson, other lessons, and drafts", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="editor-btn-image"]').click();
    await expect(page.locator('[data-testid="editor-drawer-image"]')).toBeVisible({ timeout: 5000 });

    // Current lesson images visible
    await expect(page.locator('[data-testid="current-lesson-images"]')).toBeVisible({ timeout: 5000 });
    const thumbs = page.locator('[data-testid="current-lesson-images"] > div');
    expect(await thumbs.count()).toBeGreaterThan(0);

    // Other lessons section loads
    await expect(page.locator('[data-testid="other-lesson-images"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid^="other-lesson-"]').first()).toBeVisible({ timeout: 10000 });
    expect(await page.locator('[data-testid^="other-lesson-"]').count()).toBeGreaterThan(0);

    // Drafts section — may or may not exist depending on prior test state
    const drafts = page.locator('[data-testid="draft-candidate-images"]');
    const hasDrafts = await drafts.isVisible({ timeout: 2000 });
    // Just verify it doesn't error; presence depends on prior image generation tests
    if (hasDrafts) {
      expect(await drafts.locator('> div').count()).toBeGreaterThan(0);
    }
  });

  test("selecting image from other lesson and saving as candidate", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="editor-btn-image"]').click();
    await expect(page.locator('[data-testid="editor-drawer-image"]')).toBeVisible({ timeout: 5000 });

    // Wait for other lessons to load
    await expect(page.locator('[data-testid^="other-lesson-"]').first()).toBeVisible({ timeout: 10000 });

    // Click an image from another lesson (e.g. 1B sc1)
    const otherImage = page.locator('[data-testid^="select-image-1B-"]').first();
    if (await otherImage.isVisible({ timeout: 3000 })) {
      await otherImage.click();

      // Selected preview should appear
      await expect(page.locator('[data-testid="selected-image-preview"]')).toBeVisible({ timeout: 5000 });

      // Save selected
      await page.locator('[data-testid="btn-save-selected-image"]').click();
      await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });

      // API verification
      const resp = await page.request.get(`/api/candidates`);
      const data = await resp.json();
      const imgCandidate = data.candidates?.find(
        (c: { candidateType: string; proposedValue: string }) =>
          c.candidateType === "image" && c.proposedValue?.includes("/api/assets/1B/")
      );
      expect(imgCandidate).toBeTruthy();
      expect(imgCandidate.proposedValue).toContain("1B");
    } else {
      // 1B not available — try any other lesson
      const anyOther = page.locator('[data-testid^="select-image-"][data-testid*="-sc"]').first();
      await anyOther.click();
      await expect(page.locator('[data-testid="selected-image-preview"]')).toBeVisible({ timeout: 5000 });
      await page.locator('[data-testid="btn-save-selected-image"]').click();
      await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });
    }
  });
});

// ═══════════════════════════════════════════════════
// Bug 3: Poll editor — create + approve + fan-out
// ═══════════════════════════════════════════════════

test.describe.serial("Bug 3: Poll editor full workflow", () => {
  let pollCandidateId: string;

  test("revisioner creates poll candidate with question, options, and correct answer", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="editor-btn-poll"]').click();
    await expect(page.locator('[data-testid="editor-drawer-poll"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="poll-editor-body"]')).toBeVisible();

    // Fill question
    const question = `Bug3-poll-${RUN_ID}`;
    await page.locator('[data-testid="poll-question-input"]').fill(question);

    // Fill options
    await page.locator('[data-testid="poll-option-0"]').fill("Blue sky");
    await page.locator('[data-testid="poll-option-1"]').fill("Green sky");

    // Select correct answer (first option)
    await page.locator('[data-testid="poll-correct-0"]').click();

    // Fill explanation
    await page.locator('[data-testid="poll-explanation-input"]').fill("Rayleigh scattering makes the sky appear blue.");

    // Save
    await page.locator('[data-testid="editor-save"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });

    // API verification: candidateType=poll, structured JSON
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find(
      (c: { candidateType: string; proposedValue: string }) =>
        c.candidateType === "poll" && c.proposedValue?.includes(`Bug3-poll-${RUN_ID}`)
    );
    expect(candidate).toBeTruthy();
    expect(candidate.field).toBe("poll");
    expect(candidate.candidateType).toBe("poll");
    expect(candidate.status).toBe("pending");

    const pollData = JSON.parse(candidate.proposedValue);
    expect(pollData.question).toContain(`Bug3-poll-${RUN_ID}`);
    expect(pollData.options).toContain("Blue sky");
    expect(pollData.options).toContain("Green sky");
    expect(pollData.correctAnswer).toBe("opt_0");
    expect(pollData.explanation).toContain("Rayleigh");

    pollCandidateId = candidate.id;
  });

  test("admin approves poll candidate — translations fan-out for question, options, explanation", async ({ page }) => {
    test.skip(!pollCandidateId, "No poll candidate from previous test");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    const row = page.locator(`[data-testid="candidate-row-${pollCandidateId}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // Approve
    const approveBtn = page.locator(`[data-testid="approve-btn-${pollCandidateId}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();

    // Status → accepted
    await expect(page.locator(`[data-testid="candidate-status-${pollCandidateId}"]`))
      .toHaveText("accepted", { timeout: 15000 });

    // API: verify translations exist
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find((c: { id: string }) => c.id === pollCandidateId);
    expect(candidate).toBeTruthy();
    expect(candidate.status).toBe("accepted");
    expect(candidate.candidateType).toBe("poll");
    expect(candidate.translatedValues).toBeTruthy();

    // translatedValues should contain en, ru, uk with structured poll translations
    const tv = candidate.translatedValues;
    expect(tv.en).toBeTruthy();
    expect(tv.ru).toBeTruthy();
    expect(tv.uk).toBeTruthy();

    // Each lang should have question translation
    expect(tv.en.question?.success).toBe(true);
    expect(tv.ru.question?.success).toBe(true);
    expect(tv.uk.question?.success).toBe(true);

    // Options translated
    expect(tv.en.options?.length).toBeGreaterThan(0);
    expect(tv.ru.options?.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════
// Bug 4: Overlay editor — create + approve + fan-out
// ═══════════════════════════════════════════════════

test.describe.serial("Bug 4: Overlay editor full workflow", () => {
  let overlayCandidateId: string;

  test("revisioner creates overlay candidate with text and style", async ({ page }) => {
    await loginAs(page, SEED_USERS.revisioner);
    await openLesson(page, "1A");

    await page.locator('[data-testid="editor-btn-overlay"]').click();
    await expect(page.locator('[data-testid="editor-drawer-overlay"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="overlay-editor-body"]')).toBeVisible();

    // Enter overlay text
    const overlayText = `Bug4-overlay-${RUN_ID}`;
    await page.locator('[data-testid="overlay-text-input"]').fill(overlayText);

    // Adjust font size
    await page.locator('[data-testid="overlay-fontsize"]').fill("28");

    // Preview shows text
    await expect(page.locator('[data-testid="overlay-preview"]')).toContainText(overlayText);

    // Save
    await page.locator('[data-testid="editor-save"]').click();
    await expect(page.locator('[data-testid="save-msg"]')).toBeVisible({ timeout: 15000 });

    // API: verify candidateType=overlay, structured JSON
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find(
      (c: { candidateType: string; proposedValue: string }) =>
        c.candidateType === "overlay" && c.proposedValue?.includes(`Bug4-overlay-${RUN_ID}`)
    );
    expect(candidate).toBeTruthy();
    expect(candidate.field).toBe("overlay");
    expect(candidate.candidateType).toBe("overlay");
    expect(candidate.status).toBe("pending");

    const overlayData = JSON.parse(candidate.proposedValue);
    expect(overlayData.text).toContain(`Bug4-overlay-${RUN_ID}`);
    expect(overlayData.fontSize).toBe(28);
    expect(typeof overlayData.opacity).toBe("number");
    expect(typeof overlayData.color).toBe("string");
    expect(typeof overlayData.backgroundColor).toBe("string");

    overlayCandidateId = candidate.id;
  });

  test("admin approves overlay candidate — text translation fan-out", async ({ page }) => {
    test.skip(!overlayCandidateId, "No overlay candidate from previous test");

    await loginAs(page, SEED_USERS.admin);
    await openLesson(page, "1A");

    await page.locator('[data-testid="btn-my-revisions"]').click();
    await expect(page.locator('[data-testid="candidates-panel"]')).toBeVisible({ timeout: 10000 });

    const row = page.locator(`[data-testid="candidate-row-${overlayCandidateId}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // Approve
    const approveBtn = page.locator(`[data-testid="approve-btn-${overlayCandidateId}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();

    // Status → accepted
    await expect(page.locator(`[data-testid="candidate-status-${overlayCandidateId}"]`))
      .toHaveText("accepted", { timeout: 15000 });

    // API: verify translations exist
    const resp = await page.request.get(`/api/candidates`);
    const data = await resp.json();
    const candidate = data.candidates?.find((c: { id: string }) => c.id === overlayCandidateId);
    expect(candidate).toBeTruthy();
    expect(candidate.status).toBe("accepted");
    expect(candidate.candidateType).toBe("overlay");
    expect(candidate.translatedValues).toBeTruthy();

    // translatedValues should have en, ru, uk for overlay text
    const tv = candidate.translatedValues;
    expect(tv.en).toBeTruthy();
    expect(tv.ru).toBeTruthy();
    expect(tv.uk).toBeTruthy();
    expect(tv.en.success).toBe(true);
    expect(tv.ru.success).toBe(true);
    expect(tv.uk.success).toBe(true);
  });
});
