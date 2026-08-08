# Full UK QS Directory with THE Rankings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand 小英高校百科 from the 28 QS 2027 top-200 UK universities plus LBS to every UK institution in QS World University Rankings 2027, add THE World University Rankings 2026 as secondary information, and preserve the existing China-institution evidence experience and safe daily review.

**Architecture:** Keep stable university identity, ranking releases, China-rule facts, and source-audit state as separate datasets. Join them in `src/lib/data.ts`, sort and search through pure functions in `src/lib/search.ts`, and render QS/THE as compact secondary fields in the existing Astro directory without replacing the current institution-search and folded-list interfaces. Rankings are curated annual snapshots; the daily workflow checks registered university sources only and never rewrites accepted requirement facts.

**Tech Stack:** Astro 7, TypeScript 6, Vitest 4, AJV 8, Fuse.js 7, Node.js 22, pnpm 10, GitHub Actions, GitHub Pages.

## Global Constraints

- The implementation baseline is QS World University Rankings 2027 and THE World University Rankings 2026.
- The main directory is the complete UK subset of QS 2027; THE-only institutions do not enter the main directory.
- LBS remains a `specialist` entry, is excluded from overall-ranking sorting, and shows QS Business & Management Studies 2026 rank 9 only as a specialist reference.
- China-institution rules, evidence states, source links, folded official lists, bilingual search, and the current visual identity must remain available.
- “Not found”, “unranked”, and “unverified” are distinct states; none may be converted into an application-eligibility conclusion.
- Ranking data updates annually and is excluded from the daily source-check workflow.
- Daily source checks may update source-review status but may not rewrite `src/data/generated/requirements.json`, `src/data/institutions.json`, or `src/data/generated/reverse-index.json`.
- Do not bypass login, CAPTCHA, paywalls, registration gates, robots rules, or technical access controls.
- Store only the minimum ranking facts, edition, attribution, verification date, and official source URL; do not mirror complete ranking pages or downloaded workbooks.
- Do not add a paid API, server, database, translation service, or AI runtime.
- Build and deployment must remain fully hosted by GitHub; the user's computer is not required after merge.

---

## File Structure

### New files

- `src/data/rankings.json` — versioned QS/THE releases and minimal per-university placement records.
- `src/data/rankings.schema.json` — JSON Schema for release metadata and ranking records.
- `tests/rankings.test.ts` — ranking schema, reference, uniqueness, coverage, and display-state tests.
- `docs/data/ranking-sources.md` — provenance, attribution, permitted acquisition route, and annual refresh procedure.

### Modified files

- `src/lib/types.ts` — directory, ranking, specialist-reference, and joined-record types.
- `src/lib/data.ts` — ranking validation and joins with universities, official sources, and source status.
- `src/data/universities.json` — complete QS 2027 UK directory plus LBS; no embedded overall rank.
- `src/data/universities.schema.json` — stable directory membership fields and specialist constraints.
- `src/data/china-rule-audit.json` — one review-state row for every expanded directory entry.
- `src/data/china-rule-audit.schema.json` — renamed `qs-directory` category.
- `src/lib/presentation.ts` — QS/THE display copy and specialist-reference copy.
- `src/lib/search.ts` — QS, THE, and name sort modes while retaining evidence search.
- `src/pages/index.astro` — range copy, dual ranking cells, sort control, and LBS specialist reference.
- `src/styles/global.css` — desktop six-column directory and mobile ranking badges.
- `scripts/build-public-data.mjs` — include joined ranking fields needed by client-side evidence results.
- `scripts/source-checker.mjs` — accepted vs observed content hashes and three-failure threshold.
- `scripts/check-sources.mjs` — write an audit artifact every run but only persist meaningful source-state transitions.
- `.github/workflows/daily-check.yml` — remove automatic requirement synchronization and commit only guarded status transitions.
- `src/pages/methodology.astro` — ranking scope, years, attribution, refresh schedule, and daily-review explanation.
- Existing tests under `tests/` — remove fixed 29-card assumptions and add regression coverage for rankings and daily review.

---

### Task 1: Introduce the Separate Ranking Domain and Migrate the Existing 29 Entries

**Files:**
- Create: `src/data/rankings.json`
- Create: `src/data/rankings.schema.json`
- Create: `tests/rankings.test.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`
- Modify: `src/data/universities.json`
- Modify: `src/data/universities.schema.json`
- Modify: `src/data/china-rule-audit.schema.json`
- Modify: `tests/data.test.ts`
- Modify: `tests/catalog.test.ts`

