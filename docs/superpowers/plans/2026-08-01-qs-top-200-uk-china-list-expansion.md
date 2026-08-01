# QS Top 200 UK China List Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand 小英高校百科 from three sample universities into a QS 2027 top-200 UK directory with official-source extraction, conservative reverse search by Chinese undergraduate institution, and zero-server daily updates.

**Architecture:** Keep hand-curated university/source metadata separate from machine-generated facts and health status. Deterministic HTML/PDF adapters extract only registered official sources; a guarded sync pipeline publishes structurally valid changes and preserves the last trusted facts on anomalies. Astro builds a static dual-direction search experience from the normalized datasets, while GitHub Actions checks, tests, and deploys the exact verified commit.

**Tech Stack:** Node.js 22, TypeScript 6, Astro 7, Vitest 4, Fuse.js 7, AJV 8, Mozilla Readability, LinkeDOM, PDF.js, Lychee, GitHub Actions, GitHub Pages.

## Global Constraints

- Scope is every United Kingdom institution ranked 1–200 in the official QS World University Rankings 2027 published 18 June 2026.
- Facts may come only from public university-owned webpages and official university PDFs.
- Never output “可以申请” or “不能申请”; output evidence states only.
- A faculty-level list must never be presented as a university-wide rule.
- A missing institution in a public list must be labelled “官方公开 List 中暂未找到”, not rejected.
- Daily automation may update generated facts and health status, but must not rewrite editorial Chinese explanations.
- One temporary network or parser error must preserve the last trusted facts.
- Do not bypass logins, CAPTCHAs, paywalls, access controls, or technical blocks.
- Do not store full university webpages or PDFs; test fixtures must contain the smallest parsing fragment needed.
- No paid API, database, server, analytics service, domain, or runtime AI translation.
- Pin GitHub Actions to reviewed commit SHAs before merging.

---

## Planned File Structure

- `src/data/qs-2027-top-200-uk.json`: frozen QS cohort, rank facts, capture date, and official QS source URL.
- `src/data/universities.json`: hand-curated university names, aliases, neutral state, and source references.
- `src/data/sources.json`: official source registry and deterministic parser configuration.
- `src/data/institutions.json`: canonical Chinese institution names and verified aliases.
- `src/data/generated/requirements.json`: machine-generated trusted requirement facts.
- `src/data/generated/reverse-index.json`: build-generated Chinese-institution-to-UK-university evidence index.
- `src/data/status.json`: latest source health and freshness only.
- `src/data/*.schema.json`: AJV schemas for every hand-curated and generated data contract.
- `src/lib/types.ts`: shared contracts.
- `src/lib/data.ts`: schema-validated loaders and joins.
- `src/lib/institution-search.ts`: conservative Chinese institution normalization and lookup.
- `src/lib/evidence.ts`: evidence-state derivation with scope isolation.
- `scripts/extractors/html.mjs`: Readability and registered HTML table/list extraction.
- `scripts/extractors/pdf.mjs`: PDF.js text-layer extraction.
- `scripts/extractors/normalize.mjs`: deterministic fact normalization.
- `scripts/sync-sources.mjs`: serial fetch, extraction, guard evaluation, and atomic writes.
- `scripts/build-reverse-index.mjs`: static reverse-index generator.
- `scripts/report-source-coverage.mjs`: cohort/source/parser coverage report.
- `tests/fixtures/sources/`: minimal licensed parsing fragments.
- `tests/*.test.ts` and `tests/*.test.mjs`: data, parser, search, workflow, and regression tests.
- `src/pages/index.astro`: mode switch, dual search, and evidence results.
- `src/styles/global.css`: responsive dual-search/result styles.
- `.github/workflows/daily-check.yml`: guarded daily sync and anomaly Issue creation.

---

### Task 1: Freeze the Official QS Cohort and Source Registry Contract

**Files:**
- Create: `src/data/qs-2027-top-200-uk.json`
- Create: `src/data/sources.json`
- Create: `src/data/sources.schema.json`
- Modify: `src/lib/types.ts`
- Modify: `src/data/universities.schema.json`
- Test: `tests/catalog.test.ts`

