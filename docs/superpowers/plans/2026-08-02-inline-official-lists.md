# Inline Official University Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one generic, collapsed official-List panel to every UK university that has guarded structured facts, while keeping unparsed official Lists neutral and linking Southampton directly to its official Tier page.

**Architecture:** Build a server-side presentation model by joining validated universities, official sources, institutions, and requirement facts. Astro renders that model with native `<details>` elements; the browser receives no new fetch logic and the reverse search continues to use the same facts. Link-only sources never receive a generated panel or negative evidence.

**Tech Stack:** Node.js 22, TypeScript 6, Astro 7, Vitest 4, existing JSON/AJV data contracts, CSS.

## Global Constraints

- A university receives an inline List only from facts already accepted into `src/data/generated/requirements.json`.
- No school-specific allowlist or manually duplicated List is permitted.
- Link-only sources remain neutral and display the official source rather than a partial local List.
- List presence or absence must never be described as application eligibility.
- The panel is collapsed by default and must not create horizontal overflow at 320px.
- No new runtime dependency, paid service, browser-time scraper, or persistent server is introduced.

---

### Task 1: Build the Generic Official-List Presentation Model

**Files:**
- Create: `src/lib/official-list-display.ts`
- Create: `tests/official-list-display.test.ts`

**Interfaces:**
- Consumes: `UniversityWithStatus[]`, `InstitutionRecord[]`, and `RequirementFact[]` from `src/lib/types.ts`.
- Produces:

```ts
export interface OfficialListDisplayRow {
  institutionId: string;
  nameZh: string;
  nameEn: string;
  tierOfficial: string;
  scoreOfficial?: string;
}

export interface OfficialListDisplayPanel {
  universityId: string;
  sourceId: string;
  sourceLabelZh: string;
  sourceUrl: string;
  scopeZh: string;
  cycle?: string;
  extractedAt: string;
  rows: OfficialListDisplayRow[];
}

export function buildOfficialListDisplays(input: {
  universities: UniversityWithStatus[];
  institutions: InstitutionRecord[];
  requirements: RequirementFact[];
}): Map<string, OfficialListDisplayPanel[]>;
```

- [ ] **Step 1: Write the failing presentation-model tests**

```ts
it('groups guarded facts by university and source and sorts rows by Chinese name', () => {
  const displays = buildOfficialListDisplays({
    universities: [universityWithParserEnabledSource],
    institutions: [beihang, peking],
    requirements: [pekingFact, beihangFact],
  });

  expect(displays.get('ucl')?.[0].rows.map((row) => row.nameZh)).toEqual([
    '北京航空航天大学',
    '北京大学',
  ]);
  expect(displays.get('ucl')?.[0]).toMatchObject({
    sourceId: 'ucl-china-list',
    sourceLabelZh: '中国研究生入学要求',
    cycle: '2026/27',
  });
});

it('does not create a panel for a link-only source without accepted facts', () => {
  const displays = buildOfficialListDisplays({
    universities: [southamptonLinkOnly],
    institutions: [],
    requirements: [],
  });
  expect(displays.has('university-of-southampton')).toBe(false);
});

it('rejects duplicate institution rows within one source', () => {
  expect(() => buildOfficialListDisplays({
    universities: [universityWithParserEnabledSource],
    institutions: [beihang],
    requirements: [beihangFact, { ...beihangFact, id: 'duplicate' }],
  })).toThrow(/duplicate institution/i);
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `node_modules/.bin/vitest.CMD run tests/official-list-display.test.ts`

Expected: FAIL because `src/lib/official-list-display.ts` does not exist.

- [ ] **Step 3: Implement the minimal validated join**

Implementation rules:

```ts
const universityById = new Map(universities.map((university) => [university.id, university]));
const institutionById = new Map(institutions.map((institution) => [institution.id, institution]));

// For every fact:
// 1. Resolve the fact's university and one of that university's registered sources.
// 2. Reject missing/mismatched university, source, or institution references.
// 3. Reject facts attached to parser.mode === 'link-only'.
// 4. Group by universityId + sourceId.
// 5. Reject repeated institutionId inside one source.
// 6. Sort rows by nameZh using localeCompare('zh-CN'), then institutionId.
// 7. Sort panels by sourceId and return Map<universityId, panel[]>.
```

Use the latest lexicographic ISO `extractedAt` value in each panel. Do not translate `tierOfficial` or synthesize missing scores.

- [ ] **Step 4: Run focused and full model tests**

Run: `node_modules/.bin/vitest.CMD run tests/official-list-display.test.ts tests/data.test.ts tests/evidence.test.ts`

Expected: PASS with no skipped tests.

- [ ] **Step 5: Commit the presentation model**

```bash
git add src/lib/official-list-display.ts tests/official-list-display.test.ts
git commit -m "feat: build official list display panels"
```

---

### Task 2: Render Accessible Collapsed Lists in the UK Directory

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/page-content.test.mjs`

**Interfaces:**
- Consumes: `loadRequirements()` and `buildOfficialListDisplays(...)`.
- Produces: native collapsed List panels and generic link-only disclosure in the UK-university directory.

- [ ] **Step 1: Write the failing page-contract test**

Add a test that requires the user-visible accessibility and neutral-copy contract:

```js
it('renders collapsed official Lists without treating link-only sources as local Lists', () => {
  expect(page).toContain('<details class="official-list-panel">');
  expect(page).toContain('查看已收录院校 List（');
  expect(page).toContain('官方分组/等级');
  expect(page).toContain('官网名单暂未完成安全结构化，本站暂不附表');
  expect(page).not.toContain('不能申请');
});
```

- [ ] **Step 2: Run the page test and verify the expected failure**

