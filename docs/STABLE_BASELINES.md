# Stable Baselines

Verified working points of the application. Each entry represents a commit where all E2E tests passed on Render.

---

## stable-editor-revision-flow-2026-04-06

**Date:** 2026-04-06
**Commit:** `2ae8a42`
**Tag:** `stable-editor-revision-flow-2026-04-06`
**Render URL:** https://betta-app.onrender.com

### What was verified

Editor bug fixes (language switch, image gallery, poll editor, overlay editor) plus full revision/image/publish/withdraw/permissions E2E.

### Test commands

```bash
# Editor bugs (4 bugs, 7 tests)
cd /tmp/betta-app-repo
PLAYWRIGHT_BASE_URL=https://betta-app.onrender.com \
PLAYWRIGHT_USE_EXTERNAL_URL=1 \
npx playwright test tests/e2e/editor.bugs.spec.ts

# Regression (revision/image/withdraw/publish/permissions, 33 tests)
PLAYWRIGHT_BASE_URL=https://betta-app.onrender.com \
PLAYWRIGHT_USE_EXTERNAL_URL=1 \
npx playwright test \
  tests/e2e/revision.flow.spec.ts \
  tests/e2e/revision.image.spec.ts \
  tests/e2e/revision.withdraw.spec.ts \
  tests/e2e/publish.rollback.spec.ts \
  tests/e2e/revision.permissions.spec.ts
```

### Results

| Suite | Tests | Passed | Failed | Flaky |
|---|---|---|---|---|
| `editor.bugs.spec.ts` | 7 | 7 | 0 | 0 |
| Regression (5 spec files) | 33 | 32 | 0 | 1 |
| **Total** | **40** | **39** | **0** | **1** |

Flaky: `revision.withdraw.spec.ts` "withdrawn status persists after reload" — Render timeout 30s in `loginAs()`, passed on retry. Infra timeout, not product/test bug.

### What passes at this baseline

| Workflow | Spec file | Tests | Status |
|---|---|---|---|
| Text revision (create, approve, reject, translations) | `revision.flow.spec.ts` | 6 | pass |
| Image generation (prompt, generate, save, storage, approve) | `revision.image.spec.ts` | 6 | pass |
| Withdraw (pending, rejected, cannot accepted, persist) | `revision.withdraw.spec.ts` | 7 | pass (1 flaky) |
| Publish / rollback (publish, versions, rollback) | `publish.rollback.spec.ts` | 4 | pass |
| Permissions (edit, approve, publish visibility by role) | `revision.permissions.spec.ts` | 10 | pass |
| Bug 1: Editor language switch | `editor.bugs.spec.ts` | 1 | pass |
| Bug 2: Image gallery + selection from other lesson | `editor.bugs.spec.ts` | 2 | pass |
| Bug 3: Poll create + approve + translation fan-out | `editor.bugs.spec.ts` | 2 | pass |
| Bug 4: Overlay create + approve + translation fan-out | `editor.bugs.spec.ts` | 2 | pass |

### Remaining gaps

| Gap | Notes |
|---|---|
| Publish poll/overlay to lesson runtime | Publish creates version record but does not apply poll/overlay content to lesson display |
| Image draft selection in test setup | Depends on prior generation runs; no guaranteed draft creation step |
| Concurrent revisioner conflict | No test for two revisioners editing same field simultaneously |
| Withdraw other's candidate | No test with two different revisioner accounts for cross-author withdraw |
| Reject note visible to author in UI | Verified via API only, not checked in author's browser view |
