# Comprehensive China List Audit and LBS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reclassify every current UK university from reviewed official evidence, add LBS without a fake QS rank, and expose every confirmed public Chinese-institution list safely without confusing grade mappings with application whitelists.

**Architecture:** Keep the existing static Astro site and guarded source-sync pipeline. Add an explicit directory category and a versioned 29-school audit matrix, extend registered extractors for grouped and bilingual official lists, and keep parser output behind the existing record-count and rule-text guards. Full public lists use structured facts; rule-only schools use reviewed Chinese summaries and official links.

**Tech Stack:** Astro 7, TypeScript 6, Vitest 4, Linkedom, pdfjs-dist, AJV, GitHub Actions, GitHub Pages.

## Global Constraints

- Scope is the existing 28 QS World University Rankings 2027 UK top-200 universities plus London Business School as an unranked specialist institution.
- Every directory institution must have one reviewed state, one or more official HTTPS sources, an applicable scope, and a review date.
- Public lists must distinguish `eligibility`, `grade-threshold`, and `mixed`; no result may infer “can apply” or “cannot apply” from list membership alone.
- Manchester is not a public faculty list: it has institution-sensitive university, computer-science, and law requirements without a published complete roster.
- Exeter 2026 accepts all Chinese Ministry of Education-recognised bachelor-awarding institutions under uniform thresholds; its old ranking PDF is not current evidence.
- No paid API, server, database, or browser-time scraping is added.
- Production behavior changes follow red-green-refactor; live-network pages are represented by local fixtures in unit tests.

---

### Task 1: Add the explicit directory scope and LBS

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/data/universities.schema.json`
- Modify: `src/data/universities.json`
- Modify: `src/lib/search.ts`
- Modify: `tests/data.test.ts`
- Modify: `tests/search.test.ts`
- Modify: `tests/catalog.test.ts`

**Interfaces:**
- Produces: `DirectoryCategory = 'qs-top-200' | 'specialist'`.
- Produces: `University.directoryCategory` and optional `University.qs`.
- Produces: `compareDirectoryUniversities(left, right): number`, sorting ranked entries first and specialist entries after them.

- [ ] **Step 1: Write failing data and sorting tests**

Add literal assertions that 28 records are `qs-top-200` with QS ranks, LBS is `specialist` with no `qs`, all 29 IDs are unique, and search returns LBS after every ranked university.

```ts
expect(universities.filter((item) => item.directoryCategory === 'qs-top-200')).toHaveLength(28);
expect(universities.find((item) => item.id === 'london-business-school')).toMatchObject({
  directoryCategory: 'specialist',
  state: 'not-public',
});
expect(universities.find((item) => item.id === 'london-business-school')).not.toHaveProperty('qs');
expect(createUniversitySearch(joined).search('', []).at(-1)?.id).toBe('london-business-school');
```

- [ ] **Step 2: Run focused tests and verify the expected failures**

Run: `pnpm vitest run tests/data.test.ts tests/search.test.ts tests/catalog.test.ts`

Expected: FAIL because `directoryCategory` and LBS do not exist and search assumes every record has `qs.rank`.

- [ ] **Step 3: Implement the minimum model and data changes**

Add `directoryCategory` to all existing records, make `qs` conditionally required by the JSON Schema, add LBS with aliases `LBS` and `London Business School`, official domain `https://www.london.edu`, state `not-public`, and source ID `lbs-mim-entry`. Implement ranked-first sorting without assigning LBS a sentinel QS rank in data.

- [ ] **Step 4: Run focused tests and the full suite**