**Interfaces:**
- Produces: `RankingDataset`, `RankingRelease`, `RankingRecord`, `RankingProvider`, `RankingPlacement`, `DirectorySort`, `loadRankings()`, and joined `UniversityWithStatus.rankings`.
- Consumes: existing `University`, `OfficialSourceConfig`, `SourceStatus`, and AJV validation patterns.

- [ ] **Step 1: Write failing ranking-domain tests**

Add tests that define the required types through runtime behavior:

```ts
import { describe, expect, it } from 'vitest';
import { joinUniversityRankings, validateRankings } from '../src/lib/data';
import type { RankingDataset, UniversityWithStatus } from '../src/lib/types';

const dataset: RankingDataset = {
  releases: [{
    provider: 'qs',
    rankingName: 'QS World University Rankings',
    edition: 2027,
    country: 'United Kingdom',
    sourceUrl: 'https://www.topuniversities.com/world-university-rankings?countries=gb',
    attribution: 'QS World University Rankings 2027',
    verifiedAt: '2026-08-08',
  }],
  records: [{
    universityId: 'imperial-college-london',
    provider: 'qs',
    edition: 2027,
    placement: 'tied',
    displayRank: '=2',
    sortRank: 2,
  }],
};

describe('ranking data', () => {
  it('accepts a minimal attributed release and a tied placement', () => {
    expect(validateRankings(dataset)).toEqual(dataset);
  });

  it('rejects duplicate university/provider/edition records', () => {
    expect(() => validateRankings({ ...dataset, records: [...dataset.records, ...dataset.records] }))
      .toThrow(/duplicate ranking record/i);
  });

  it('joins ranking records without mutating the university record', () => {
    const university = {
      id: 'imperial-college-london',
      nameZh: '帝国理工学院',
      nameEn: 'Imperial College London',
      aliases: ['ICL'],
      directoryCategory: 'qs-directory',
      qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true },
      state: 'official-list',
      officialDomain: 'https://www.imperial.ac.uk',
      sources: [],
      rankings: {},
    } satisfies UniversityWithStatus;
    expect(joinUniversityRankings([university], dataset.records)[0].rankings.qs?.displayRank).toBe('=2');
    expect(university).not.toHaveProperty('rankings.qs');
  });
});
```

- [ ] **Step 2: Run the new test and confirm the domain does not exist yet**

Run: `pnpm vitest run tests/rankings.test.ts`

Expected: FAIL because `RankingDataset`, `validateRankings`, and `joinUniversityRankings` are not defined.

- [ ] **Step 3: Add ranking and stable-directory types**

Replace `DirectoryCategory = 'qs-top-200' | 'specialist'` and the embedded `University.qs` field with:

```ts
export type DirectoryCategory = 'qs-directory' | 'specialist';
export type RankingProvider = 'qs' | 'the';
export type RankingPlacement = 'exact' | 'tied' | 'band' | 'unranked' | 'unverified';
export type DirectorySort = 'qs' | 'the' | 'name';

export interface RankingRelease {
  provider: RankingProvider;
  rankingName: string;
  edition: number;
  country: 'United Kingdom';
  sourceUrl: string;
  attribution: string;
  verifiedAt: string;
}

export interface RankingRecord {
  universityId: string;
  provider: RankingProvider;
  edition: number;
  placement: RankingPlacement;
  displayRank?: string;
  sortRank?: number;
}

export interface RankingDataset {
  releases: RankingRelease[];
  records: RankingRecord[];
}

export interface SpecialistRankingReference {
  provider: 'qs';
  rankingName: 'QS WUR Ranking By Subject';
  subjectZh: '商业与管理';
  edition: 2026;
  displayRank: '9';
  sourceUrl: string;
}

export interface QsDirectoryMembership {
  firstEdition: number;
  verifiedEdition: number;
  current: boolean;
}
```

Update `University` so `qs-directory` records use `qsDirectory`, specialists may use `specialistRanking`, and `UniversityWithStatus` always has `rankings: Partial<Record<RankingProvider, RankingRecord>>` after loading.

- [ ] **Step 4: Add the schema and validators**

`rankings.schema.json` must enforce HTTPS release URLs, ISO dates, allowed placement values, positive editions, nonblank display strings, and positive numeric sort ranks. In `validateRankings()` add cross-record checks that JSON Schema cannot express:

```ts
const releaseKeys = new Set(dataset.releases.map((item) => `${item.provider}:${item.edition}`));
const recordKeys = dataset.records.map((item) => `${item.universityId}:${item.provider}:${item.edition}`);
if (new Set(recordKeys).size !== recordKeys.length) {
  throw new DataValidationError('Ranking', ['/ duplicate ranking record']);
}
for (const record of dataset.records) {
  if (!releaseKeys.has(`${record.provider}:${record.edition}`)) {
    throw new DataValidationError('Ranking', [`/${record.universityId} references an unregistered release`]);
  }
  const ranked = ['exact', 'tied', 'band'].includes(record.placement);
  if (ranked !== Boolean(record.displayRank && record.sortRank)) {
    throw new DataValidationError('Ranking', [`/${record.universityId} has inconsistent placement fields`]);
  }
}
```

Add `joinUniversityRankings()` and call it from `loadUniversities()` after source statuses have been joined.

- [ ] **Step 5: Mechanically migrate the existing 28 QS records**

For every current `qs-top-200` university, remove the embedded `qs` object, rename the category to `qs-directory`, add `qsDirectory`, and move its QS rank into `rankings.json`. Preserve current IDs, names, aliases, states, domains, and source IDs. Use this exact record form for Imperial and the same field rules for the other 27 existing entries:

```json
{
  "universityId": "imperial-college-london",
  "provider": "qs",
  "edition": 2027,
  "placement": "tied",
  "displayRank": "=2",
  "sortRank": 2
}
```

Keep LBS as `specialist`, add the approved `specialistRanking` object with the official QS profile URL, and do not create an overall QS/THE record for it.

- [ ] **Step 6: Update catalog and data tests for the migrated model**

Replace assertions against `university.qs.rank` with `university.rankings.qs`, keep the temporary count at 28 QS-directory records plus LBS, and assert that every QS-directory member has one current QS 2027 record.

- [ ] **Step 7: Run the focused and full data suites**

Run: `pnpm vitest run tests/rankings.test.ts tests/data.test.ts tests/catalog.test.ts`

Expected: PASS with 28 `qs-directory` universities and one `specialist` before catalog expansion.

- [ ] **Step 8: Commit the ranking-domain migration**

```bash
git add src/lib/types.ts src/lib/data.ts src/data/rankings.json src/data/rankings.schema.json src/data/universities.json src/data/universities.schema.json src/data/china-rule-audit.schema.json tests/rankings.test.ts tests/data.test.ts tests/catalog.test.ts
git commit -m "refactor: separate university identity from rankings"
```

---

### Task 2: Populate the Complete QS 2027 UK Directory and THE 2026 Overlay

**Files:**
- Create: `docs/data/ranking-sources.md`
- Modify: `src/data/rankings.json`
- Modify: `src/data/universities.json`
- Modify: `src/data/china-rule-audit.json`
- Modify: `tests/rankings.test.ts`
- Modify: `tests/catalog.test.ts`
- Modify: `tests/search.test.ts`

**Interfaces:**
- Consumes: `RankingDataset`, `University.qsDirectory`, `validateRankings()`, and `loadUniversities()` from Task 1.
- Produces: the complete QS 2027 UK main-directory dataset and one explicit THE 2026 state for every main-directory university.

- [ ] **Step 1: Add failing completeness and reference-integrity tests**

```ts
it('makes the QS 2027 UK snapshot and the main directory the same set', () => {
  const universities = loadUniversities();
  const qsDirectoryIds = universities
    .filter((item) => item.directoryCategory === 'qs-directory' && item.qsDirectory.current)
    .map((item) => item.id)
    .sort();
  const qsSnapshotIds = rankingData.records
    .filter((item) => item.provider === 'qs' && item.edition === 2027 && item.placement !== 'unranked' && item.placement !== 'unverified')
    .map((item) => item.universityId)
    .sort();
  expect(qsDirectoryIds).toEqual(qsSnapshotIds);
  expect(qsDirectoryIds.length).toBeGreaterThan(28);
});

it('gives every QS-directory university one THE 2026 state', () => {
  const universities = loadUniversities().filter((item) => item.directoryCategory === 'qs-directory');
  expect(universities.every((item) => item.rankings.the?.edition === 2026)).toBe(true);
});

it('keeps LBS outside both overall ranking snapshots', () => {
  const lbs = loadUniversities().find((item) => item.id === 'london-business-school');
  expect(lbs?.rankings).toEqual({});
  expect(lbs?.specialistRanking).toMatchObject({ edition: 2026, displayRank: '9' });
});
```

- [ ] **Step 2: Run completeness tests and confirm the old 28-school scope fails**

Run: `pnpm vitest run tests/rankings.test.ts tests/catalog.test.ts`

Expected: FAIL on `toBeGreaterThan(28)` and missing THE 2026 states.

- [ ] **Step 3: Record ranking provenance before transcribing facts**

