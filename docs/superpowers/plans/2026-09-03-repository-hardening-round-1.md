# Repository Hardening Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add repository guardrails and real desktop/mobile browser regression coverage without changing the published directory or daily patrol semantics.

**Architecture:** GitHub-native security settings provide the repository baseline. A small workflow-quality job validates Actions definitions, while Playwright starts the production Astro build and tests the existing UI in desktop Chromium and mobile WebKit; axe runs inside those real browser sessions.

**Tech Stack:** GitHub Actions, Dependabot, CodeQL default setup, actionlint 1.7.12, zizmor 1.30.0, Astro 7, Playwright Test 1.62.1, axe-core Playwright 4.13.0, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-03-repository-hardening-round-1.md`

## Global Constraints

- Do not change page layout, copy, directory data, ranking data, or official-source parsing.
- Do not change `.github/workflows/daily-check.yml` behavior.
- Keep every `uses:` reference pinned to a full 40-character commit SHA.
- Do not auto-merge dependency updates or publish browser reports publicly.
- Do not add PR-only branch rules that would block the daily status workflow's fast-forward push.

---

### Task 1: Browser regression contract

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/directory.spec.ts`
- Create: `tests/e2e/directory.spec.ts-snapshots/*`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the production Astro build and its existing DOM selectors.
- Produces: `pnpm test:e2e`, desktop Chromium and mobile WebKit projects, checked-in visual baselines, and failure-only diagnostics.

- [ ] **Step 1: Write the failing Playwright specification**

Create `tests/e2e/directory.spec.ts` with real-browser assertions that:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '英国大学中国院校规则，一页查清' })).toBeVisible();
});

test('keeps the directory within the viewport and preserves its visual structure', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page).toHaveScreenshot('directory-home.webp', { fullPage: false });
});

test('searches a UK university and a Chinese undergraduate institution from real generated data', async ({ page }) => {
  const search = page.getByRole('searchbox');
  await search.fill('曼彻斯特大学');
  await expect(page.locator('.university-row:visible')).toHaveCount(1);
  await expect(page.locator('.university-row:visible')).toContainText('The University of Manchester');

  await page.getByRole('button', { name: '查中国本科院校' }).click();
  await search.fill('北京大学');
  await expect(page.locator('#institution-result-count')).toContainText('北京大学');
  await expect(page.locator('.evidence-card').first()).toBeVisible();
});

test('has no serious or critical automated accessibility violations', async ({ page }) => {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = result.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(blocking).toEqual([]);
});

test('keeps a long university name readable on a narrow phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit');
  const row = page.locator('[data-id="london-metropolitan-university"]');
  await row.scrollIntoViewIfNeeded();
  const headingBox = await row.locator('h2').boundingBox();
  expect(headingBox?.width ?? 0).toBeGreaterThan(120);
  await expect(row).toHaveScreenshot('long-university-mobile.webp');
});
```

- [ ] **Step 2: Run the new test to verify RED**

Run: `pnpm exec playwright test tests/e2e/directory.spec.ts`

Expected: FAIL because `@playwright/test`, `@axe-core/playwright`, and the Playwright configuration do not exist yet.

- [ ] **Step 3: Add the minimal runner configuration and dependencies**

Add exact versions `@playwright/test@1.62.1` and `@axe-core/playwright@4.13.0`. Configure `playwright.config.ts` with:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: {
    command: 'pnpm build && pnpm exec astro preview --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

Add `test:e2e` and `test:e2e:update` scripts and ignore `playwright-report/` and `test-results/`.

- [ ] **Step 4: Install browsers and generate reviewed baselines**

Run:

```powershell
pnpm exec playwright install chromium webkit
pnpm test:e2e:update
```

Expected: both projects pass and write project-specific WebP snapshots.

- [ ] **Step 5: Prove the overflow regression assertion can fail**

Temporarily change the overflow allowance from `1` to `-1`, run the single overflow test, confirm FAIL, restore `1`, and rerun it to confirm PASS.

- [ ] **Step 6: Commit the browser contract**

```powershell
git add package.json pnpm-lock.yaml playwright.config.ts .gitignore tests/e2e
git commit -m "test: add browser regression coverage"
```

### Task 2: CI browser gate

**Files:**
- Modify: `tests/workflows.test.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `pnpm test:e2e` from Task 1.
- Produces: a CI browser test step and failure-only `playwright-report` artifact.

- [ ] **Step 1: Extend the existing workflow test first**

Add expectations that CI installs only Chromium and WebKit, runs `pnpm test:e2e` after the normal build, uploads `playwright-report/` only on failure, and grants no write permission.

- [ ] **Step 2: Run the workflow test to verify RED**

Run: `pnpm vitest run tests/workflows.test.mjs`

Expected: FAIL because CI has no browser test or report upload step.

- [ ] **Step 3: Add the minimal CI steps**

