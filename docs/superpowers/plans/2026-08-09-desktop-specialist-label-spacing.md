# Desktop Specialist Label Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the desktop “特色院校” label from the red specialist-evidence panel without changing mobile or non-specialist cards.

**Architecture:** Keep the existing Astro markup and CSS grid. Add one regression contract around the desktop and mobile CSS rules, then replace the desktop negative top margin with a small positive gap while preserving the existing mobile `margin:0` override.

**Tech Stack:** Astro, CSS Grid, Vitest, in-app Browser

## Global Constraints

- Only widths above 800px receive the new spacing.
- Keep the specialist label, evidence panel, links, copy, grid structure, search, sort, and data unchanged.
- Keep the mobile `.specialist-detail` margin reset at `0`.
- Do not publish until the focused test, full test suite, production build, desktop visual QA, and mobile regression QA pass.

---

### Task 1: Protect and fix specialist spacing

**Files:**
- Modify: `tests/page-content.test.mjs`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: the existing `.specialist-label` and `.specialist-detail` selectors rendered by `src/pages/index.astro`
- Produces: a desktop-only `10px` gap before `.specialist-detail`, with the existing mobile `margin:0` override preserved

- [ ] **Step 1: Write the failing CSS behavior test**

Add this test inside `describe('dual-direction search page', ...)` in `tests/page-content.test.mjs`:

```js
it('separates the desktop specialist label from its detail panel without changing mobile spacing', () => {
  const desktopRule = styles.match(/\.specialist-detail\{([^}]*)\}/)?.[1] ?? '';
  expect(desktopRule).toContain('margin-top:10px');
  expect(desktopRule).not.toMatch(/margin-top:-/);
  expect(styles).toMatch(/@media\(max-width:800px\)\{[\s\S]*?\.specialist-detail\{[^}]*margin:0/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node_modules\.bin\vitest.cmd run tests/page-content.test.mjs
```

Expected: the new test fails because the desktop rule still contains `margin-top:-3px` instead of `margin-top:10px`.

- [ ] **Step 3: Implement the minimal desktop CSS change**

In `src/styles/global.css`, change only the base desktop rule:

```css
.specialist-detail{grid-column:1/-1;margin-top:10px;padding:10px 14px;border-left:3px solid var(--red);background:#f8f1f1;font-size:13px;line-height:1.55}
```

Do not change the existing mobile override:

```css
@media(max-width:800px){/* existing rules */.specialist-detail{grid-column:1/-1;grid-row:3;margin:0}/* existing rules */}
```

- [ ] **Step 4: Verify GREEN and the whole project**

Run:

```powershell
node_modules\.bin\vitest.cmd run tests/page-content.test.mjs
node_modules\.bin\vitest.cmd run
pnpm.cmd build
git diff --check
```

Expected: all commands exit `0`; the build reports 101 unique QS-sorted rows.

- [ ] **Step 5: Perform rendered regression QA**

Use the production preview in the in-app Browser:

1. At `1440×1000`, search for a specialist such as `LBS` or `UAL` and confirm the label border does not touch the red evidence-panel border.
2. Confirm the desktop page has no horizontal overflow and no console errors or warnings.
3. At `390×844`, confirm the existing mobile specialist card order and spacing are unchanged and there is no horizontal overflow.

- [ ] **Step 6: Commit the focused fix**

```powershell
git add tests/page-content.test.mjs src/styles/global.css
git commit -m "fix: separate desktop specialist labels"
```

- [ ] **Step 7: Resume the approved publish flow**

Push `feat/audit-pending-china-lists`, open a PR to `main`, merge only after required checks pass, then verify the GitHub Pages deployment and the production URL.