Run: `pnpm vitest run tests/data.test.ts tests/search.test.ts tests/catalog.test.ts && pnpm test:run`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
feat: add LBS as a specialist institution
```

---

### Task 2: Add a 29-school reviewed coverage matrix

**Files:**
- Create: `src/data/china-rule-audit.json`
- Create: `src/data/china-rule-audit.schema.json`
- Modify: `src/lib/data.ts`
- Modify: `scripts/report-source-coverage.mjs`
- Modify: `tests/source-coverage.test.mjs`
- Modify: `tests/catalog.test.ts`

**Interfaces:**
- Produces: audit rows `{ universityId, directoryCategory, expectedState, reviewDate, finding }`.
- Updates: `evaluateCoverage({ cohort, universities, sources, audit })` to validate the 28+1 scope.

- [ ] **Step 1: Write failing coverage tests**

Assert 29/29 coverage, exact state agreement, the nine university-level public list IDs, Manchester not being `faculty-only`, and Exeter carrying the reviewed uniform-rule finding.

```ts
expect(audit).toHaveLength(29);
expect(audit.filter((row) => row.expectedState === 'official-list').map((row) => row.universityId).sort()).toEqual([
  'university-college-london',
  'university-of-bristol',
  'university-of-cambridge',
  'university-of-edinburgh',
  'university-of-glasgow',
  'university-of-nottingham',
  'university-of-sheffield',
  'university-of-southampton',
  'university-of-warwick',
].sort());
expect(audit.find((row) => row.universityId === 'university-of-manchester')?.expectedState).toBe('china-requirements');
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm vitest run tests/source-coverage.test.mjs tests/catalog.test.ts`

Expected: FAIL because the audit matrix does not exist and coverage still requires university IDs to equal only the QS cohort.

- [ ] **Step 3: Add the schema, matrix, loader, and coverage validation**

Record the exact categories from the design spec. `evaluateCoverage` must allow only cohort IDs plus `london-business-school`, require audit/state agreement, reject missing or duplicate rows, and report counts for QS, specialist, public-list, rule-only, and not-public entries.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `pnpm vitest run tests/source-coverage.test.mjs tests/catalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
test: enforce complete China rule coverage
```

---

### Task 3: Correct all reviewed source semantics

**Files:**
- Modify: `src/data/sources.json`
- Modify: `src/data/universities.json`
- Modify: `src/data/status.json`
- Modify: `tests/catalog.test.ts`
- Modify: `tests/page-content.test.mjs`

**Interfaces:**
- Consumes: the audit matrix from Task 2.
- Produces: reviewed sources with `institutionRule`, `verification`, `scope`, and current official URL.

- [ ] **Step 1: Write failing semantic regression tests**

Add table-driven literal expectations for:

- `official-list`: Cambridge, UCL, Edinburgh, Bristol, Warwick, Glasgow, Sheffield, Nottingham, Southampton.
- `china-requirements`: Imperial, Oxford, KCL, LSE, Birmingham, Leeds, Manchester, QMUL, St Andrews, Liverpool, Newcastle, York, Lancaster, QUB, Cardiff, Reading.
- `not-public`: Durham, Bath, Exeter, LBS.
- Manchester sources `manchester-china`, `manchester-computer-science-china`, and `manchester-law-china` all use `institutionRule.type: 'none'` and never claim a public roster.
- Exeter summary includes the reviewed 2026 cancellation of domestic ranking requirements.

- [ ] **Step 2: Run the semantic tests and verify failure**

Run: `pnpm vitest run tests/catalog.test.ts tests/page-content.test.mjs`

Expected: FAIL for the six missed public-list states, the rule-only schools, Manchester, Exeter, and LBS source metadata.

- [ ] **Step 3: Update all sources and university states**

Use only the official URLs and meanings in the design spec. Add separate Manchester university, computer-science, and law sources; keep each at `link-only`. Add LBS MiM entry requirements at `https://www.london.edu/masters-degrees/masters-in-management/apply`. Mark old-cycle faculty PDFs as historical and exclude them from current folded evidence.

- [ ] **Step 4: Run focused tests and source coverage**

Run: `pnpm vitest run tests/catalog.test.ts tests/page-content.test.mjs tests/source-coverage.test.mjs && pnpm check:sources`

Expected: PASS or only live-network health failures explicitly attributable to an official server; schema and semantic tests must pass.

- [ ] **Step 5: Commit**

```text
fix: correct reviewed China institution rules
```

---

### Task 4: Extend registered HTML extraction for grouped and bilingual lists

**Files:**
- Create: `tests/fixtures/sources/html-grouped-lists.html`
- Create: `tests/fixtures/sources/html-bilingual-table.html`
- Modify: `scripts/extractors/html.mjs`
- Modify: `src/lib/types.ts`
- Modify: `src/data/sources.schema.json`
- Modify: `tests/extract-html.test.mjs`
- Modify: `tests/data.test.ts`

**Interfaces:**
- Adds parser mode: `html-grouped-items`.
- Adds parser fields: `groups`, `itemSelector`, `tableIndex`, `nameZhColumn`, `scoreColumns`, `splitOnBreaks`, and `institutionPattern`.
- Raw extractor rows may include `institutionOfficial`, `institutionNameZh`, `tierOfficial`, and `scoreOfficial`.

- [ ] **Step 1: Write failing Cambridge, Warwick, Nottingham, Southampton, Bristol, and Sheffield fixture tests**

Fixtures must exercise these exact structures:

- sibling Group A/Group B `<ul>` lists;
- table cells containing one institution per `<br>` with per-row score text;
- bilingual `<p>` entries in a tier cell;
- accordion sections where the button is the tier and list items are bilingual;
- one-column accepted-university tables;
- five-column bilingual lookup tables with separate 2:1 and 2:2 scores.

Expected literal rows must preserve the official English spelling and produce the correct Chinese name, tier, and combined score text.

- [ ] **Step 2: Run extractor tests and verify failure**

Run: `pnpm vitest run tests/extract-html.test.mjs tests/data.test.ts`