Create `docs/data/ranking-sources.md` with these exact official sources and rules:

```markdown
# Ranking data provenance

## QS World University Rankings 2027
- UK-filtered source: https://www.topuniversities.com/world-university-rankings?countries=gb
- Published: 2026-06-18
- Stored fields: institution identity, displayed placement, sortable lower bound, edition, attribution, verification date
- Access rule: use the public table or an official export obtained through its normal permitted route; do not bypass registration or access controls

## Times Higher Education World University Rankings 2026
- UK table: https://www.timeshighereducation.com/student/best-universities/best-universities-UK
- Full ranking: https://www.timeshighereducation.com/world-university-rankings/latest/world-ranking
- Attribution: Times Higher Education World University Rankings 2026
- Stored fields: institution identity, displayed placement or official band, sortable lower bound, edition, attribution, verification date

## Annual refresh
Rankings are updated only when a new edition is released. Each update is reviewed as one versioned data change and never runs in the daily university-source workflow.
```

- [ ] **Step 4: Expand the stable university catalog from the official QS UK snapshot**

For each UK institution in the permitted QS 2027 source, create or reuse one stable ID. Existing records retain all China-rule data. New records use their verified Chinese name, official English name, common aliases, HTTPS official domain, `directoryCategory: "qs-directory"`, `qsDirectory.current: true`, `state: "pending"`, empty `sourceIds`, and a neutral note explaining that China-specific rules are awaiting source review.

Do not infer missing institutions from THE. Do not create a second record for a renamed institution; add the former name to `aliases`.

- [ ] **Step 5: Add one QS placement and one THE state per main-directory university**

Transcribe official display strings exactly: `=42` stays tied, `201–250` stays a band, and the lower bound becomes `sortRank`. If a QS-directory university does not appear in THE 2026, add a `RankingRecord` using that university's real stable ID, `provider: "the"`, `edition: 2026`, and `placement: "unranked"`; omit `displayRank` and `sortRank` because the official table provides neither.

If the official source cannot be confidently matched by institution identity, use `"placement": "unverified"` rather than guessing. No QS-directory university may omit its THE state.

- [ ] **Step 6: Extend the China-rule audit without inventing conclusions**

Add one `china-rule-audit.json` row for every newly introduced university. Use `expectedState: "pending"` until an official university or faculty source has actually been reviewed. Existing audit findings remain unchanged.

- [ ] **Step 7: Replace fixed-card-count tests with catalog-derived expectations**

In production institution-evidence tests, replace `toHaveLength(29)` with:

```ts
expect(result.cards).toHaveLength(loadUniversities().length);
```

Add a test asserting every audit row references a university and every university has exactly one audit row.

- [ ] **Step 8: Run data, catalog, ranking, and search suites**

Run: `pnpm vitest run tests/rankings.test.ts tests/catalog.test.ts tests/data.test.ts tests/search.test.ts tests/source-coverage.test.mjs`

Expected: PASS; the QS-directory count is greater than 28, the QS snapshot set is identical to the main-directory set, and each main-directory university has a THE 2026 state.

- [ ] **Step 9: Commit the complete annual ranking snapshot**

```bash
git add docs/data/ranking-sources.md src/data/rankings.json src/data/universities.json src/data/china-rule-audit.json tests/rankings.test.ts tests/catalog.test.ts tests/search.test.ts
git commit -m "feat: add complete QS UK directory and THE overlay"
```

---

### Task 3: Add Ranking Presentation and Deterministic Sorting

**Files:**
- Modify: `src/lib/presentation.ts`
- Modify: `src/lib/search.ts`
- Modify: `tests/presentation.test.ts`
- Modify: `tests/search.test.ts`

**Interfaces:**
- Consumes: `RankingRecord`, `RankingProvider`, `DirectorySort`, and joined `UniversityWithStatus.rankings`.
- Produces: `rankingCopy()`, `compareDirectoryUniversities(left, right, sortBy)`, and `createUniversitySearch().search(query, states, sortBy)`.

- [ ] **Step 1: Write failing display and sort tests**

```ts
const rankedUniversity = (
  id: string,
  nameEn: string,
  the: RankingRecord | undefined,
  directoryCategory: DirectoryCategory = 'qs-directory',
): UniversityWithStatus => ({
  id,
  nameZh: nameEn,
  nameEn,
  aliases: [],
  directoryCategory,
  ...(directoryCategory === 'qs-directory'
    ? { qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true } }
    : {}),
  state: 'pending',
  officialDomain: `https://${id}.example.test`,
  sources: [],
  rankings: directoryCategory === 'qs-directory'
    ? {
        qs: { universityId: id, provider: 'qs', edition: 2027, placement: 'exact', displayRank: '100', sortRank: 100 },
        ...(the ? { the } : {}),
      }
    : {},
});

