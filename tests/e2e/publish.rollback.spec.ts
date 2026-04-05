import { test, expect } from "@playwright/test";

/**
 * PRODUCT GAP: Publish and rollback workflow is not implemented.
 *
 * Prisma schema has PublishVersion model, but:
 * - No publish API endpoint
 * - No rollback API endpoint
 * - No publish UI
 * - No version snapshot creation
 *
 * All tests in this file are SKIPPED.
 */

const BLOCKED_REASON = "PRODUCT GAP: Publish/rollback not implemented";

test.describe("Publish / rollback workflow (BLOCKED)", () => {
  test.skip(true, BLOCKED_REASON);

  test("P2: accepted revisions can be included in publish", async ({ page }) => {});
  test("P2: rejected and withdrawn not included in publish", async ({ page }) => {});
  test("P2: owner can publish lesson", async ({ page }) => {});
  test("P2: administrator cannot publish (if restricted)", async ({ page }) => {});
  test("P2: new version visible as active snapshot", async ({ page }) => {});
  test("P2: rollback restores previous snapshot", async ({ page }) => {});
  test("P2: audit trail reflects publish and rollback events", async ({ page }) => {});
  test("P2: publish uses translated values from approved source-of-truth", async ({ page }) => {});
  test("P2: publish uses approved image, not temporary draft", async ({ page }) => {});
});