Expected: FAIL because grouped items and bilingual fields are unsupported.

- [ ] **Step 3: Implement the minimum generic extractor paths and schema validation**

Keep selectors registered in source data; do not infer headings globally. Convert `<br>` to row boundaries before text normalisation. Combine configured score columns as `2:1: …；2:2: …`. Reject missing configured columns or empty groups with parser-structure errors.

- [ ] **Step 4: Run extractor tests and verify pass**

Run: `pnpm vitest run tests/extract-html.test.mjs tests/data.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
feat: extract grouped official institution lists
```

---

### Task 5: Extend PDF extraction and guarded institution registration

**Files:**
- Modify: `scripts/extractors/pdf.mjs`
- Modify: `scripts/extractors/normalize.mjs`
- Modify: `scripts/sync-sources.mjs`
- Modify: `src/data/requirements.schema.json`
- Modify: `tests/extract-pdf.test.mjs`
- Modify: `tests/sync-sources.test.mjs`
- Modify: `tests/requirements.test.ts`

**Interfaces:**
- Raw PDF rows may include `institutionNameZh` and multiple score captures.
- Adds `reconcileInstitution(rawFact, institutions)` returning a matched or safely created canonical record.
- Bilingual parser sources may register new institutions only after the source update passes all guards.
- Bilingual provider sources are evaluated before English-only sources so canonical records exist independent of `sources.json` display order.

- [ ] **Step 1: Write failing bilingual PDF and registration tests**

Test a literal Glasgow-style line:

```text
Beihang University 北京航空航天大学 70% 65% A
```

Expected output is English `Beihang University`, Chinese `北京航空航天大学`, score `2:1: 70%；2:2: 65%`, tier `A`. Add sync tests proving a new bilingual institution is committed only after guard acceptance, while English-only unknown rows and rejected updates do not mutate `institutions.json`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm vitest run tests/extract-pdf.test.mjs tests/sync-sources.test.mjs tests/requirements.test.ts`

Expected: FAIL because bilingual registration is unsupported.

- [ ] **Step 3: Implement bilingual captures and guarded reconciliation**

Match exact normalised Chinese, English, and aliases first. Create a deterministic `cn-<16 hex>` ID only when both Chinese and English names are present and non-empty. Apply candidate institution additions atomically with accepted facts; unknown English-only names raise an extraction anomaly and preserve the previous trusted dataset.

Mark Sheffield, Glasgow, Nottingham, and Southampton as bilingual registry providers and process providers before other sources. Add a test where an English-only source appears first in input but still resolves a record supplied by a later bilingual provider.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `pnpm vitest run tests/extract-pdf.test.mjs tests/sync-sources.test.mjs tests/requirements.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
feat: reconcile bilingual official institutions
```

---

### Task 6: Register and synchronise every confirmed public university list

**Files:**
- Modify: `src/data/sources.json`
- Modify: `src/data/institutions.json`
- Modify: `src/data/generated/requirements.json`
- Modify: `src/data/generated/reverse-index.json`
- Modify: `src/data/status.json`
- Modify: `tests/catalog.test.ts`
- Modify: `tests/requirements.test.ts`
- Modify: `tests/reverse-index.test.mjs`

**Interfaces:**
- Consumes: registered HTML/PDF parsers from Tasks 4 and 5.
- Produces: structured facts for Cambridge, Warwick, Bristol, Glasgow, Nottingham, Sheffield, Southampton, UCL, and Edinburgh.

- [x] **Step 1: Write failing source-presence and record-floor tests**

Assert every public-list source is parser-enabled and has a conservative floor matching its official shape: Cambridge at least 80 rows, Warwick at least 250, Bristol at least 300, Glasgow at least 500, Nottingham taught list at least 150, Sheffield at least 2,800, Southampton at least 500, UCL 84, and Edinburgh 81.

- [x] **Step 2: Run catalog tests and verify failure**

Run: `pnpm vitest run tests/catalog.test.ts tests/requirements.test.ts tests/reverse-index.test.mjs`

Expected: FAIL because seven sources are still link-only or have no generated facts.

- [x] **Step 3: Configure exact official parsers**

Use:

- Cambridge `#China` Group A and Group B sibling lists;
- Warwick postgraduate table index 3 with four `<br>`-separated rows;
- Bristol `.table-filter tbody tr` column 0;
- Glasgow current 2026 accepted-list PDF with English, Chinese, 2:1, 2:2, and band captures;
- Nottingham first taught-master table with tier column 0 and bilingual `<p>` items in column 1;
- Sheffield main table columns 0–3;
- Southampton `section.accordion-item` button headings and `.copy ul > li` rows.

Each source must include reviewed rule text requirements and count/removal guards.

- [x] **Step 4: Run the guarded synchroniser against official sources**