const exactRanked = rankedUniversity('exact', 'Exact University', {
  universityId: 'exact', provider: 'the', edition: 2026, placement: 'exact', displayRank: '88', sortRank: 88,
});
const bandRanked = rankedUniversity('band', 'Band University', {
  universityId: 'band', provider: 'the', edition: 2026, placement: 'band', displayRank: '201–250', sortRank: 201,
});
const unranked = rankedUniversity('unranked', 'Unranked University', {
  universityId: 'unranked', provider: 'the', edition: 2026, placement: 'unranked',
});
const unverified = rankedUniversity('unverified', 'Unverified University', {
  universityId: 'unverified', provider: 'the', edition: 2026, placement: 'unverified',
});
const specialist = rankedUniversity('london-business-school', 'London Business School', undefined, 'specialist');
const records = [unverified, bandRanked, specialist, exactRanked, unranked];

it.each([
  [{ placement: 'tied', displayRank: '=42', sortRank: 42 }, '=42'],
  [{ placement: 'band', displayRank: '201–250', sortRank: 201 }, '201–250'],
  [{ placement: 'unranked' }, '当期未上榜'],
  [{ placement: 'unverified' }, '暂未核实'],
])('renders distinct ranking states', (record, expected) => {
  expect(rankingCopy(record as RankingRecord)).toBe(expected);
});

it('sorts bands by lower bound and leaves specialists last', () => {
  const sorted = [...records].sort((left, right) => compareDirectoryUniversities(left, right, 'the'));
  expect(sorted.at(-1)?.id).toBe('london-business-school');
  expect(sorted.indexOf(exactRanked)).toBeLessThan(sorted.indexOf(bandRanked));
  expect(sorted.indexOf(bandRanked)).toBeLessThan(sorted.indexOf(unranked));
  expect(sorted.indexOf(unranked)).toBeLessThan(sorted.indexOf(unverified));
});
```

- [ ] **Step 2: Run the focused tests and confirm missing helpers fail**

Run: `pnpm vitest run tests/presentation.test.ts tests/search.test.ts`

Expected: FAIL because ranking display and multi-mode sorting are absent.

- [ ] **Step 3: Implement neutral ranking copy**

```ts
export function rankingCopy(record?: RankingRecord): string {
  if (!record || record.placement === 'unverified') return '暂未核实';
  if (record.placement === 'unranked') return '当期未上榜';
  return record.displayRank!;
}
```

Keep `directoryRankCopy()` only as a compatibility wrapper if existing panel code needs it; it must return `专业院校` for LBS and never invent an overall rank.

- [ ] **Step 4: Implement sort keys and preserve fuzzy search behavior**

Use order buckets `ranked = 0`, `unranked = 1`, `unverified = 2`, `specialist = 3`. Sort ranked entries by `sortRank`, then English name for stable ties. For name sorting, use `left.nameEn.localeCompare(right.nameEn, 'en')` while keeping specialists in their own final bucket. Extend `search()` with a default so existing callers remain valid:

```ts
search(query: string, states: UniversityState[], sortBy: DirectorySort = 'qs'): UniversityWithStatus[]
```

- [ ] **Step 5: Run presentation and search tests**

Run: `pnpm vitest run tests/presentation.test.ts tests/search.test.ts`

Expected: PASS for exact, tied, band, unranked, unverified, and specialist ordering.

- [ ] **Step 6: Commit presentation and sorting**

```bash
git add src/lib/presentation.ts src/lib/search.ts tests/presentation.test.ts tests/search.test.ts
git commit -m "feat: present and sort QS and THE rankings"
```

---

### Task 4: Extend the Existing Directory UI Without Replacing China-Rule Features

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Modify: `scripts/build-public-data.mjs`
- Modify: `tests/page-content.test.mjs`
- Modify: `tests/initial-html.test.mjs`
- Modify: `tests/public-data.test.mjs`

**Interfaces:**
- Consumes: `rankingCopy()`, `DirectorySort`, `UniversityWithStatus.rankings`, existing evidence cards, and folded official-list components.
- Produces: QS/THE cells, one accessible sort control, compact mobile rank badges, and LBS specialist detail copy.

- [ ] **Step 1: Add failing page-contract tests**

```js
const page = readFileSync('src/pages/index.astro', 'utf8');

it('explains the expanded scope and distinct ranking years', () => {
  expect(page).toContain('QS 2027');
  expect(page).toContain('THE 2026');
  expect(page).toContain('排名仅作院校信息参考');
});

