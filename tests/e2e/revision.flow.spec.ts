import { test, expect } from "@playwright/test";
import {
  loginAs, logout, switchRole, openLesson,
  createUserViaAdmin, uniqueEmail, uniqueName,
  SEED_USERS, RUN_ID,
} from "./helpers/fixtures";

/**
 * PRODUCT GAP: Revision workflow is not implemented.
 *
 * The EditCandidate Prisma model exists, but:
 * - No POST /api/candidates endpoint
 * - No GET /api/candidates endpoint
 * - No review workspace UI for administrator
 * - handleSave() in lesson detail is a stub: "Draft saved! (Will create EditCandidate when API is connected)"
 * - No source-of-truth language selector in editor
 * - No translation fan-out after approve
 *
 * All tests in this file are SKIPPED until the backend + UI are implemented.
 * See: BETTA_APP/docs/CLAUDE_E2E_TEST_REPORT.md for full gap analysis.
 */

const BLOCKED_REASON = "PRODUCT GAP: EditCandidate API and review workflow not implemented";

test.describe("Revision flow — happy path (BLOCKED)", () => {
  test.skip(true, BLOCKED_REASON);

  test("P0: revisioner creates text revision in lesson 1A", async ({ page }) => {
    // 1. Login as owner, create two revisioners
    // 2. Login as rev-a, open 1A, edit teacher text, submit
    // 3. Verify status = pending in UI
  });

  test("P0: second revisioner creates revision in same lesson", async ({ page }) => {
    // 1. Login as rev-b
    // 2. Open same lesson 1A
    // 3. Edit a different field
    // 4. Submit revision
    // 5. Verify second pending status
  });

  test("P0: administrator rejects first revision with note", async ({ page }) => {
    // 1. Login as admin
    // 2. Open review workspace for 1A
    // 3. Find rev-a's revision
    // 4. Reject with note "Not aligned with curriculum"
    // 5. Verify status = rejected, note is saved
  });

  test("P0: administrator accepts second revision", async ({ page }) => {
    // 1. Login as admin
    // 2. Open review workspace for 1A
    // 3. Find rev-b's revision
    // 4. Accept
    // 5. Verify status = accepted
  });

  test("P0: after approve, all supported languages are updated from source-of-truth", async ({ page }) => {
    // 1. After accepting rev-b's text revision on 'en' source
    // 2. Verify 'ru' and 'uk' translations are updated
    // 3. Translation status shows completed
  });

  test("P0: author sees resulting statuses after review", async ({ page }) => {
    // 1. Login as rev-a — sees rejected with note
    // 2. Login as rev-b — sees accepted
  });

  test("P0: withdraw works for pending revision", async ({ page }) => {
    // 1. Create a new revision
    // 2. Before admin reviews, author withdraws
    // 3. Status = withdrawn
    // 4. Revision disappears from admin pending queue
  });

  test("P1: revision stores old/new values and source language", async ({ page }) => {
    // 1. Create revision with explicit source language selector
    // 2. Verify old value, new value, language code stored
  });

  test("P1: empty text cannot be submitted", async ({ page }) => {
    // 1. Open editor, clear text, try submit
    // 2. Validation prevents empty submission
  });

  test("P1: cancel editor without submit does not create revision", async ({ page }) => {
    // 1. Open editor, type text, click cancel
    // 2. No revision created
  });

  test("P1: review note is visible to author after reject", async ({ page }) => {
    // 1. Admin rejects with specific note
    // 2. Author sees the note in their revision history
  });
});

test.describe("Revision flow — conflicts (BLOCKED)", () => {
  test.skip(true, BLOCKED_REASON);

  test("P1: two revisions in same field — admin sees both separately", async ({ page }) => {
    // Both revisionists edit the same teacher text in 1A
    // Admin sees two independent pending revisions
    // Can accept one and reject the other
  });

  test("P1: one text revision + one image revision in same lesson", async ({ page }) => {
    // Text and image revisions are independent
    // Admin can accept/reject each independently
  });

  test("P1: accepting one revision does not auto-accept another", async ({ page }) => {
    // Explicit check that approve is per-revision, not per-lesson
  });

  test("P1: rejecting one revision does not hide the other", async ({ page }) => {
    // Both remain visible with correct statuses
  });

  test("P1: after refresh, statuses persist", async ({ page }) => {
    // Create revisions, review some, reload page — statuses correct
  });
});

test.describe("Revision — source of truth and translations (BLOCKED)", () => {
  test.skip(true, BLOCKED_REASON);

  test("P0: revision has explicit source-of-truth language", async ({ page }) => {
    // Revisioner selects source language before submit
    // Revision record shows language badge
  });

  test("P0: admin sees source language in review UI", async ({ page }) => {
    // Review workspace shows which language is the source
  });

  test("P0: after approve EN, RU and UK are updated", async ({ page }) => {
    // Change EN text, approve, verify RU/UK translations
  });

  test("P1: rejected revision does NOT trigger translations", async ({ page }) => {
    // Reject a revision — other languages unchanged
  });

  test("P1: withdrawn revision does NOT trigger translations", async ({ page }) => {
    // Withdraw before review — no translation triggered
  });

  test("P1: if source language is RU, EN and UK are derived from RU", async ({ page }) => {
    // Source = RU, verify EN and UK derived correctly
  });
});

test.describe("Revision — sквозной happy path (BLOCKED)", () => {
  test.skip(true, BLOCKED_REASON);

  test("P0: full end-to-end: create users → revisions → review → statuses → withdraw", async ({ page }) => {
    // This is the TZ section 6.1 main scenario:
    // 1. Login owner, create rev-a and rev-b
    // 2. rev-a edits 1A teacher text, submits, sees pending
    // 3. rev-b edits 1A different field, submits, sees pending
    // 4. admin rejects rev-a's with note, accepts rev-b's
    // 5. rev-a sees rejected + note
    // 6. rev-b sees accepted
    // 7. rev-a withdraws (if allowed on rejected)
    // 8. Verify rev-b cannot withdraw own accepted (if forbidden)
    // 9. Verify rev-a cannot withdraw rev-b's revision
  });
});
