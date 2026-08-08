# Mobile Ranking Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent long QS/THE ranking bands from collapsing university names on mobile while preserving the desktop directory layout exactly.

**Architecture:** Wrap the existing QS and THE nodes in a `.ranking-pills` presentation container. Keep the wrapper transparent to the desktop grid with `display: contents`, then make it a full-width wrapping flex row inside a two-column mobile grid.

**Tech Stack:** Astro 7, CSS Grid/Flexbox, Vitest 4, LinkeDOM-based existing test suite, in-app Browser QA.

## Global Constraints

- Only mobile directory-card layout may change; desktop layout must remain unchanged.
- No university, ranking, Chinese institution rule, source-status, or generated dataset may change.
- No new runtime or development dependency.
- Preserve search, filtering, sorting, evidence, source links, folded lists, and specialist ranking behavior.
- Long ranking pills may wrap as a unit but their text must remain on one line.

---

### Task 1: Isolate Mobile Ranking Pills From the University Name Row

**Files:**
- Modify: `src/pages/index.astro:109-119`
- Modify: `src/styles/global.css:5-7`
- Create: `tests/mobile-ranking-layout.test.mjs`

**Interfaces:**
- Consumes: Existing `.university-row`, `.university-name`, `.rank-qs`, `.rank-the`, `.state`, and `.specialist-detail` presentation classes.
- Produces: A `.ranking-pills` wrapper that is transparent on desktop and a full-width wrapping rank row at widths up to 800px.

- [ ] **Step 1: Write the failing structural and CSS regression test**

Create `tests/mobile-ranking-layout.test.mjs` with assertions equivalent to:

```js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = readFileSync(resolve(root, 'src/pages/index.astro'), 'utf8');
const styles = readFileSync(resolve(root, 'src/styles/global.css'), 'utf8');

describe('mobile ranking layout', () => {
  it('groups both overall rankings without changing their desktop columns', () => {
    expect(page).toMatch(/class="ranking-pills"[\s\S]*class="rank rank-qs"[\s\S]*class="rank rank-the"/);
    expect(styles).toContain('.ranking-pills{display:contents}');
    expect(styles).toContain('.rank-qs{grid-column:2}');
    expect(styles).toContain('.rank-the{grid-column:3}');
  });

  it('keeps long ranking bands out of the mobile name row', () => {
    expect(styles).toContain('@media(max-width:800px)');
    expect(styles).toContain('.university-row{grid-template-columns:minmax(0,1fr) auto;');
    expect(styles).toContain('.ranking-pills{grid-column:1/-1;grid-row:2;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px}');
    expect(styles).not.toContain('.university-row{grid-template-columns:minmax(0,1fr) auto auto');
  });

  it('stacks status and rankings safely on narrow phones', () => {
    expect(styles).toContain('.ranking-pills{grid-row:3;justify-content:flex-start}');
    expect(styles).toContain('.specialist-detail{grid-row:4}');
  });
});
```

- [ ] **Step 2: Run the focused test and record RED**

Run:

```powershell
$env:PATH='C:\Users\ROG\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\ROG\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;' + $env:PATH
pnpm exec vitest run tests/mobile-ranking-layout.test.mjs tests/page-content.test.mjs
```

Expected: the new test fails because `.ranking-pills` and the two-column mobile CSS do not exist.

- [ ] **Step 3: Add the ranking wrapper and minimal responsive CSS**

Wrap the two existing rank nodes in `src/pages/index.astro`:

```astro
<div class="ranking-pills">
  <div class="rank rank-qs">...</div>
  <div class="rank rank-the">...</div>
</div>
```

Add desktop transparency and replace the mobile three-column rules with:

```css
.ranking-pills{display:contents}
@media(max-width:800px){
  .university-row{grid-template-columns:minmax(0,1fr) auto;...}
  .state{grid-column:2;grid-row:1;...}
  .ranking-pills{grid-column:1/-1;grid-row:2;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px}
  .rank-qs,.rank-the{grid-column:auto;grid-row:auto}
  .specialist-detail{grid-row:3;...}
}
@media(max-width:430px){
  .state{grid-column:1/-1;grid-row:2;...}
  .ranking-pills{grid-row:3;justify-content:flex-start}
  .specialist-detail{grid-row:4}
}
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the same focused Vitest command from Step 2.

Expected: all mobile-ranking-layout and page-content tests pass.

- [ ] **Step 5: Run full verification**

Run:

```powershell
pnpm test:run
pnpm build
git diff --check
```

Expected: zero test failures, successful Astro check/build, successful initial-HTML guard, and no whitespace errors. Restore any mechanical `public/generated/**` build drift before continuing.

- [ ] **Step 6: Perform rendered Browser QA**

The flow under test is: `/` → show a university with long QS/THE bands at 390px → university names remain readable and rank pills wrap independently; then inspect Imperial at 390px and the directory at desktop width → short ranks and six desktop information columns remain unchanged.

Use the in-app Browser at the local preview URL and verify:

```text
390 × 844: London Metropolitan University and Robert Gordon University names are not character-stacked; no horizontal overflow.
390 × 844: Imperial College London remains visually normal.
1440 × 1000: QS and THE remain in desktop columns 2 and 3; state remains column 4.
All viewports: title correct, directory non-empty, no error overlay, console error/warn count 0.
```

- [ ] **Step 7: Commit the implementation**

```powershell
git add -- src/pages/index.astro src/styles/global.css tests/mobile-ranking-layout.test.mjs
git commit -m "fix: preserve mobile university name width"
```