it('renders ranking columns without removing China-rule controls', () => {
  expect(page).toContain('data-sort="qs"');
  expect(page).toContain('data-sort="the"');
  expect(page).toContain('data-sort="name"');
  expect(page).toContain('institution-search');
  expect(page).toContain('official-list-panel');
});

it('labels LBS as a specialist and keeps subject ranking out of overall cells', () => {
  expect(page).toContain('特色院校');
  expect(page).toContain('商业与管理');
  expect(page).toContain('不参与综合大学排序');
});
```

- [ ] **Step 2: Run page tests and confirm the old five-column page fails**

Run: `pnpm vitest run tests/page-content.test.mjs tests/initial-html.test.mjs tests/public-data.test.mjs`

Expected: FAIL because THE cells and sort controls are missing.

- [ ] **Step 3: Update only the directory header and row ranking regions**

Change the desktop header to six information groups: university, QS 2027, THE 2026, China-rule status, scope, and official sources/actions. Render both ranking cells through `rankingCopy()`, include hidden full labels for screen readers, and retain all existing evidence cards, source links, corrections, and official-list `<details>` panels unchanged.

Add one sort-control group after state filters:

```astro
<div class="sort-controls" aria-label="院校排序方式">
  <span>排序</span>
  {(['qs', 'the', 'name'] as const).map((value) => (
    <button type="button" class:list={['sort-button', { active: value === 'qs' }]} data-sort={value} aria-pressed={value === 'qs'}>
      {value === 'qs' ? 'QS' : value === 'the' ? 'THE' : '院校名称'}
    </button>
  ))}
</div>
```

When sorting changes, call `directory.search(query, selectedStates, selectedSort)` and append matching row elements in returned order before applying `hidden` states.

- [ ] **Step 4: Add the approved LBS specialist block**

Inside the LBS row, show overall QS/THE as `—`, then a secondary note: `QS 2026 商业与管理全球第 9 · 专门商学院，不参与综合大学排序`, linked to its official QS profile. Do not create a THE subject value or use the specialist reference in sort keys.

- [ ] **Step 5: Implement desktop and mobile layout from the approved concept**

Desktop uses a six-column grid with QS/THE narrower than China-rule fields. At `max-width: 800px`, hide the table header and render each row as a card: name and evidence status first, QS/THE badges second, folded list and official sources below. Preserve navy, red, paper, serif heading, focus outline, and existing status colors.

- [ ] **Step 6: Keep public generated data aligned with client rendering**

Update `build-public-data.mjs` so any serialized university records used by evidence search include `rankings` and `specialistRanking` but do not duplicate full ranking datasets. Add assertions that public output contains `rankings.qs` and `rankings.the` for a main-directory university and no overall record for LBS.

- [ ] **Step 7: Run page, public-data, and full interaction tests**

Run: `pnpm vitest run tests/page-content.test.mjs tests/initial-html.test.mjs tests/public-data.test.mjs tests/search.test.ts tests/institution-search.test.ts tests/official-list-display.test.ts`

Expected: PASS, with existing institution search and official-list expansion still present.

- [ ] **Step 8: Build the static site**

Run: `pnpm build`

Expected: Astro type check and static build PASS; `scripts/check-initial-html.mjs` confirms initial HTML remains usable.

- [ ] **Step 9: Commit the UI extension**

```bash
git add src/pages/index.astro src/styles/global.css scripts/build-public-data.mjs tests/page-content.test.mjs tests/initial-html.test.mjs tests/public-data.test.mjs
git commit -m "feat: add QS and THE directory views"
```

---

### Task 5: Make Daily Review Non-Destructive and Require Three Consecutive Access Failures

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/data/status.json`
- Modify: `scripts/source-checker.mjs`
- Modify: `scripts/check-sources.mjs`
- Modify: `.github/workflows/daily-check.yml`
- Modify: `tests/check-sources.test.ts`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: existing registered `OfficialSourceConfig` entries and accepted `SourceStatus.contentHash`.
- Produces: `SourceStatus.observedContentHash`, `SourceStatus.consecutiveFailures`, `artifacts/source-audit.json`, and a workflow that commits only meaningful `status.json` transitions.

- [ ] **Step 1: Write failing source-state tests**