Run: `node_modules/.bin/vitest.CMD run tests/page-content.test.mjs`

Expected: FAIL because the List panels are not rendered yet.

- [ ] **Step 3: Join the display model at Astro build time**

At the top of `src/pages/index.astro`:

```ts
import { loadInstitutions, loadRequirements, loadUniversities } from '../lib/data';
import { buildOfficialListDisplays } from '../lib/official-list-display';

const institutions = loadInstitutions();
const universities = loadUniversities();
const requirements = loadRequirements();
const officialListsByUniversity = buildOfficialListDisplays({ universities, institutions, requirements });
const searchData = { institutions, universities, reverseIndex };
```

Inside each `.university-row`, render every panel returned for that university:

```astro
{(officialListsByUniversity.get(university.id) ?? []).map((panel) => (
  <details class="official-list-panel">
    <summary>查看已收录院校 List（{panel.rows.length} 所）</summary>
    <div class="official-list-meta">
      <span>{panel.sourceLabelZh}</span>
      <span>{panel.scopeZh}</span>
      {panel.cycle && <span>申请季 {panel.cycle}</span>}
      <span>最近提取 {panel.extractedAt.slice(0, 10)}</span>
      <a href={panel.sourceUrl} target="_blank" rel="noopener noreferrer">查看大学官网原页</a>
    </div>
    <ol class="official-list-rows">
      {panel.rows.map((row) => (
        <li>
          <span class="official-list-name"><strong>{row.nameZh}</strong><small>{row.nameEn}</small></span>
          <span><small>官方分组/等级</small>{row.tierOfficial}</span>
          {row.scoreOfficial && <span><small>官方分数</small>{row.scoreOfficial}</span>}
        </li>
      ))}
    </ol>
  </details>
))}
```

If a university has `state === 'official-list'`, no display panel, and at least one `link-only` official-list source, render the generic disclosure sentence. Do not check for a Southampton ID.

- [ ] **Step 4: Add desktop and 320px responsive styles**

Style `.official-list-panel` to span the full directory grid, give `<summary>` a visible keyboard focus treatment, and render `.official-list-rows > li` as a three-column grid on desktop. Under `@media(max-width:800px)`, switch each row to one column, allow long official names to wrap, and keep `max-width:100%`.

- [ ] **Step 5: Run page, model, and full tests**

Run: `node_modules/.bin/vitest.CMD run tests/page-content.test.mjs tests/official-list-display.test.ts`

Run: `pnpm test:run`

Expected: all tests pass.

- [ ] **Step 6: Build and perform browser QA**

Run: `pnpm build`

Browser checks at the local dev URL:

- UCL summary says 84 and expands to 84 rows;
- Edinburgh summary says 81 and expands to 81 rows;
- Southampton has no local `<details>` and shows the neutral link-only disclosure;
- the first and last rows remain readable at desktop and 320px;
- opening and closing `<details>` works with pointer and keyboard;
- no horizontal overflow or console error appears.

- [ ] **Step 7: Commit the UI**

```bash
git add src/pages/index.astro src/styles/global.css tests/page-content.test.mjs
git commit -m "feat: show guarded official university lists"
```

---

### Task 3: Point Southampton to Its Direct Tier Page and Reverify Release

**Files:**
- Modify: `src/data/sources.json`
- Modify: `tests/catalog.test.ts`
- Modify: `src/pages/methodology.astro`
- Modify: `README.md`

**Interfaces:**
- Consumes: the existing `southampton-china` source record.
- Produces: a direct official Tier-list link while preserving `parser.mode: 'link-only'` and neutral reverse evidence.

- [ ] **Step 1: Write the failing Southampton source test**

```ts
it('links Southampton directly to its official tier list without enabling incomplete matching', () => {
  const source = sources.find((item) => item.id === 'southampton-china');
  expect(source?.url).toBe('https://www.southampton.ac.uk/international/entry-qualification-equivalencies/china/postgraduate-taught-tier-list');
  expect(source?.labelZh).toBe('中国院校 Tier 名单');
  expect(source?.cycle).toBe('2025/26');
  expect(source?.parser.mode).toBe('link-only');
});
```

- [ ] **Step 2: Run the catalog test and verify the expected failure**

Run: `node_modules/.bin/vitest.CMD run tests/catalog.test.ts`

Expected: FAIL because the source still points to the general China entry page.

- [ ] **Step 3: Update only the registered source metadata**

Change `southampton-china` to the exact URL, label, and cycle asserted above. Keep its university-wide scope, official-list kind, conservative zero-record guard, and `link-only` mode unchanged.

- [ ] **Step 4: Document why the official page is not yet locally reproduced**

In methodology and README, state that every accepted structured source automatically receives the panel. Note that a large official List can remain link-only while duplicate/renamed rows and canonical Chinese institution mapping are unresolved; this is a data-integrity boundary, not an eligibility conclusion.

- [ ] **Step 5: Run release verification**

Run: `pnpm test:run`

Run: `pnpm build`

Run: `node scripts/report-source-coverage.mjs`

Run: `git diff --check`

Expected: all tests pass; Astro reports zero errors/warnings/hints; 28 cohort universities, 3 full public Lists, 1 faculty-only record, 24 no-public-list records, 2 parser-enabled sources, and 26 link-only sources.

- [ ] **Step 6: Commit metadata and documentation**

```bash
git add src/data/sources.json tests/catalog.test.ts src/pages/methodology.astro README.md
git commit -m "docs: clarify direct and structured official lists"
```

- [ ] **Step 7: Request final whole-branch review before integration**

Review the complete range `7aa3db0..HEAD` against both design specs, then fix all Critical and Important findings before offering merge/push options.