After `pnpm build`, add browser installation and `pnpm test:e2e`; add `actions/upload-artifact` pinned to its current release SHA with `if: failure()`, a seven-day retention, and `playwright-report/` as the only path.

- [ ] **Step 4: Validate and pass the focused tests**

Run: `pnpm vitest run tests/workflows.test.mjs && pnpm test:e2e`

Expected: all workflow and browser tests pass.

- [ ] **Step 5: Commit the CI browser gate**

```powershell
git add .github/workflows/ci.yml tests/workflows.test.mjs
git commit -m "ci: gate changes with browser tests"
```

### Task 3: Dependency and workflow maintenance

**Files:**
- Create: `.github/dependabot.yml`
- Create: `.github/workflows/workflow-quality.yml`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: repository manifests and `.github/workflows/*.yml`.
- Produces: weekly grouped dependency PRs and immutable actionlint/zizmor checks.

- [ ] **Step 1: Extend the pin inventory before creating the workflow**

Update the existing workflow tests so the approved workflow set includes `workflow-quality.yml`, its `actions/checkout` use, and `zizmorcore/zizmor-action@70fb788f84895a7701f5643d103d587e460b5c99 # v0.6.3`.

- [ ] **Step 2: Run the workflow test to verify RED**

Run: `pnpm vitest run tests/workflows.test.mjs`

Expected: FAIL because the quality workflow does not exist.

- [ ] **Step 3: Add weekly grouped Dependabot configuration**

Configure `package-ecosystem: npm` and `package-ecosystem: github-actions` at `/`, both weekly, with a limit of two open PRs per ecosystem and grouped non-major updates. Do not configure automatic merging.

- [ ] **Step 4: Add immutable workflow validation**

Create `workflow-quality.yml` with read-only permissions. Download actionlint 1.7.12, verify SHA-256 `8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8`, then run it. Run zizmor action v0.6.3 with zizmor v1.30.0, `advanced-security: false`, `min-severity: medium`, and `min-confidence: high`.

- [ ] **Step 5: Run both validators locally**

Run the downloaded actionlint binary against `.github/workflows`. Run the zizmor 1.30.0 Windows binary against the repository with the same severity and confidence thresholds.

Expected: both exit 0; fix actual workflow issues rather than suppressing them broadly.

- [ ] **Step 6: Pass the workflow tests and commit**

```powershell
pnpm vitest run tests/workflows.test.mjs
git add .github/dependabot.yml .github/workflows/workflow-quality.yml tests/workflows.test.mjs
git commit -m "ci: add dependency and workflow guards"
```

### Task 4: GitHub-native repository settings

**Files:**
- No repository files; mutate only GitHub repository settings through authenticated APIs.

**Interfaces:**
- Consumes: repository-admin authorization.
- Produces: enabled security scanning, action SHA enforcement, and a limited safe ruleset.

- [ ] **Step 1: Snapshot current settings**

Read repository security configuration, Actions permissions, CodeQL default setup, existing rulesets, and branch protection through GitHub APIs. Save no credentials or response containing secrets.

- [ ] **Step 2: Enable native security features**

Enable Dependabot alerts, Dependabot security updates, secret scanning, push protection, and CodeQL default setup for JavaScript/TypeScript where supported.

- [ ] **Step 3: Enforce immutable Actions**

Enable repository-level full-length SHA pinning while leaving the current action allow policy unchanged in this round.

- [ ] **Step 4: Create the non-disruptive ruleset**

Create an active ruleset targeting the default branch with only `deletion` and `non_fast_forward` rules. Do not require pull requests or status checks in this round.

- [ ] **Step 5: Read settings back and verify**

Confirm the enabled security flags, `sha_pinning_required: true`, and the exact two rules. Confirm no rule prevents ordinary fast-forward pushes.

### Task 5: Full verification and handoff

**Files:**
- Modify only files needed to resolve verification defects introduced by Tasks 1-3.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a verified branch ready for review.

- [ ] **Step 1: Run the full repository verification**

Run:

```powershell
pnpm build:public
pnpm test:run
pnpm build
pnpm test:e2e
```

Expected: 0 failures and a successful production build.

- [ ] **Step 2: Run workflow validators one final time**

Run actionlint 1.7.12 and zizmor 1.30.0 using the exact versions and thresholds from Task 3.

Expected: both exit 0.

- [ ] **Step 3: Review the diff against the specification**

Confirm no data, ranking, source parser, page, stylesheet, or daily workflow file changed. Confirm browser reports and result directories are ignored.

- [ ] **Step 4: Commit any final verification-only corrections**

```powershell
git add <only-the-corrected-files>
git commit -m "test: finalize repository hardening checks"
```

- [ ] **Step 5: Offer the standard branch integration choices**

Follow `superpowers:finishing-a-development-branch` after fresh verification.