```ts
const failingFetch = (status: number) => vi.fn().mockResolvedValue(
  new Response(null, { status, headers: { 'content-type': 'text/html' } }),
);
const changedResponse = vi.fn().mockResolvedValue(
  new Response('<html>new official requirements</html>', {
    status: 200,
    headers: { 'content-type': 'text/html', etag: 'new-etag' },
  }),
);
const now1 = new Date('2026-08-08T03:17:00.000Z');
const now2 = new Date('2026-08-09T03:17:00.000Z');
const now3 = new Date('2026-08-10T03:17:00.000Z');
const okPrevious: SourceStatus = {
  sourceId: source.id,
  health: 'ok',
  contentHash: 'accepted-hash',
  consecutiveFailures: 0,
};

it('does not expose an access warning until the third consecutive failure', async () => {
  const first = await checkSource(source, failingFetch(503), okPrevious, now1);
  const second = await checkSource(source, failingFetch(503), first, now2);
  const third = await checkSource(source, failingFetch(503), second, now3);
  expect(first).toMatchObject({ health: 'ok', consecutiveFailures: 1 });
  expect(second).toMatchObject({ health: 'ok', consecutiveFailures: 2 });
  expect(third).toMatchObject({ health: 'temporary-error', consecutiveFailures: 3 });
});

it('keeps the accepted hash while a changed hash awaits review', async () => {
  const result = await checkSource(source, changedResponse, {
    sourceId: source.id,
    health: 'ok',
    contentHash: 'accepted-hash',
    consecutiveFailures: 0,
  }, now1);
  expect(result).toMatchObject({ health: 'changed', contentHash: 'accepted-hash' });
  expect(result.observedContentHash).toMatch(/^[a-f0-9]{64}$/);
});
```

Add workflow assertions that `daily-check.yml` does not run `pnpm sync:sources`, does not commit institutions/requirements/reverse-index, and does commit `status.json` only when its semantic state differs.

- [ ] **Step 2: Run source and workflow tests and confirm current behavior fails**

Run: `pnpm vitest run tests/check-sources.test.ts tests/workflows.test.mjs`

Expected: FAIL because the checker exposes the first failure, advances the accepted content hash, and the workflow still runs guarded synchronization.

- [ ] **Step 3: Separate accepted and observed source state**

Extend `SourceStatus` with:

```ts
observedContentHash?: string;
consecutiveFailures?: number;
lastAttemptError?: string;
```

On successful unchanged checks, reset failures to zero. On changed content, keep `contentHash` as the accepted baseline and write the new value to `observedContentHash`. Continue returning `changed` on later identical observations until a reviewed synchronization accepts the new baseline.

- [ ] **Step 4: Implement the three-run failure threshold**

Increment `consecutiveFailures` for timeout, 403, 404, 429, and 5xx attempts. Preserve the last public `health` for attempts one and two. On attempt three, expose `unavailable` for repeated 403/404 and `temporary-error` for timeouts, 429, and 5xx. A later successful check resets the counter and returns `ok` unless content changed.

- [ ] **Step 5: Produce an untracked audit artifact on every run**

`check-sources.mjs` writes the complete latest attempts to `artifacts/source-audit.json` for logs and issue rendering. It writes `src/data/status.json` only when accepted hash, observed hash, public health, redirect destination, or failure counter changes. If the only differences are check timestamps from an unchanged successful request, preserve the previous tracked object so Git has no diff.

- [ ] **Step 6: Restrict the daily workflow to review state**

Remove `pnpm sync:sources`, reverse-index regeneration, and generated-data paths from the daily commit. Keep link checks, `pnpm check:sources`, tests, build, issue creation, and exact-revision CI dispatch. The commit guard becomes:

```bash
if git diff --quiet -- src/data/status.json; then exit 0; fi
git add src/data/status.json
git commit -m "chore: refresh official-source review status"
```

Do not delete the local `pnpm sync:sources` command; it remains the reviewed path for accepting a verified content change.

- [ ] **Step 7: Run source, workflow, evidence, and build tests**

Run: `pnpm vitest run tests/check-sources.test.ts tests/workflows.test.mjs tests/evidence.test.ts tests/sync-sources.test.mjs`

Expected: PASS; source changes remain visible as review states and accepted requirement facts remain unchanged.

Run: `pnpm build`

Expected: PASS without modifying generated requirement data.

- [ ] **Step 8: Commit daily-review safeguards**

```bash
git add src/lib/types.ts src/data/status.json scripts/source-checker.mjs scripts/check-sources.mjs .github/workflows/daily-check.yml tests/check-sources.test.ts tests/workflows.test.mjs
git commit -m "fix: keep daily source review non-destructive"
```

---

### Task 6: Document Ranking Scope, Attribution, and Update Dates for Nontechnical Users

**Files:**
- Modify: `src/pages/methodology.astro`
- Modify: `README.md`
- Modify: `tests/page-content.test.mjs`