Run: `pnpm sync:sources && pnpm build:index`

Expected: all nine public-list sources accepted; any provider-side block or mapping anomaly must retain previous facts and be resolved before publication rather than lowering a guard.

- [x] **Step 5: Run focused tests and inspect the coverage report**

Run: `pnpm vitest run tests/catalog.test.ts tests/requirements.test.ts tests/reverse-index.test.mjs && node scripts/report-source-coverage.mjs`

Expected: PASS, 29 directory institutions, 9 university-level public lists, and non-zero facts for every parser-enabled list source.

- [x] **Step 6: Commit**

```text
data: add all reviewed public China lists
```

Follow-up completed 2026-08-02: sync transactionality and Glasgow bilingual-PDF repairs are covered by regression tests and were persisted through a guarded synchronisation.

Second follow-up completed 2026-08-02: Glasgow Chinese-anchored registry migration removes historic parser fragments and carried aliases; only the reviewed Taizhou University and Wuyi University English collisions remain.

---

### Task 7: Present the new states and specialist ranking safely

**Files:**
- Create: `scripts/build-public-data.mjs`
- Create: `tests/public-data.test.mjs`
- Modify: `src/lib/presentation.ts`
- Modify: `src/lib/official-list-display.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/methodology.astro`
- Modify: `src/styles/global.css`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `tests/presentation.test.ts`
- Modify: `tests/page-content.test.mjs`
- Modify: `tests/official-list-display.test.ts`

**Interfaces:**
- Produces: `directoryRankCopy(university): string`, returning `QS <rank>` or `专业院校`.
- Produces: `public/generated/lists/<sourceId>.json` and `public/generated/reverse-index.json` during `prebuild`.
- Consumes: reviewed audit state, source rule summaries, and official list panels.

- [ ] **Step 1: Write failing copy and rendering tests**

Assert the page says “28 所 QS 2027 世界前 200 英国大学 + 1 所专业院校”, LBS renders “专业院校”, Manchester displays rule-only copy and all three official links, Exeter displays the 2026 uniform-rule summary, and all nine public-list schools expose either a safe fold or an explicit structure-pending official link. Assert the initial HTML contains panel metadata but not thousands of institution rows, each parser-enabled source produces one static list JSON, and the reverse index is absent from the initial client payload.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm vitest run tests/presentation.test.ts tests/page-content.test.mjs tests/official-list-display.test.ts tests/public-data.test.mjs`

Expected: FAIL for hard-coded 28/QS copy, LBS rank assumptions, stale state labels, and missing lazy public-data artifacts.

- [ ] **Step 3: Implement dynamic scope copy and corrected cards**

Keep the existing visual structure. Add the specialist badge, make reverse-search card titles rank-safe, show the rule summary before links, and retain the existing folded-list scope and unlisted-meaning warnings.

Generate one static JSON file per structured source. Render only source metadata, count, and a base-path-safe URL into the initial page. On the first `<details>` open event, fetch that source file, render its rows, and cache the completed panel in the DOM. Load `public/generated/reverse-index.json` only when the user switches to Chinese-institution mode. A failed fetch displays a retryable neutral message and preserves the official source link.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `pnpm vitest run tests/presentation.test.ts tests/page-content.test.mjs tests/official-list-display.test.ts tests/public-data.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
feat: present complete China rule coverage
```

---

### Task 8: Full verification, rendered QA, review, and publication

**Files:**
- Verify only; change files only for defects reproduced by a failing test.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified static build and a GitHub pull request.

- [ ] **Step 1: Run all automated verification fresh**

Run: `pnpm test:run && pnpm build && pnpm check:sources && node scripts/report-source-coverage.mjs`

Expected: 0 test failures, build exit 0, no integrity failures, and reviewed coverage counts of 28 QS + 1 specialist.

- [ ] **Step 2: Run Browser QA**

The flow under test is: local app loads -> search for LBS and Manchester -> inspect their corrected status -> search one Chinese institution -> expand at least one newly structured official list -> verify meaningful state changes with no console errors.

Check desktop and 320px mobile widths for page identity, meaningful content, no framework overlay, console health, screenshot evidence, fold interaction, search interaction, and horizontal overflow.

- [ ] **Step 3: Request code review**

Review the full diff from the pre-feature base through `HEAD` against the design spec. Fix all Critical and Important findings with failing tests before proceeding.

- [ ] **Step 4: Re-run full verification after review fixes**

Run: `pnpm test:run && pnpm build && node scripts/report-source-coverage.mjs`

Expected: PASS after the final diff.

- [ ] **Step 5: Publish intentionally**

Inspect `git status -sb` and `git diff --stat`, push the current feature branch, and open a draft pull request describing the audit correction, LBS, structured lists, and checks. Do not merge without an explicit user instruction.