**Interfaces:**
- Produces: `QsCohortEntry`, `OfficialSourceConfig`, `ParserConfig`, and the canonical target-university ID set.
- Consumes: the official QS 2027 UK-filtered ranking page at `https://www.topuniversities.com/world-university-rankings?countries=gb`.

- [ ] **Step 1: Record the official cohort facts**

Open the official QS page, apply United Kingdom and rank ≤200, and record only these facts for every matching row: `id`, `nameEn`, `rank`, `edition: 2027`, `country: "United Kingdom"`. Add top-level metadata:

```json
{
  "edition": 2027,
  "publishedAt": "2026-06-18",
  "capturedAt": "2026-08-01",
  "sourceUrl": "https://www.topuniversities.com/world-university-rankings?countries=gb",
  "universities": []
}
```

Do not use a third-party ranking table as the cohort source. QS states that corrections may occur after release, so `capturedAt` is required.

- [ ] **Step 2: Write the failing cohort and registry tests**

```ts
import cohort from '../src/data/qs-2027-top-200-uk.json';
import universities from '../src/data/universities.json';
import sources from '../src/data/sources.json';

it('freezes only the official QS 2027 UK top-200 cohort', () => {
  expect(cohort.edition).toBe(2027);
  expect(cohort.sourceUrl).toContain('topuniversities.com/world-university-rankings');
  expect(cohort.universities.length).toBeGreaterThan(20);
  expect(cohort.universities.every((item) => item.rank >= 1 && item.rank <= 200)).toBe(true);
  expect(new Set(cohort.universities.map((item) => item.id)).size).toBe(cohort.universities.length);
});

it('does not contain universities outside the frozen cohort', () => {
  const cohortIds = new Set(cohort.universities.map((item) => item.id));
  expect(universities.every((item) => cohortIds.has(item.id))).toBe(true);
});

it('references only explicitly registered official sources', () => {
  const sourceIds = new Set(sources.map((source) => source.id));
  expect(universities.flatMap((item) => item.sourceIds)
    .every((id) => sourceIds.has(id))).toBe(true);
});
```

- [ ] **Step 3: Run the tests and verify the missing contracts fail**

Run: `pnpm vitest run tests/catalog.test.ts`

Expected: FAIL because `qs-2027-top-200-uk.json`, `sources.json`, and `sourceIds` do not exist.

- [ ] **Step 4: Add the exact shared types**

```ts
export type SourceScope = 'university' | 'faculty' | 'programme';
export type ParserMode = 'html-table' | 'html-list' | 'pdf-text' | 'link-only';

export interface QsCohortEntry {
  id: string;
  nameEn: string;
  rank: number;
  edition: 2027;
  country: 'United Kingdom';
}

export interface ParserGuard {
  minimumRecords: number;
  maximumRecords: number;
  maximumRemovalRatio: number;
}

export interface ParserConfig {
  mode: ParserMode;
  selector?: string;
  rowSelector?: string;
  institutionColumn?: number;
  tierColumn?: number;
  scoreColumn?: number;
  headingPattern?: string;
  guard: ParserGuard;
}

export interface OfficialSourceConfig {
  id: string;
  universityId: string;
  labelZh: string;
  url: string;
  kind: SourceKind;
  scope: SourceScope;
  scopeZh: string;
  cycle?: string;
  parser: ParserConfig;
}
```

Change each university record from embedded `sources` to `sourceIds: string[]`, add `officialDomain: string`, and keep source status derived at load time.

- [ ] **Step 5: Add AJV schemas and migrate the existing source records**

The schema must reject unknown fields, non-HTTPS URLs, duplicate IDs, `maximumRemovalRatio` outside 0–1, and faculty/programme sources without non-empty `scopeZh`. Move the current Imperial source from `universities.json` into `sources.json`, replace embedded source arrays with `sourceIds`, and add the official university domain to each existing sample record. Task 5 expands these records to the full cohort.

- [ ] **Step 6: Run the focused tests**

Run: `pnpm vitest run tests/catalog.test.ts tests/data.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/qs-2027-top-200-uk.json src/data/sources.json src/data/sources.schema.json src/data/universities.json src/data/universities.schema.json src/lib/types.ts tests/catalog.test.ts tests/data.test.ts
git commit -m "feat: define the QS top 200 UK source catalog"
```