**Interfaces:**
- Consumes: approved product wording and provenance recorded in Task 2.
- Produces: public, plain-Chinese explanations of ranking scope and source-review dates.

- [ ] **Step 1: Add failing copy tests**

```js
const methodology = readFileSync('src/pages/methodology.astro', 'utf8');

it('distinguishes ranking year, content update, and source check dates', () => {
  expect(methodology).toContain('排名年份');
  expect(methodology).toContain('内容更新时间');
  expect(methodology).toContain('来源检查时间');
});

it('states the catalog rule and THE limitation', () => {
  expect(methodology).toContain('QS 2027 中出现的全部英国院校');
  expect(methodology).toContain('THE 2026 只作辅助展示');
  expect(methodology).toContain('未进入 QS 主目录');
});
```

- [ ] **Step 2: Run copy tests and confirm the old methodology fails**

Run: `pnpm vitest run tests/page-content.test.mjs`

Expected: FAIL because ranking and date semantics are not yet documented.

- [ ] **Step 3: Add concise methodology sections**

Explain in plain Chinese:

- the first expanded release uses QS 2027 and THE 2026;
- the catalog includes the QS UK subset, while THE is an overlay only;
- rankings are annual reference information and do not decide application eligibility;
- ranking year, content update date, and source check date mean different things;
- LBS is a specialist entry and its subject ranking is not comparable to overall rankings;
- daily checks do not call paid APIs and do not rewrite accepted China-rule summaries.

Link to the official QS/THE ranking pages and preserve the current disclaimer that programme pages and admissions teams are authoritative.

- [ ] **Step 4: Update the README maintenance section**

Document the annual ranking snapshot files, `pnpm test:run`, `pnpm build`, the daily non-destructive review, and the reviewed `pnpm sync:sources` acceptance path. State that online operation uses GitHub-hosted services and does not require a permanently running personal computer.

- [ ] **Step 5: Run copy and build tests**

Run: `pnpm vitest run tests/page-content.test.mjs`

Run: `pnpm build`

Expected: both PASS.

- [ ] **Step 6: Commit public documentation**

```bash
git add src/pages/methodology.astro README.md tests/page-content.test.mjs
git commit -m "docs: explain ranking scope and review dates"
```

---

### Task 7: Complete Regression, Visual QA, and Preview Handoff

**Files:**
- Modify only files required by failures found in this task.

**Interfaces:**
- Consumes: all deliverables from Tasks 1–6.
- Produces: a verified feature branch and preview-ready build; no production merge occurs in this task.

- [ ] **Step 1: Run the complete automated suite**

Run: `pnpm test:run`

Expected: all Vitest suites PASS, including ranking coverage, source auditing, evidence search, official-list display, workflows, public data, and URL handling.

- [ ] **Step 2: Run the production static build**

Run: `pnpm build`

Expected: Astro type checking, static generation, public-data generation, reverse-index consistency, and initial-HTML checks all PASS.

- [ ] **Step 3: Confirm the working tree contains no generated drift**

Run: `git status --short`

Expected: no uncommitted generated ranking, requirement, reverse-index, or public-data changes. The local visual-companion `.superpowers/brainstorm/` directory must not be staged.

- [ ] **Step 4: Start the local production preview**

Run: `pnpm astro preview --host 127.0.0.1`

Expected: the site opens on the reported localhost port without console errors.

- [ ] **Step 5: Perform desktop browser QA at 1440×1000**

Verify the full scope copy, QS/THE columns, default QS order, THE sorting, name sorting, state filtering, English/Chinese university search, Chinese-institution reverse search, official-list expansion, LBS specialist note, official links, and zero horizontal page overflow.

- [ ] **Step 6: Perform mobile browser QA at 390×844**

Verify university name and China-rule state appear before ranking badges, both badges remain readable, folded lists expand without clipping, controls have touch-sized targets, focus is visible, and the page has no horizontal overflow.

- [ ] **Step 7: Capture preview evidence**

Save one desktop and one mobile screenshot under an untracked temporary QA directory. Record the local preview URL, tested commit SHA, automated command results, and any intentionally unverified THE states in the handoff message. Do not commit screenshots unless the user explicitly requests them as project assets.

- [ ] **Step 8: Commit only verified fixes found during QA**

If QA required changes, stage the exact modified files, rerun `pnpm test:run` and `pnpm build`, then commit with a message describing the verified behavior. If no changes were required, do not create an empty commit.

- [ ] **Step 9: Stop before production merge**

Present the preview to the user and request final visual approval. Production merge, push, PR merge, and GitHub Pages publication occur only after that approval.
