import { test, expect } from "@playwright/test";

/**
 * PRODUCT GAP: Withdraw workflow is not implemented.
 *
 * Prisma schema has `withdrawnAt` field on EditCandidate,
 * but no API endpoint or UI for withdraw exists.
 *
 * All tests in this file are SKIPPED.
 */

const BLOCKED_REASON = "PRODUCT GAP: Withdraw API and UI not implemented";

test.describe("Withdraw / return workflow (BLOCKED)", () => {
  test.skip(true, BLOCKED_REASON);

  test("P0: author can withdraw pending revision", async ({ page }) => {
    // 1. Create revision, status = pending
    // 2. Click withdraw button
    // 3. Status changes to withdrawn
    // 4. Revision removed from admin pending queue
  });

  test("P1: author can withdraw rejected revision (if allowed)", async ({ page }) => {
    // Depends on business rule — currently undefined
  });

  test("P1: author cannot withdraw accepted revision (if forbidden)", async ({ page }) => {
    // Depends on business rule — currently undefined
  });

  test("P1: cannot withdraw another's revision", async ({ page }) => {
    // rev-a cannot withdraw rev-b's revision
  });

  test("P1: withdrawn revision does not appear in pending queue", async ({ page }) => {
    // Admin no longer sees it in review workspace
  });

  test("P1: withdrawn status persists after page reload", async ({ page }) => {
    // Reload doesn't revert withdrawn status
  });

  test("P2: cannot re-withdraw already withdrawn revision", async ({ page }) => {
    // Double withdraw attempt is handled gracefully
  });
});