---

### Task 2: Add Normalized Requirement and Institution Contracts

**Files:**
- Create: `src/data/institutions.json`
- Create: `src/data/institutions.schema.json`
- Create: `src/data/generated/requirements.json`
- Create: `src/data/requirements.schema.json`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`
- Test: `tests/requirements.test.ts`

**Interfaces:**
- Produces: `RequirementFact`, `InstitutionRecord`, `validateRequirementData(input: unknown): boolean`, `loadRequirements()`, and `loadInstitutions()`.
- Consumes: `OfficialSourceConfig.id` and `University.id` from Task 1.

- [ ] **Step 1: Write failing schema and referential-integrity tests**

```ts
it('rejects facts without traceable scope, cycle, and source', () => {
  expect(validateRequirementData({
    id: 'bad', universityId: 'ucl', institutionId: 'peking-university',
  })).toBe(false);
});

it('requires every institution to have non-empty unique raw names', () => {
  const allNames = institutions.flatMap((item) => [item.nameZh, item.nameEn, ...item.aliases]);
  expect(allNames.every((name) => name.trim().length > 0)).toBe(true);
  expect(new Set(allNames).size).toBe(allNames.length);
});

it('requires every fact to reference registered records', () => {
  expect(requirements.every((fact) =>
    universityIds.has(fact.universityId) &&
    sourceIds.has(fact.sourceId) &&
    institutionIds.has(fact.institutionId),
  )).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run tests/requirements.test.ts`

Expected: FAIL because normalized contracts and loaders do not exist.

- [ ] **Step 3: Implement the exact contracts**

```ts
export type EvidenceState =
  | 'official-match'
  | 'faculty-match'
  | 'not-found-in-public-list'
  | 'no-public-list'
  | 'source-changed'
  | 'source-unavailable';

export interface InstitutionRecord {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
}

export interface RequirementFact {
  id: string;
  universityId: string;
  sourceId: string;
  institutionId: string;
  tierOfficial: string;
  tierZh?: string;
  scoreOfficial?: string;
  scope: SourceScope;
  scopeZh: string;
  cycle?: string;
  extractedAt: string;
  contentHash: string;
}
```

Implement loaders that validate JSON with AJV before returning typed arrays. Throw `DataValidationError` with dataset name and AJV paths; never silently drop invalid rows.

- [ ] **Step 4: Add empty valid generated datasets and schemas**

Use `[]` for initial institution and requirement arrays. Schemas must use `additionalProperties: false`, require traceability fields, and reject empty official tier/scope strings.

- [ ] **Step 5: Run focused and existing data tests**

Run: `pnpm vitest run tests/requirements.test.ts tests/data.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/institutions.json src/data/institutions.schema.json src/data/generated/requirements.json src/data/requirements.schema.json src/lib/types.ts src/lib/data.ts tests/requirements.test.ts tests/data.test.ts
git commit -m "feat: add traceable requirement fact contracts"
```

---

### Task 3: Build Deterministic HTML and PDF Extractors

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `scripts/extractors/html.mjs`
- Create: `scripts/extractors/pdf.mjs`
- Create: `scripts/extractors/normalize.mjs`
- Create: `tests/extract-html.test.mjs`
- Create: `tests/extract-pdf.test.mjs`
- Create: `tests/fixtures/sources/html-table.html`
- Create: `tests/fixtures/sources/html-list.html`
- Create: `tests/fixtures/sources/list-text-layer.pdf`

**Interfaces:**
- Produces: `extractHtmlFacts(config, html)`, `extractPdfFacts(config, bytes)`, and `normalizeExtractedFact(raw, context)`.
- Consumes: `OfficialSourceConfig.parser` from Task 1.

- [ ] **Step 1: Add failing HTML extractor tests**

```js
it('extracts only registered table columns', async () => {
  const facts = await extractHtmlFacts({
    mode: 'html-table', rowSelector: '#china-list tbody tr',
    institutionColumn: 0, tierColumn: 1, scoreColumn: 2,
  }, fixture);
  expect(facts).toEqual([
    { institutionOfficial: '示例大学', tierOfficial: 'Band A', scoreOfficial: '80%' },
  ]);
});

it('does not treat unrelated navigation text as a list', async () => {
  expect(await extractHtmlFacts({ mode: 'html-list', selector: '#requirements' }, navigationOnly))
    .toEqual([]);
});
```

- [ ] **Step 2: Add failing PDF extractor tests**

```js
it('extracts text-layer rows and preserves official tier wording', async () => {
  const facts = await extractPdfFacts(pdfConfig, fixtureBytes);
  expect(facts[0]).toMatchObject({ institutionOfficial: 'Example University', tierOfficial: 'Group 1' });
});

it('returns a typed no-text anomaly for scanned PDFs', async () => {
  await expect(extractPdfFacts(pdfConfig, scannedBytes)).rejects.toMatchObject({ code: 'PDF_NO_TEXT_LAYER' });
});
```

- [ ] **Step 3: Run tests and verify missing-module failures**

Run: `pnpm vitest run tests/extract-html.test.mjs tests/extract-pdf.test.mjs`

Expected: FAIL because extractor modules do not exist.

- [ ] **Step 4: Install reviewed open-source dependencies**

Run: `pnpm add @mozilla/readability linkedom pdfjs-dist`

Record exact resolved versions in `pnpm-lock.yaml`. Do not add Firecrawl, Playwright, changedetection.io, or an AI API.

- [ ] **Step 5: Implement minimal deterministic adapters**

`extractHtmlFacts` must use registered selectors/table mappings first. Readability may identify the main content container for `html-list`, but it must not infer columns, tiers, or scores.

`extractPdfFacts` must use `pdfjs-dist/legacy/build/pdf.mjs`, concatenate text items by page, and pass lines through registered heading/row patterns. It must throw errors with codes `PDF_NO_TEXT_LAYER`, `PARSER_EMPTY`, or `PARSER_STRUCTURE_CHANGED`.

- [ ] **Step 6: Normalize without translating**

`normalizeExtractedFact` must apply NFKC, collapse whitespace, normalize full-width punctuation, and preserve `tierOfficial`/`scoreOfficial` verbatim after whitespace cleanup. It must not invent `tierZh`.

- [ ] **Step 7: Run extractor tests**

Run: `pnpm vitest run tests/extract-html.test.mjs tests/extract-pdf.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/extractors tests/extract-html.test.mjs tests/extract-pdf.test.mjs tests/fixtures/sources
git commit -m "feat: extract registered HTML and PDF lists"
```

---

### Task 4: Implement Guarded Source Synchronisation

**Files:**
- Create: `scripts/sync-sources.mjs`
- Create: `scripts/update-guard.mjs`
- Modify: `scripts/source-checker.mjs`
- Modify: `scripts/check-sources.mjs`
- Modify: `package.json`
- Test: `tests/sync-sources.test.mjs`
- Test: `tests/check-sources.test.ts`

**Interfaces:**
- Produces: `decideSourceUpdate(previousFacts, nextFacts, guard)` and `syncRegisteredSources(options)`.
- Consumes: extractors from Task 3, source registry from Task 1, requirement schema from Task 2.

- [ ] **Step 1: Write failing guard tests**

```js
it('accepts a structurally valid small change', () => {
  expect(decideSourceUpdate(previous100, next102, {
    minimumRecords: 80, maximumRecords: 150, maximumRemovalRatio: 0.1,
  })).toEqual({ accepted: true, reason: 'valid-change' });
});

it('rejects mass removal and preserves trusted facts', () => {
  expect(decideSourceUpdate(previous100, next20, {
    minimumRecords: 80, maximumRecords: 150, maximumRemovalRatio: 0.1,
  })).toEqual({ accepted: false, reason: 'removal-ratio-exceeded' });
});

it('treats a temporary fetch error as status-only', async () => {
  const result = await syncRegisteredSources({ fetchImpl: rejectingFetch, now: fixedNow });
  expect(result.requirements).toEqual(previousRequirements);
  expect(result.status[sourceId].health).toBe('temporary-error');
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm vitest run tests/sync-sources.test.mjs tests/check-sources.test.ts`

Expected: FAIL because the guard and sync orchestrator do not exist.

- [ ] **Step 3: Implement guard decisions**

Reject when output is empty, below/above configured bounds, duplicates fact IDs, references a different university/source, or removes more than `maximumRemovalRatio`. Return stable reason codes for every rejection.

- [ ] **Step 4: Implement serial atomic sync**

Fetch one source at a time with a 600 ms minimum gap. Write candidate files to `.next`, validate them, then rename atomically. Accepted facts replace only facts from that source. Rejected facts leave `requirements.json` unchanged and write anomaly records to `artifacts/source-anomalies.json`.

- [ ] **Step 5: Add scripts**

```json
{
  "scripts": {
    "sync:sources": "node scripts/sync-sources.mjs",
    "check:sources": "node scripts/check-sources.mjs"
  }
}
```

- [ ] **Step 6: Run focused then full tests**

Run: `pnpm vitest run tests/sync-sources.test.mjs tests/check-sources.test.ts`

Run: `pnpm test:run`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/sync-sources.mjs scripts/update-guard.mjs scripts/source-checker.mjs scripts/check-sources.mjs package.json tests/sync-sources.test.mjs tests/check-sources.test.ts
git commit -m "feat: guard automatic source updates"
```

---

### Task 5: Populate the Complete UK Cohort and Official China Sources

**Files:**
- Modify: `src/data/universities.json`
- Modify: `src/data/sources.json`
- Modify: `src/data/institutions.json`
- Modify: `tests/catalog.test.ts`
- Create: `scripts/report-source-coverage.mjs`
- Test: `tests/source-coverage.test.mjs`

**Interfaces:**
- Produces: complete directory coverage and one traceable current official China-entry source or explicit no-public-list evidence per cohort member.
- Consumes: cohort and source contracts from Tasks 1–2.

- [ ] **Step 1: Write the failing coverage test**

```js
it('covers every target university with official China-entry evidence', () => {
  expect(universities.map((item) => item.id).sort())
    .toEqual(cohort.universities.map((item) => item.id).sort());
  for (const university of universities) {
    const registered = sources.filter((source) => source.universityId === university.id);
    expect(registered.length, university.id).toBeGreaterThan(0);
    expect(registered.some((source) => new URL(source.url).hostname.endsWith(university.officialDomain)))
      .toBe(true);
  }
});

it('does not leave sample pending records in the public catalog', () => {
  expect(universities.filter((item) => item.state === 'pending')).toEqual([]);
});
```

- [ ] **Step 2: Run the coverage test and verify failure**

Run: `pnpm vitest run tests/source-coverage.test.mjs tests/catalog.test.ts`

Expected: FAIL for every cohort member not yet present or lacking an official source.

- [ ] **Step 3: Research sources in rank order**

For each cohort member, search the university-owned domain for current postgraduate entry requirements for China, then for university/faculty List pages or PDFs. Record the exact scope and cycle stated by the university. If no public List is found after checking the international-entry page and linked faculty admissions pages, set `state: "not-public"` but still register the official China-entry page as `link-only`.

Never use agency, forum, social-media, cached-copy, or admissions-blog content as a fact source.

- [ ] **Step 4: Configure parsers only where deterministic**

Use `html-table`, `html-list`, or `pdf-text` only when a stable official structure exists and the minimal fixture passes. Use `link-only` when the page gives general requirements, blocks automation, or cannot be deterministically parsed.

- [ ] **Step 5: Add a coverage report**

`node scripts/report-source-coverage.mjs` must print counts for cohort universities, full public lists, faculty-only lists, no-public-list records, parser-enabled sources, and link-only sources. It must exit non-zero for missing universities, missing official sources, duplicate source IDs, or unregistered domains.

- [ ] **Step 6: Run data, coverage, and source checks**

Run: `pnpm vitest run tests/catalog.test.ts tests/source-coverage.test.mjs tests/data.test.ts`

Run: `node scripts/report-source-coverage.mjs`

Expected: PASS and zero missing cohort/source records.

- [ ] **Step 7: Commit**

```bash
git add src/data/universities.json src/data/sources.json src/data/institutions.json scripts/report-source-coverage.mjs tests/catalog.test.ts tests/source-coverage.test.mjs
git commit -m "data: cover QS top 200 UK universities"
```

---

### Task 6: Build Conservative Institution Matching and Reverse Evidence

**Files:**
- Create: `src/lib/institution-search.ts`
- Create: `src/lib/evidence.ts`
- Create: `scripts/build-reverse-index.mjs`
- Create: `src/data/generated/reverse-index.json`
- Modify: `package.json`
- Test: `tests/institution-search.test.ts`
- Test: `tests/evidence.test.ts`

**Interfaces:**
- Produces: `normalizeInstitutionName(name)`, `createInstitutionSearch(records)`, `deriveEvidence(input)`, and generated `ReverseIndexEntry[]`.
- Consumes: institutions, requirements, universities, source status, and scope from Tasks 1–5.

- [ ] **Step 1: Write failing normalization and alias tests**

```ts
it.each([
  ['  北京大学 ', '北京大学'],
  ['Ｐｅｋｉｎｇ　Ｕｎｉｖｅｒｓｉｔｙ', 'peking university'],
])('normalizes %s conservatively', (input, expected) => {
  expect(normalizeInstitutionName(input)).toBe(expected);
});

it('prefers exact aliases and never merges two canonical schools', () => {
  expect(search.find('北大').map((item) => item.id)).toEqual(['peking-university']);
  expect(() => createInstitutionSearch(conflictingAliases)).toThrow('ALIAS_CONFLICT');
});
```

- [ ] **Step 2: Write failing evidence-state tests**

```ts
it('isolates faculty matches from university-wide matches', () => {
  expect(deriveEvidence({ fact: facultyFact, source: facultySource, status: ok }))
    .toMatchObject({ state: 'faculty-match', scopeZh: '商学院' });
});

it('does not turn absence into rejection', () => {
  expect(deriveEvidence({ fact: undefined, source: publicList, status: ok }).state)
    .toBe('not-found-in-public-list');
});

it('prefers source anomalies over stale negative results', () => {
  expect(deriveEvidence({ fact: undefined, source: publicList, status: changed }).state)
    .toBe('source-changed');
});
```

- [ ] **Step 3: Run focused tests and verify failure**

Run: `pnpm vitest run tests/institution-search.test.ts tests/evidence.test.ts`

Expected: FAIL because search/evidence functions do not exist.

- [ ] **Step 4: Implement conservative search and evidence precedence**

Normalize NFKC, case, whitespace, and punctuation only. Fuzzy matches may suggest institutions in the chooser, but reverse evidence must run only after one canonical `institutionId` is selected.

Evidence precedence is: `source-changed` → `source-unavailable` → explicit full-list match → faculty match → not found in a healthy public list → no public list.

- [ ] **Step 5: Generate the reverse index**

Each positive `ReverseIndexEntry` must include `institutionId`, `universityId`, `evidenceState`, `tierOfficial`, optional `scoreOfficial`, `scopeZh`, `cycle`, `sourceId`, and `lastSuccessfulAt`. Do not materialize every negative institution/university pair. At query time, join the selected canonical institution’s positive facts against the full university catalog and call `deriveEvidence` to produce `not-found-in-public-list`, `no-public-list`, `source-changed`, or `source-unavailable` results.

Add `"build:index": "node scripts/build-reverse-index.mjs"` and `"prebuild": "pnpm build:index"` so every Astro build verifies and regenerates the static index.

- [ ] **Step 6: Run focused and full tests**

Run: `pnpm vitest run tests/institution-search.test.ts tests/evidence.test.ts`

Run: `pnpm test:run`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/institution-search.ts src/lib/evidence.ts scripts/build-reverse-index.mjs src/data/generated/reverse-index.json package.json tests/institution-search.test.ts tests/evidence.test.ts
git commit -m "feat: add conservative institution evidence search"
```

---

### Task 7: Add the Dual-Direction Search Interface

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Modify: `src/lib/search.ts`
- Modify: `src/lib/presentation.ts`
- Test: `tests/search.test.ts`
- Test: `tests/presentation.test.ts`
- Create: `tests/page-content.test.mjs`

**Interfaces:**
- Produces: an accessible mode switch with `uk-university` and `chinese-institution` modes and evidence-result rendering.
- Consumes: university search and reverse-index APIs from Task 6.

- [ ] **Step 1: Write failing page-copy and mode tests**

```js
it('renders two explicit search modes', () => {
  expect(source).toContain('data-search-mode="uk-university"');
  expect(source).toContain('data-search-mode="chinese-institution"');
  expect(source).toContain('查英国大学');
  expect(source).toContain('查中国本科院校');
});

it('contains no admissions eligibility claims', () => {
  expect(source).not.toMatch(/可以申请|不能申请|保底|冲刺/);
});
```

- [ ] **Step 2: Extend search tests for both modes**

Test exact Chinese/English/alias matches, ambiguous fuzzy suggestions, evidence sorting by QS rank, faculty scope labels, empty results, and status precedence.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `pnpm vitest run tests/search.test.ts tests/presentation.test.ts tests/page-content.test.mjs`

Expected: FAIL because the page has one UK-university-only search box.

- [ ] **Step 4: Implement one visible search panel with two tabs**

Use two real buttons with `aria-pressed`; switching mode changes label, placeholder, help text, and result template. Preserve the current UK directory table. Chinese-institution mode first asks the user to choose one canonical institution result, then renders UK evidence cards sorted by QS rank.

- [ ] **Step 5: Render evidence, traceability, and freshness**

Each evidence card must show neutral state copy, official tier/score when present, scope, cycle, last successful check date, and official link. “公开 List 中暂未找到” and “未发现公开 List” must have separate descriptions.

- [ ] **Step 6: Add responsive and keyboard styles**

At widths below 760 px, evidence cards stack labels above values. Tabs and results must have visible focus states, `aria-live` result counts, and no horizontal page overflow at 320 px.

- [ ] **Step 7: Run tests and Astro checks**

Run: `pnpm vitest run tests/search.test.ts tests/presentation.test.ts tests/page-content.test.mjs`

Run: `pnpm build`

Expected: PASS, 0 Astro errors/warnings/hints, and two static pages built.

- [ ] **Step 8: Commit**

```bash
git add src/pages/index.astro src/styles/global.css src/lib/search.ts src/lib/presentation.ts tests/search.test.ts tests/presentation.test.ts tests/page-content.test.mjs
git commit -m "feat: add dual UK and Chinese institution search"
```

---

### Task 8: Automate Link Checks, Safe Updates, and Anomaly Issues

**Files:**
- Modify: `.github/workflows/daily-check.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy.yml`
- Modify: `tests/workflows.test.mjs`
- Create: `.lychee.toml`
- Create: `scripts/render-anomaly-issue.mjs`
- Test: `tests/anomaly-issue.test.mjs`

**Interfaces:**
- Produces: daily link/sync workflow, deterministic anomaly Issue body, and verified-commit deployment.
- Consumes: `sync:sources`, `build:index`, and `artifacts/source-anomalies.json` from Tasks 4 and 6.

- [ ] **Step 1: Write failing workflow security tests**

```js
it('grants issue write only to the daily check', () => {
  expect(dailyWorkflow).toContain('issues: write');
  expect(ciWorkflow).not.toContain('issues: write');
});

it('runs link check, guarded sync, index build, and tests before commit', () => {
  for (const command of ['lychee', 'pnpm sync:sources', 'pnpm build:index', 'pnpm test:run']) {
    expect(dailyWorkflow).toContain(command);
  }
});

it('still deploys the exact CI-tested revision', () => {
  expect(deployWorkflow).toContain('ref: ${{ github.event.workflow_run.head_sha }}');
});
```

- [ ] **Step 2: Write the failing anomaly Issue renderer test**

```js
it('renders stable source, URL, reason, and retained-data language', () => {
  expect(renderAnomalyIssue(anomaly)).toContain('removal-ratio-exceeded');
  expect(renderAnomalyIssue(anomaly)).toContain(anomaly.sourceUrl);
  expect(renderAnomalyIssue(anomaly)).toContain('上一版可信数据已保留');
});
```

- [ ] **Step 3: Run focused tests and verify failure**

Run: `pnpm vitest run tests/workflows.test.mjs tests/anomaly-issue.test.mjs`

Expected: FAIL because daily sync, Lychee, and anomaly rendering are absent.

- [ ] **Step 4: Configure Lychee conservatively**

Check only registered public HTTP(S) source URLs. Set timeout/retry/user-agent, exclude localhost and GitHub edit links, and do not treat one transient 429/5xx response as permission to delete data.

- [ ] **Step 5: Update the daily workflow**

Keep `cron: '17 3 * * *'`, serial concurrency, Node 22, frozen lockfile, and 600 ms source gap. Run Lychee, guarded sync, reverse-index build, tests, and build. Commit only `status.json` and accepted generated datasets. If anomalies exist, create or update one Issue keyed by source ID; do not commit rejected facts.

- [ ] **Step 6: Preserve verified deployment semantics**

CI must run data/index consistency tests. Deploy must retain both the successful conclusion check and `head_sha == github.sha`, and checkout `workflow_run.head_sha`.

- [ ] **Step 7: Run workflow and full tests**

Run: `pnpm vitest run tests/workflows.test.mjs tests/anomaly-issue.test.mjs`

Run: `pnpm test:run && pnpm build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows .lychee.toml scripts/render-anomaly-issue.mjs tests/workflows.test.mjs tests/anomaly-issue.test.mjs
git commit -m "ci: automate guarded official-source updates"
```

---

### Task 9: Document Methodology and Perform End-to-End Release Verification

**Files:**
- Modify: `src/pages/methodology.astro`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `tests/page-content.test.mjs`

**Interfaces:**
- Produces: user-facing methodology, maintainer instructions, and release evidence.
- Consumes: all previous tasks.

- [ ] **Step 1: Write failing methodology-copy tests**

```js
it('discloses automated extraction and its limits', () => {
  expect(methodology).toContain('自动提取');
  expect(methodology).toContain('不代表不能申请');
  expect(methodology).toContain('最近成功检查');
  expect(methodology).toContain('部分学院');
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `pnpm vitest run tests/page-content.test.mjs`

Expected: FAIL until methodology and contribution guidance describe the new pipeline.

- [ ] **Step 3: Update documentation**

Explain the QS cohort date, evidence states, source scope, automatic extraction, anomaly fallback, daily frequency, correction process, official-source-only rule, and zero-cost dependency boundary. Document how contributors add a university source, minimal fixture, parser guard, institution alias, and test.

- [ ] **Step 4: Run fresh local verification**

Run: `pnpm test:run`

Run: `pnpm build`

Run: `node scripts/report-source-coverage.mjs`

Expected: all tests pass; Astro reports 0 errors/warnings/hints; two static pages build; coverage reports zero missing cohort/source records.

- [ ] **Step 5: Run local browser QA**

Verify at desktop and 320 px width: both search modes, exact Chinese institution selection, evidence sorting, faculty scope, no-list status, methodology/correction links, keyboard focus, and no console errors. Capture the final public view only if the visual layout changed materially.

- [ ] **Step 6: Commit documentation**

```bash
git add src/pages/methodology.astro README.md CONTRIBUTING.md tests/page-content.test.mjs
git commit -m "docs: explain official-source evidence and automation"
```

- [ ] **Step 7: Publish and verify GitHub Actions**

Push the reviewed commits to `main`. Confirm CI succeeds for the pushed SHA, the dependent Pages workflow checks out the same SHA, and daily workflow permissions remain limited to contents/issues write.

- [ ] **Step 8: Verify the public site with a cache-busting query**

Confirm the production page shows the complete target cohort, neutral evidence copy, source dates, correct GitHub Pages subpaths, functional reverse search, and no browser console errors. Rebuild the source ZIP from the final verified local HEAD.

---

## Plan Self-Review Checklist

- [x] Every confirmed design requirement maps to at least one task above.
- [x] All shared types and function signatures are defined before consumers use them.
- [x] No task relies on runtime AI, a paid service, or a persistent server.
- [x] Every code task starts with a failing test and ends with focused/full verification plus a commit.
- [x] Source anomalies preserve trusted data and create actionable evidence.
- [x] Faculty scope and missing-list language cannot be confused with full-university eligibility.
- [x] GitHub Pages remains bound to the exact CI-tested commit.
