import { test, expect } from "@playwright/test";
import { loginAs, SEED_USERS } from "./helpers/fixtures";

/**
 * PRODUCT GAP: Image generation pipeline is not implemented.
 *
 * Current state:
 * - "Translate & Generate" button exists in image editor but has no handler
 * - No image generation API endpoint
 * - No prompt translation pipeline (input lang → English → normalization → generation)
 * - No image candidate creation/storage
 * - No admin image review workflow
 * - No regenerate functionality
 *
 * All tests in this file are SKIPPED until the image generation pipeline is built.
 * See: BETTA_APP/docs/CLAUDE_E2E_TEST_REPORT.md for full gap analysis.
 */

const BLOCKED_REASON = "PRODUCT GAP: Image generation pipeline not implemented";

test.describe("Image generation pipeline (BLOCKED)", () => {
  test.skip(true, BLOCKED_REASON);

  test("P0: revisioner opens image editor and enters prompt", async ({ page }) => {
    // 1. Login as revisioner, open lesson 1A
    // 2. Click Image editor button
    // 3. Enter image prompt in non-English language (e.g., Russian)
    // 4. Click "Translate & Generate"
    // 5. Verify prompt translated to English (intermediate step visible)
    // 6. Verify consistency check / improvement applied
    // 7. Verify generated image appears in preview
  });

  test("P0: image candidate created after generation", async ({ page }) => {
    // 1. After generation, an image candidate is created
    // 2. Image preview is visible to revisioner
    // 3. Candidate is distinct from text revision
  });

  test("P0: revisioner can regenerate image", async ({ page }) => {
    // 1. After first generation, click regenerate
    // 2. New image replaces previous preview
    // 3. Old temporary image is not left active
  });

  test("P0: admin reviews image candidate separately from text", async ({ page }) => {
    // 1. Admin sees image candidate in review workspace
    // 2. Admin sees old image vs new image comparison
    // 3. Admin can approve or reject specifically the image
    // 4. Approve image ≠ approve text revision
  });

  test("P0: after approve, new image visible in lesson detail", async ({ page }) => {
    // 1. Admin approves image candidate
    // 2. Lesson detail now shows the new image
    // 3. Other steps/scenes are unaffected
  });

  test("P0: after reject, old image remains canonical", async ({ page }) => {
    // 1. Admin rejects image candidate
    // 2. Lesson detail still shows original image
  });

  test("P1: prompt translation visible — input lang → English → normalized English", async ({ page }) => {
    // Verify the pipeline stages are visible in UI
  });

  test("P1: image candidate is tied to correct lesson/scene/step", async ({ page }) => {
    // Verify the generated image doesn't accidentally replace another step's image
  });

  test("P1: broken/missing generated image fails visibly", async ({ page }) => {
    // If generation fails, error is shown, not silent success
  });

  test("P1: approve image does NOT trigger text translation fan-out", async ({ page }) => {
    // Image approval is independent from text translation pipeline
  });
});
