# Official Masters Scholarship Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one reviewed masters-scholarship entry-state record for each of the 101 directory universities, render either compact official navigation or an honest non-clickable unavailable state in the existing source/action area, and include every available link in the non-destructive daily source review.

**Architecture:** Keep scholarship navigation in a new independent registry grouped by stable university ID. Every university has a reviewed `available` or `no-public-entry` state; available groups own one to three official page-identity links while no-public-entry groups own none. Join the registry into the existing public university records, render one action root as a direct action, accessible multi-link disclosure, or non-clickable unavailable state, and flatten only available links at the daily-check boundary. The site never stores individual scholarship awards, amounts, deadlines, or eligibility decisions.

**Tech Stack:** Astro 7, TypeScript 6, JSON Schema 2020-12 with AJV 8, Vitest 4, Linkedom, Node.js 22, GitHub Actions, existing source checker and page-identity monitor.

**Spec:** `docs/superpowers/specs/2026-08-31-official-masters-scholarship-entry-design.md`

## Global Constraints

- The production registry must cover exactly the current 101 universities once by `universityId`.
- Each university record must contain group-level `entryState` and `reviewedAt`; `available` records contain 1–3 official HTTPS links, while `no-public-entry` records contain zero links and retain their official negative evidence only in research.
- Masters scope includes MA, MSc, MBA, LLM, MEd, MPH, MRes, and independently awarded MPhil; it excludes MEng, MSci, PGCert, PGDip, PhD, DPhil, EngD, and doctoral studentships.
- Use only university-owned domains or an explicitly reviewed first-party alias with a lookalike-rejection test.
- Prefer masters-specific or postgraduate-taught funding pages; a combined postgraduate page is allowed only when masters coverage is directly verified and `requiresFiltering` is `true`.
- Never store or render individual scholarship names, amounts, application states, dates, deadlines, or eligibility summaries.
- Do not change the six-column desktop layout, the mobile university-card order, Chinese rules, Lists, rankings, or the existing masters-course entry.
- Daily checks may update available-link health and audit timestamps, but never group-level `reviewedAt`, replace accepted links, or mutate admissions facts automatically. Group review dates and no-public-entry conclusions change only through annual/manual review.
- Preserve the pre-existing user modification in `tests/search.test.ts`; do not stage it in any scholarship commit.
- Add no production dependency.

## File Structure

**Create**

- `src/data/masters-scholarship-entries.json` — production registry grouped by university.
- `src/data/masters-scholarship-entries.schema.json` — structural contract for groups and official links.
- `docs/research/masters-scholarship-entry-batch-1.md` through `batch-4.md` — first-party evidence tables for all 101 universities.
- `tests/helpers/masters-scholarship-research.ts` — deterministic parser for the committed evidence tables.
- `tests/masters-scholarship-entries.test.ts` — schema, domain, cardinality, and exact-catalog tests.
- `tests/masters-scholarship-entry-batch-1.test.ts` through `batch-4.test.ts` — evidence-to-registry parity tests.

**Modify**

- `src/lib/types.ts` — scholarship registry, status-joined, and final university-record types.
- `src/lib/data.ts` — schema loading, domain validation, registry loading, and strict join.
- `scripts/build-public-data.mjs` — join scholarship groups into `public/generated/universities.json`.
- `public/generated/universities.json` — regenerated checked-in public snapshot.
- `src/lib/presentation.ts` — compact labels for entry type and multi-link disclosures.
- `src/lib/source-actions.ts` — generic keyboard handling for both existing and new disclosures.
- `src/pages/index.astro` — render the compact scholarship action without adding a column.
- `src/styles/global.css` — reuse existing action geometry and responsive wrapping.
- `scripts/check-sources.mjs` — flatten scholarship links into daily check targets.
- `scripts/upsert-source-anomaly-issues.mjs` — index scholarship links for anomaly Issues.
- `scripts/render-anomaly-issue.mjs` — identify scholarship-entry anomalies accurately.
- `.github/workflows/daily-check.yml` — include the new registry in Lychee.
- `tests/data.test.ts`, `tests/public-data.test.mjs` — strict join and public-output coverage.
- `tests/source-actions.test.ts`, `tests/page-content.test.mjs` — rendered action and keyboard behavior.
- `tests/check-sources-runner.test.mjs`, `tests/anomaly-issue.test.mjs`, `tests/source-anomaly-issues.test.mjs`, `tests/workflows.test.mjs` — daily review coverage.
- `README.md`, `src/pages/methodology.astro`, `CONTRIBUTING.md` — explain the navigation-only boundary and annual manual-review procedure.

---

### Task 1: Define and validate the independent scholarship registry

**Files:**
- Create: `src/data/masters-scholarship-entries.json`
- Create: `src/data/masters-scholarship-entries.schema.json`
- Create: `tests/helpers/masters-scholarship-research.ts`
- Create: `tests/masters-scholarship-entries.test.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`

**Interfaces:**
- Produces: `MastersScholarshipEntryKind`, `MastersScholarshipLink`, `MastersScholarshipEntry`, `MastersScholarshipLinkWithStatus`, `MastersScholarshipEntryWithStatus`.
- Produces: `validateMastersScholarshipEntries(input: unknown, universities?: University[]): MastersScholarshipEntry[]`.
- Produces: `loadMastersScholarshipEntries(input?: unknown): MastersScholarshipEntry[]`.
- Produces: `parseMastersScholarshipResearch(markdown: string): MastersScholarshipResearchRow[]` for the four evidence tests.

- [ ] **Step 1: Write failing registry-contract tests**

Create `tests/masters-scholarship-entries.test.ts` with a synthetic official university and this valid fixture:

```ts
const valid: MastersScholarshipEntry[] = [{
  universityId: 'imperial-college-london',
  entryState: 'available',
  reviewedAt: '2026-08-31',
  links: [{
    id: 'scholarships-imperial-college-london-directory',
    universityId: 'imperial-college-london',
    labelZh: '查看硕士奖学金官网',
    scopeZh: '硕士奖学金官方目录',
    kind: 'masters-directory',
    requiresFiltering: false,
    url: 'https://www.imperial.ac.uk/study/fees-and-funding/postgraduate/',
    pageTitle: 'Postgraduate fees and funding',
    reviewedAt: '2026-08-31',
    requiredText: ['Postgraduate', 'Scholarships'],
    monitorMode: 'page-identity',
  }],
}];
```

Test that the validator accepts the fixture plus a reviewed `no-public-entry` fixture with zero links and rejects: duplicate university groups, an available group with zero or four links, a no-public-entry group with any link, duplicate link IDs, link/group university mismatch, an ID without the `scholarships-${universityId}-` prefix, non-HTTPS URLs, official-domain lookalikes, duplicate `requiredText`, an unknown `kind`, and `postgraduate-funding` with `requiresFiltering: false`.

- [ ] **Step 2: Run the focused test and confirm the missing contract**

Run: `pnpm vitest run tests/masters-scholarship-entries.test.ts`

Expected: FAIL because the registry types and loader do not exist.

- [ ] **Step 3: Add the types and empty production registry**

Add these exact public types to `src/lib/types.ts`:

```ts
export type MastersScholarshipEntryKind =
  | 'masters-directory'
  | 'masters-search'
  | 'postgraduate-funding'
  | 'category';

export interface MastersScholarshipLink {
  id: string;
  universityId: string;
  labelZh: '查看硕士奖学金官网';
  scopeZh: string;
  kind: MastersScholarshipEntryKind;
  requiresFiltering: boolean;
  url: string;
  pageTitle: string;
  reviewedAt: string;
  requiredText: string[];
  monitorMode: 'page-identity';
}

export type MastersScholarshipEntryState = 'available' | 'no-public-entry';

interface MastersScholarshipEntryBase {
  universityId: string;
  entryState: MastersScholarshipEntryState;
  reviewedAt: string;
}

export interface AvailableMastersScholarshipEntry extends MastersScholarshipEntryBase {
  entryState: 'available';
  links: MastersScholarshipLink[];
}

export interface NoPublicMastersScholarshipEntry extends MastersScholarshipEntryBase {
  entryState: 'no-public-entry';
  links: [];
}

export type MastersScholarshipEntry =
  | AvailableMastersScholarshipEntry
  | NoPublicMastersScholarshipEntry;

export type MastersScholarshipLinkWithStatus =
  MastersScholarshipLink & { status?: SourceStatus };

export type MastersScholarshipEntryWithStatus =
  | (Omit<AvailableMastersScholarshipEntry, 'links'> & { links: MastersScholarshipLinkWithStatus[] })
  | NoPublicMastersScholarshipEntry;
```

Create `src/data/masters-scholarship-entries.json` as `[]` and create a strict schema requiring the group state/date and every link property above. Use a conditional cardinality contract: `available` requires 1–3 links; `no-public-entry` requires zero. Available links require two unique identity anchors, the fixed Chinese label, an HTTPS URL, and `monitorMode: page-identity`. Add a link conditional that requires `requiresFiltering: true` when `kind` is `postgraduate-funding`.

- [ ] **Step 4: Implement registry validation and loading**

In `src/lib/data.ts`, import the new JSON and schema, compile the schema with AJV, and implement this validation sequence:

```ts
export function validateMastersScholarshipEntries(
  input: unknown,
  universities: University[] = validateUniversities(universitiesJson),
): MastersScholarshipEntry[] {
  assertSchema(
    validateMastersScholarshipEntrySchema(input),
    validateMastersScholarshipEntrySchema.errors,
    'Masters scholarship entry schema',
  );

  const records = input as MastersScholarshipEntry[];
  const universitiesById = new Map(universities.map((university) => [university.id, university]));
  const groupIds = new Set<string>();
  const linkIds = new Set<string>();

  records.forEach((record, recordIndex) => {
    if (groupIds.has(record.universityId)) {
      throw new DataValidationError('Masters scholarship entry', [
        `/${recordIndex}/universityId duplicates a university group`,
      ]);
    }
    groupIds.add(record.universityId);
    const university = universitiesById.get(record.universityId);
    if (!university) {
      throw new DataValidationError('Masters scholarship entry', [
        `/${recordIndex}/universityId references an unregistered university`,
      ]);
    }

    record.links.forEach((link, linkIndex) => {
      if (link.universityId !== record.universityId) {
        throw new DataValidationError('Masters scholarship entry', [
          `/${recordIndex}/links/${linkIndex}/universityId must match its group`,
        ]);
      }
      if (!link.id.startsWith(`scholarships-${record.universityId}-`)) {
        throw new DataValidationError('Masters scholarship entry', [
          `/${recordIndex}/links/${linkIndex}/id must be derived from universityId`,
        ]);
      }
      if (linkIds.has(link.id)) {
        throw new DataValidationError('Masters scholarship entry', [
          `/${recordIndex}/links/${linkIndex}/id duplicates a stable link ID`,
        ]);
      }
      linkIds.add(link.id);
      assertUniversityOwnedUrl(
        link.url,
        university,
        'Masters scholarship entry',
        `/${recordIndex}/links/${linkIndex}/url`,
        firstPartyScholarshipDomainAliases.get(record.universityId) ?? new Set(),
      );
    });
  });

  return records;
}
```

Extract the existing course-directory hostname logic into `assertUniversityOwnedUrl(url, university, dataset, path, approvedAliases)` and keep the current Greenwich `gre.ac.uk` course alias scoped to the course validator. Pass a separate reviewed alias set from the scholarship validator; scholarship aliases must not inherit course aliases automatically.

- [ ] **Step 5: Add and test the evidence-table parser**

Create `tests/helpers/masters-scholarship-research.ts` with this row contract:

```ts
export interface MastersScholarshipResearchRow {
  universityId: string;
  evidenceId: string;
  officialUrl: string;
  finalUrl: string;
  kind: MastersScholarshipEntryKind | 'no-public-entry';
  requiresFiltering: boolean;
  pageTitle: string;
  requiredText: [string, string];
  reviewedAt: string;
  decisionNote: string;
}
```

Parse only table rows beginning with `| `, skip the header/separator, split cells on ` | `, decode `&#124;` back to `|`, require exactly 11 cells, parse `true`/`false` strictly, and throw on malformed rows. Allow `no-public-entry` only as a research-evidence kind, never as `MastersScholarshipEntryKind`. Add unit tests for one complete clickable row, one official negative-evidence row, and malformed rows.

- [ ] **Step 6: Run focused tests**

Run: `pnpm vitest run tests/masters-scholarship-entries.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the registry contract**

```bash
git add src/data/masters-scholarship-entries.json src/data/masters-scholarship-entries.schema.json src/lib/types.ts src/lib/data.ts tests/helpers/masters-scholarship-research.ts tests/masters-scholarship-entries.test.ts
git commit -m "feat: define masters scholarship entry registry"
```

---

### Task 2: Audit and register scholarship entry batch 1

**Files:**
- Create: `docs/research/masters-scholarship-entry-batch-1.md`
- Create: `tests/masters-scholarship-entry-batch-1.test.ts`
- Modify: `src/data/masters-scholarship-entries.json`
- Modify: `src/lib/data.ts` only when a directly verified first-party alias is required

**Interfaces:**
- Consumes: `loadMastersScholarshipEntries()` and `parseMastersScholarshipResearch()` from Task 1.
- Produces: reviewed production groups for the first 26 universities.

- [ ] **Step 1: Audit the exact batch against first-party pages**

Use this fixed batch, one university at a time:

```ts
const batch1UniversityIds = [
  'imperial-college-london', 'university-of-oxford', 'university-of-cambridge',
  'university-college-london', 'university-of-edinburgh', 'kings-college-london',
  'university-of-manchester', 'university-of-bristol',
  'london-school-of-economics-and-political-science', 'university-of-warwick',
  'university-of-birmingham', 'university-of-leeds', 'university-of-glasgow',
  'university-of-sheffield', 'durham-university', 'university-of-nottingham',
  'queen-mary-university-of-london', 'university-of-southampton',
  'university-of-st-andrews', 'university-of-bath', 'university-of-exeter',
  'university-of-liverpool', 'newcastle-university', 'university-of-york',
  'lancaster-university', 'queens-university-belfast',
] as const;
```

For each ID, open the university's official site and choose one unified masters/postgraduate-taught scholarship directory or search page. Record 2–3 category pages only when no unified page exists. Reject search snippets, third-party aggregators, undergraduate-only pages, doctoral-only pages, news articles, and individual-award pages used as a substitute for a directory. If exhaustive first-party review finds no qualifying public master's entry, record one official negative-evidence row and produce a `no-public-entry` group rather than promoting an unrelated page.

- [ ] **Step 2: Record the complete evidence table**

Create `docs/research/masters-scholarship-entry-batch-1.md` with this exact header and one row per admitted link:

```markdown
| universityId | evidenceId | official URL | final URL | kind | requiresFiltering | page title | requiredText 1 | requiredText 2 | reviewedAt | decision note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Use `&#124;` inside page titles. Each available-link decision note must say how masters coverage was verified and why the selected page is broader than a single award. A `no-public-entry` row uses a stable `evidence-*` ID and explains why the official page is negative evidence rather than an action destination. For anti-bot pages, record the successful browser-DOM verification and expected checker behavior.

- [ ] **Step 3: Write the failing batch parity test**

In `tests/masters-scholarship-entry-batch-1.test.ts`, parse the research table and assert that its university set equals `batch1UniversityIds`. For each university, assert group `entryState` and `reviewedAt`, then compare the production link-ID set bidirectionally with that university's available evidence-ID set so neither missing nor extra links pass. Compare each available row's `universityId`, `url: finalUrl`, `kind`, `requiresFiltering`, `pageTitle`, both identity anchors, and `reviewedAt`. For negative evidence, assert a single `no-public-entry` row, the production state/date, and zero links.

- [ ] **Step 4: Run the test and confirm production data is missing**

Run: `pnpm vitest run tests/masters-scholarship-entry-batch-1.test.ts`

Expected: FAIL because batch 1 groups are absent from the registry.

- [ ] **Step 5: Add the reviewed groups to the production registry**

Convert every university's research result into the `MastersScholarshipEntry` structure with explicit group state/date. Group available rows by `universityId`, preserve fixed batch order, use `labelZh: 查看硕士奖学金官网`, and set `monitorMode: page-identity`; convert a negative-evidence row only to `entryState: no-public-entry` with `links: []`. Where an external first-party alias is unavoidable, add only that exact normalized hostname to the scholarship alias map and add one accepted-alias plus two lookalike-rejection tests.

- [ ] **Step 6: Run batch and contract tests**

Run: `pnpm vitest run tests/masters-scholarship-entries.test.ts tests/masters-scholarship-entry-batch-1.test.ts`

Expected: PASS with 26 unique university groups.

- [ ] **Step 7: Commit batch 1**

```bash
git add docs/research/masters-scholarship-entry-batch-1.md src/data/masters-scholarship-entries.json src/lib/data.ts tests/masters-scholarship-entries.test.ts tests/masters-scholarship-entry-batch-1.test.ts
git commit -m "data: add masters scholarship entries batch 1"
```

---

### Task 3: Audit and register scholarship entry batch 2

**Files:**
- Create: `docs/research/masters-scholarship-entry-batch-2.md`
- Create: `tests/masters-scholarship-entry-batch-2.test.ts`
- Modify: `src/data/masters-scholarship-entries.json`
- Modify: `src/lib/data.ts`, `tests/masters-scholarship-entries.test.ts` only for directly verified aliases

**Interfaces:**
- Consumes: the Task 1 registry/parser and Task 2 production registry.
- Produces: reviewed production groups for 25 additional universities.

- [ ] **Step 1: Audit this exact batch with the Task 2 acceptance rules**

```ts
const batch2UniversityIds = [
  'cardiff-university', 'university-of-reading', 'cranfield-university',
  'london-business-school', 'london-school-of-hygiene-and-tropical-medicine',
  'royal-college-of-art', 'royal-veterinary-college', 'royal-college-of-music',
  'institute-of-cancer-research-london', 'liverpool-school-of-tropical-medicine',
  'loughborough-university', 'university-of-strathclyde', 'university-of-surrey',
  'university-of-sussex', 'university-of-aberdeen', 'university-of-leicester',
  'swansea-university', 'heriot-watt-university', 'brunel-university-of-london',
  'birkbeck-university-of-london', 'city-st-georges-university-of-london',
  'university-of-east-anglia', 'oxford-brookes-university', 'university-of-kent',
  'aston-university',
] as const;
```

Record the same 11 evidence columns. Specialist institutions still require a complete masters-funding gateway; do not replace it with one prominent award. If none exists publicly, retain an official negative-evidence row and use `no-public-entry` with zero links.

- [ ] **Step 2: Write and run the failing batch parity test**

Create `tests/masters-scholarship-entry-batch-2.test.ts` with the same exact bidirectional evidence-to-registry comparison and negative-evidence handling as batch 1, importing batch 2 research. Run it and expect missing-group failures.

- [ ] **Step 3: Add all reviewed batch 2 groups**

Append the 25 groups in batch order with explicit state/date, add only evidence-backed domain aliases, keep available groups within 1–3 links, and keep no-public-entry groups at zero links.

- [ ] **Step 4: Run cumulative tests**

Run: `pnpm vitest run tests/masters-scholarship-entries.test.ts tests/masters-scholarship-entry-batch-{1,2}.test.ts`

Expected: PASS with 51 unique university groups.

- [ ] **Step 5: Commit batch 2**

```bash
git add docs/research/masters-scholarship-entry-batch-2.md src/data/masters-scholarship-entries.json src/lib/data.ts tests/masters-scholarship-entries.test.ts tests/masters-scholarship-entry-batch-2.test.ts
git commit -m "data: add masters scholarship entries batch 2"
```

---

### Task 4: Audit and register scholarship entry batch 3

**Files:**
- Create: `docs/research/masters-scholarship-entry-batch-3.md`
- Create: `tests/masters-scholarship-entry-batch-3.test.ts`
- Modify: `src/data/masters-scholarship-entries.json`
- Modify: `src/lib/data.ts`, `tests/masters-scholarship-entries.test.ts` only for directly verified aliases

**Interfaces:**
- Consumes: the validated 51-group registry.
- Produces: reviewed production groups for 25 additional universities.

- [ ] **Step 1: Audit this exact batch and write the 11-column evidence table**

```ts
const batch3UniversityIds = [
  'university-of-essex', 'university-of-dundee', 'soas-university-of-london',
  'royal-holloway-university-of-london', 'university-of-bradford',
  'university-of-huddersfield', 'northumbria-university', 'university-of-stirling',
  'bangor-university', 'university-of-hull', 'coventry-university',
  'ulster-university', 'manchester-metropolitan-university',
  'nottingham-trent-university', 'university-of-portsmouth',
  'kingston-university-london', 'university-of-plymouth',
  'goldsmiths-university-of-london', 'university-of-the-west-of-england',
  'university-of-greenwich', 'aberystwyth-university', 'bournemouth-university',
  'edinburgh-napier-university', 'keele-university', 'de-montfort-university',
] as const;
```

Apply the same direct-open, masters-coverage, directory-over-individual-award, first-party-domain, bidirectional-parity, and official negative-evidence rules.

- [ ] **Step 2: Write and run the failing batch parity test**

Create `tests/masters-scholarship-entry-batch-3.test.ts`, compare every university's available evidence-ID set bidirectionally with production, handle no-public-entry evidence as zero-link state, and expect missing batch 3 groups before the JSON change.

- [ ] **Step 3: Add all reviewed batch 3 groups and rerun cumulative tests**

Run: `pnpm vitest run tests/masters-scholarship-entries.test.ts tests/masters-scholarship-entry-batch-{1,2,3}.test.ts`

Expected: PASS with 76 unique university groups.

- [ ] **Step 4: Commit batch 3**

```bash
git add docs/research/masters-scholarship-entry-batch-3.md src/data/masters-scholarship-entries.json src/lib/data.ts tests/masters-scholarship-entries.test.ts tests/masters-scholarship-entry-batch-3.test.ts
git commit -m "data: add masters scholarship entries batch 3"
```

---

### Task 5: Audit and register scholarship entry batch 4

**Files:**
- Create: `docs/research/masters-scholarship-entry-batch-4.md`
- Create: `tests/masters-scholarship-entry-batch-4.test.ts`
- Modify: `src/data/masters-scholarship-entries.json`
- Modify: `src/lib/data.ts`, `tests/masters-scholarship-entries.test.ts` only for directly verified aliases

**Interfaces:**
- Consumes: the validated 76-group registry.
- Produces: the complete 101-university production registry.

- [ ] **Step 1: Audit this exact final batch and write the 11-column evidence table**

```ts
const batch4UniversityIds = [
  'liverpool-john-moores-university', 'university-of-hertfordshire',
  'university-of-lincoln', 'university-of-the-arts-london',
  'university-of-westminster', 'london-south-bank-university',
  'middlesex-university', 'university-of-brighton', 'anglia-ruskin-university',
  'birmingham-city-university', 'glasgow-caledonian-university',
  'leeds-beckett-university', 'london-metropolitan-university',
  'robert-gordon-university', 'sheffield-hallam-university',
  'university-of-east-london', 'university-of-lancashire',
  'university-of-roehampton', 'university-of-salford',
  'university-of-wolverhampton', 'queen-margaret-university-edinburgh',
  'university-of-northampton', 'university-of-derby',
  'university-of-south-wales', 'canterbury-christ-church-university',
] as const;
```

Apply the same direct-open, bidirectional evidence parity, and official negative-evidence rules. Every final group must have explicit state/date; no-public-entry groups retain one official evidence row but zero production links.

- [ ] **Step 2: Write and run the failing batch parity test**

Create `tests/masters-scholarship-entry-batch-4.test.ts`, compare every university's available evidence-ID set bidirectionally with production, handle no-public-entry evidence as zero-link state, and expect missing batch 4 groups before the JSON change.

- [ ] **Step 3: Add final groups and exact-catalog assertions**

Append all 25 groups. In `tests/masters-scholarship-entries.test.ts`, assert:

```ts
const catalog = validateUniversities(universitiesJson);
const entries = loadMastersScholarshipEntries();
expect(entries).toHaveLength(101);
expect(new Set(entries.map((entry) => entry.universityId)))
  .toEqual(new Set(catalog.map((university) => university.id)));
expect(entries.every((entry) => entry.entryState === 'available'
  ? entry.links.length >= 1 && entry.links.length <= 3
  : entry.links.length === 0)).toBe(true);
```

- [ ] **Step 4: Run all registry and evidence tests**

Run: `pnpm vitest run tests/masters-scholarship-entries.test.ts tests/masters-scholarship-entry-batch-{1,2,3,4}.test.ts`

Expected: PASS with exactly 101 groups; every group has explicit state/date, every available group has 1–3 unique official links, and every no-public-entry group has zero links. Do not require at least 101 clickable links.

- [ ] **Step 5: Commit batch 4**

```bash
git add docs/research/masters-scholarship-entry-batch-4.md src/data/masters-scholarship-entries.json src/lib/data.ts tests/masters-scholarship-entries.test.ts tests/masters-scholarship-entry-batch-4.test.ts
git commit -m "data: complete masters scholarship entry registry"
```

---

### Task 6: Join scholarship entries into application and public data

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`
- Modify: `scripts/build-public-data.mjs`
- Modify: `tests/data.test.ts`
- Modify: `tests/public-data.test.mjs`
- Modify: `public/generated/universities.json`

**Interfaces:**
- Consumes: `MastersScholarshipEntry[]` and `StatusMap`.
- Produces: `joinMastersScholarshipEntries(universities, entries, statuses): UniversityDirectoryRecord[]`.
- Produces: `UniversityDirectoryRecord.mastersScholarships: MastersScholarshipEntryWithStatus`.

- [ ] **Step 1: Write failing strict-join tests**

Add tests to `tests/data.test.ts` covering one available group with two links and status objects, one no-public-entry group with zero links, plus missing, extra, duplicate-university, and link-status isolation cases. The available assertion is:

```ts
expect(joined.mastersScholarships).toEqual({
  universityId: university.id,
  entryState: entry.entryState,
  reviewedAt: entry.reviewedAt,
  links: entry.links.map((link) => ({ ...link, status: statuses[link.id] })),
});
```

For no-public-entry, assert the state/date survive unchanged, `links` stays empty, and no status is looked up. Add the same strict mapping cases to `tests/public-data.test.mjs` and extend the checked-in snapshot assertion so every public university has both `mastersCourse` and `mastersScholarships`.

- [ ] **Step 2: Run focused tests and confirm the join is absent**

Run: `pnpm vitest run tests/data.test.ts tests/public-data.test.mjs`

Expected: FAIL because scholarship entries are not joined or emitted.

- [ ] **Step 3: Add status-joined types and in-process join**

In `src/lib/types.ts`, introduce an intermediate type so the course join remains type-correct:

```ts
export type UniversityWithMastersCourse = UniversityWithStatus & {
  mastersCourse: MastersCourseDirectoryWithStatus;
};

export type UniversityDirectoryRecord = UniversityWithMastersCourse & {
  mastersScholarships: MastersScholarshipEntryWithStatus;
};
```

Change `joinMastersCourseDirectories` to return `UniversityWithMastersCourse[]`. Add `joinMastersScholarshipEntries` with the same missing/extra/duplicate protection, preserve group state/date, and map statuses only for available links by link ID. A no-public-entry group remains a zero-link state object. Update `loadUniversities()` to join rankings, China sources, course entry, then scholarship entry.

- [ ] **Step 4: Extend the public-data builder**

Add `mastersScholarshipEntries` to `buildPublicData(...)` and CLI loading. Implement a matching strict join:

```js
function joinedMastersScholarshipEntries(universities, entries, statuses) {
  const universityIds = new Set(universities.map((university) => university.id));
  const byUniversityId = new Map();
  for (const entry of entries) {
    if (byUniversityId.has(entry.universityId)) throw new Error(`Duplicate masters scholarship entry for university ${entry.universityId}`);
    if (!universityIds.has(entry.universityId)) throw new Error(`Extra masters scholarship entry for university ${entry.universityId}`);
    byUniversityId.set(entry.universityId, entry);
  }
  return universities.map((university) => {
    const entry = byUniversityId.get(university.id);
    if (!entry) throw new Error(`Missing masters scholarship entry for university ${university.id}`);
    return {
      ...university,
      mastersScholarships: {
        ...entry,
        links: entry.entryState === 'available'
          ? entry.links.map((link) => ({ ...link, status: statuses[link.id] }))
          : [],
      },
    };
  });
}
```

Keep `mastersCourseDirectories` and `mastersScholarshipEntries` optional for low-level builder tests that intentionally exercise only source/List output. The CLI path always supplies both complete registries; when the scholarship argument is supplied, enforce the strict join above.

- [ ] **Step 5: Regenerate public data and rerun focused tests**

Run: `pnpm build:public`

Run: `pnpm vitest run tests/data.test.ts tests/public-data.test.mjs`

Expected: PASS; `public/generated/universities.json` contains scholarship groups only inside their university records, with no standalone public registry file.

- [ ] **Step 6: Commit strict data integration**

```bash
git add src/lib/types.ts src/lib/data.ts scripts/build-public-data.mjs tests/data.test.ts tests/public-data.test.mjs public/generated/universities.json
git commit -m "feat: join masters scholarship entries into directory data"
```

---

### Task 7: Render the compact desktop and mobile action

**Files:**
- Modify: `src/lib/presentation.ts`
- Modify: `src/lib/source-actions.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/source-actions.test.ts`
- Modify: `tests/page-content.test.mjs`

**Interfaces:**
- Consumes: `UniversityDirectoryRecord.mastersScholarships` including group state/date and links.
- Produces: `mastersScholarshipActionModel(entry)` returning an available direct/disclosure model or an unavailable non-clickable model.
- Produces: `mastersScholarshipKindCopy(link)` for the four fixed source types and the mandatory filtering warning.
- Produces: `bindSourceDetailsKeyboard(root: ParentNode): void` for China and scholarship disclosures.

- [ ] **Step 1: Write failing presentation and rendered-DOM tests**

Add these unit expectations to `tests/source-actions.test.ts`:

```ts
expect(mastersScholarshipActionModel({
  universityId: 'one', entryState: 'available', reviewedAt: '2026-08-31', links: [link],
})).toEqual({
  entryState: 'available',
  collapsed: false,
  count: 1,
  label: '查看硕士奖学金官网',
});
expect(mastersScholarshipActionModel({
  universityId: 'one', entryState: 'available', reviewedAt: '2026-08-31', links: [link, secondLink],
})).toEqual({
  entryState: 'available',
  collapsed: true,
  count: 2,
  label: '查看硕士奖学金官网（2 个入口）',
});
expect(mastersScholarshipActionModel({
  universityId: 'one',
  entryState: 'no-public-entry',
  reviewedAt: '2026-08-31',
  links: [],
})).toEqual({
  entryState: 'no-public-entry',
  collapsed: false,
  count: 0,
  label: '未发现公开硕士奖学金入口',
});
```

Extend the built-DOM tests to require exactly 101 scholarship action roots, one per university, while asserting that the number of clickable scholarship links equals the flattened available-link count rather than 101. Test one ordinary direct link, one production multi-link university discovered during research, and one no-public-entry university that renders only “未发现公开硕士奖学金入口”. Verify that Enter and Space toggle both China and scholarship `<details>` summaries without changing focus, while ArrowDown remains untouched.

- [ ] **Step 2: Run the focused action tests**

Run: `pnpm vitest run tests/source-actions.test.ts tests/page-content.test.mjs`

Expected: FAIL because the new model, markup, and generic keyboard binder are absent.

- [ ] **Step 3: Implement presentation copy and generic keyboard binding**

Add to `src/lib/presentation.ts`:

```ts
const mastersScholarshipKindLabels = {
  'masters-directory': '官方奖学金目录',
  'masters-search': '官方奖学金搜索器',
  'postgraduate-funding': '研究生资助官网',
  category: '官方分类资助入口',
} satisfies Record<MastersScholarshipEntryKind, string>;

export function mastersScholarshipKindCopy(link: MastersScholarshipLink): string {
  return link.requiresFiltering
    ? `${mastersScholarshipKindLabels[link.kind]}（含硕士，请筛选）`
    : mastersScholarshipKindLabels[link.kind];
}

export function mastersScholarshipActionModel(entry: MastersScholarshipEntryWithStatus) {
  if (entry.entryState === 'no-public-entry') {
    return {
      entryState: entry.entryState,
      collapsed: false,
      count: 0,
      label: '未发现公开硕士奖学金入口',
    };
  }
  const count = entry.links.length;
  return {
    entryState: entry.entryState,
    collapsed: count > 1,
    count,
    label: count > 1 ? `查看硕士奖学金官网（${count} 个入口）` : '查看硕士奖学金官网',
  };
}
```

Rename `bindChinaSourceDetailsKeyboard` to `bindSourceDetailsKeyboard` and query `[data-source-summary]`. Change the existing China summary attribute to `data-source-summary` so the same tested listener serves both disclosures.

- [ ] **Step 4: Render one link or one disclosure inside the current action group**

In `src/pages/index.astro`, preserve China sources first and the masters-course action second. Add the scholarship action root third. A no-public-entry group renders only non-clickable text “未发现公开硕士奖学金入口”; it must not render an `<a>` or an empty disclosure. An available single link renders directly with its kind copy. Multiple available links render:

```astro
<details class="masters-scholarship-bundle">
  <summary data-source-summary>
    <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
    <span>{scholarshipModel.label}</span>
  </summary>
  <div class="masters-scholarship-bundle-list">{scholarshipLinks}</div>
</details>
```

Each expanded link displays `link.labelZh`, `link.scopeZh`, and `mastersScholarshipKindCopy(link)`. A direct single link uses the same function. Add a unit assertion that any `requiresFiltering: true` link visibly contains “含硕士，请筛选”. A link health status of `temporary-error` or `unavailable` adds “官网入口暂不可用，请稍后重试”; this is distinct from the group-level no-public-entry state. Normal links and the no-public-entry message do not add a visible timestamp line.

- [ ] **Step 5: Add narrowly scoped responsive CSS**

Group `.masters-scholarship-action` and `.masters-scholarship-bundle` with the current min-width, max-width, summary grid, focus, border, and 800px width rules. Keep `.source-actions` vertical and add no width, column, font-size, or university-row changes. At 430px, allow all scholarship labels and scopes to wrap with `overflow-wrap:anywhere`.

- [ ] **Step 6: Run action tests and build**

Run: `pnpm vitest run tests/source-actions.test.ts tests/page-content.test.mjs`

Run: `pnpm build`

Expected: PASS; Astro reports no type error and the built DOM has 101 scholarship action roots, with unavailable roots non-clickable and clickable link count derived only from available groups.

- [ ] **Step 7: Commit the UI**

```bash
git add src/lib/presentation.ts src/lib/source-actions.ts src/pages/index.astro src/styles/global.css tests/source-actions.test.ts tests/page-content.test.mjs
git commit -m "feat: add compact masters scholarship actions"
```

---

### Task 8: Add scholarship links to the safe daily patrol

**Files:**
- Modify: `scripts/check-sources.mjs`
- Modify: `scripts/upsert-source-anomaly-issues.mjs`
- Modify: `scripts/render-anomaly-issue.mjs`
- Modify: `.github/workflows/daily-check.yml`
- Modify: `tests/check-sources-runner.test.mjs`
- Modify: `tests/anomaly-issue.test.mjs`
- Modify: `tests/source-anomaly-issues.test.mjs`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: grouped `MastersScholarshipEntry[]`.
- Produces: `flattenMastersScholarshipLinks(entries)` and includes those links in `loadCheckTargets(...)`.
- Produces: anomaly kind `masters-scholarship-entry` with a scholarship-specific Issue title and body.

- [ ] **Step 1: Write failing checker-target tests**

Extend `tests/check-sources-runner.test.mjs` with one available group containing two scholarship links and one no-public-entry group containing none. Assert the exact order is China sources, masters-course directories, then flattened available scholarship links; the no-public-entry group must produce no monitor target or network request. Assert duplicate IDs across any category fail before network access. Add a run test where the first scholarship link returns 503 and the second returns a page containing both required anchors; both attempts must appear in the audit.

Also assert that an unchanged successful scholarship page-identity attempt records a fresh `lastSuccessfulAt` in the daily audit but does not persist a status-only timestamp refresh, matching the existing low-noise page-identity contract.

- [ ] **Step 2: Write failing anomaly and workflow tests**

In `tests/anomaly-issue.test.mjs`, require a scholarship anomaly payload with:

```ts
expect(payload.title).toBe('[奖学金入口异常] scholarships-example-directory');
expect(payload.body).toContain('硕士奖学金官网入口身份异常');
expect(payload.body).toContain('不会自动替换正式入口');
```

Update `tests/source-anomaly-issues.test.mjs` to prove grouped links are indexed individually. Update `tests/workflows.test.mjs` to require `src/data/masters-scholarship-entries.json` in the Lychee args and to preserve `fail: false`.

- [ ] **Step 3: Run focused monitoring tests**

Run: `pnpm vitest run tests/check-sources-runner.test.mjs tests/anomaly-issue.test.mjs tests/source-anomaly-issues.test.mjs tests/workflows.test.mjs`

Expected: FAIL because scholarship entries are absent from the checker and Issue renderer.

- [ ] **Step 4: Flatten links at the monitoring boundary**

Implement:

```js
export function flattenMastersScholarshipLinks(entries) {
  return entries.flatMap((entry) => entry.entryState === 'available' ? entry.links : []);
}

export function loadCheckTargets({
  chinaSources = [],
  mastersCourseDirectories = [],
  mastersScholarshipEntries = [],
}) {
  const targets = [
    ...chinaSources,
    ...mastersCourseDirectories,
    ...flattenMastersScholarshipLinks(mastersScholarshipEntries),
  ];
  // keep the existing duplicate-ID and HTTPS validation
  return targets;
}
```

Load the new registry path in `runSourceChecks`. Keep the `options.sources` shortcut working by supplying both directory arrays as empty. No-public-entry groups participate only in annual human review and must never be synthesized into checker targets or anomaly Issues.

- [ ] **Step 5: Index grouped links and render accurate Issues**

In `upsert-source-anomaly-issues.mjs`, load the scholarship registry, flatten its links, and pass them to the existing unique-ID index. Set `resourceKind` on the anomaly from the stable prefix: `scholarships-` → `masters-scholarship-entry`, `masters-` → `masters-course-entry`, otherwise `china-rule-source`.

In `render-anomaly-issue.mjs`, validate those three values. Keep the existing China and course text unchanged, and add a scholarship page-identity branch titled “硕士奖学金官网入口身份异常” with Issue prefix `[奖学金入口异常]`.

- [ ] **Step 6: Add the registry to Lychee and rerun tests**

Append `src/data/masters-scholarship-entries.json` to the existing `args:` line in `.github/workflows/daily-check.yml`. Do not change the cron, permissions, failure policy, commit scope, or deployment steps.

Run: `pnpm vitest run tests/check-sources-runner.test.mjs tests/anomaly-issue.test.mjs tests/source-anomaly-issues.test.mjs tests/workflows.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit daily-review integration**

```bash
git add scripts/check-sources.mjs scripts/upsert-source-anomaly-issues.mjs scripts/render-anomaly-issue.mjs .github/workflows/daily-check.yml tests/check-sources-runner.test.mjs tests/anomaly-issue.test.mjs tests/source-anomaly-issues.test.mjs tests/workflows.test.mjs
git commit -m "feat: monitor masters scholarship entries"
```

---

### Task 9: Document, verify, and visually review the complete feature

**Files:**
- Modify: `README.md`
- Modify: `src/pages/methodology.astro`
- Modify: `CONTRIBUTING.md`
- Modify: `tests/page-content.test.mjs`
- Modify: `public/generated/universities.json` only when regeneration changes it

**Interfaces:**
- Consumes: the complete registry, UI, and daily-monitoring implementation.
- Produces: user-facing scope language and final verified build artifacts.

- [ ] **Step 1: Write failing scope-copy assertions**

In `tests/page-content.test.mjs`, require README and methodology copy containing all of these phrases:

```ts
for (const phrase of [
  '官方硕士奖学金入口',
  '不代表奖学金正在开放',
  '不代表用户符合条件或能够获奖',
  '具体项目、金额、资格、申请方式和期限全部以大学官网当时显示的信息为准',
]) {
  expect(`${readme}\n${methodology}`).toContain(phrase);
}
```

- [ ] **Step 2: Run the copy test and confirm the explanation is absent**

Run: `pnpm vitest run tests/page-content.test.mjs`

Expected: FAIL on the new scholarship wording.

- [ ] **Step 3: Add concise navigation-only documentation**

Add one sentence to the README feature summary and one paragraph to the methodology source/update section. State that the site verifies official destinations only, does not reproduce individual awards, and leaves availability, amount, eligibility, application method, and deadline to the live university page. Explain that “未发现公开硕士奖学金入口” is a reviewed non-clickable state, not proof that no internal or non-public support exists.

Add a “硕士奖学金入口年度复核” section to `CONTRIBUTING.md`: before each application season, reopen every row in the four research files, confirm the final URL, masters coverage or negative-evidence conclusion, page title, and both identity anchors, update group and evidence `reviewedAt`, rerun all four batch tests, and submit the reviewed changes through a normal pull request. Re-search every no-public-entry university for a newly published qualifying gateway. Explicitly forbid accepting a daily observation automatically.

- [ ] **Step 4: Regenerate and run the full automated verification**

Run: `pnpm build:public`

Run: `pnpm test:run`

Run: `pnpm build`

Expected: all tests pass; Astro check/build and both postbuild checks pass. Inspect `git status --short` and confirm `tests/search.test.ts` remains unstaged and no unrelated data changed.

- [ ] **Step 5: Run desktop browser acceptance**

Start `pnpm dev -- --host 127.0.0.1` and inspect at a desktop viewport:

- Imperial or another single-link university shows China source(s), “查看全部硕士课程”, then one “查看硕士奖学金官网” action.
- Manchester keeps its three China sources in the existing disclosure and shows the two new independent navigation actions without an extra column.
- A production multi-link scholarship university defaults closed, opens with mouse and keyboard, and shows every classified official page once.
- ICR shows one non-clickable “未发现公开硕士奖学金入口” action root and no scholarship anchor or empty disclosure.
- No university row overlaps, no action is clipped, and the console has no errors or warnings.

- [ ] **Step 6: Run 390px mobile acceptance**

At 390px, inspect the same cases. Confirm Chinese/English names, ranking pills, state, scope, China sources, course link, and scholarship action state stay in the existing card order; all action text wraps horizontally; no single-character vertical column or horizontal page overflow appears.

- [ ] **Step 7: Commit documentation and final generated output**

```bash
git add README.md src/pages/methodology.astro CONTRIBUTING.md tests/page-content.test.mjs public/generated/universities.json
git commit -m "docs: explain masters scholarship navigation"
```

- [ ] **Step 8: Perform final branch review**

Run: `git diff --check origin/main...HEAD`

Run: `git status --short`

Run: `git log --oneline origin/main..HEAD`

Expected: no whitespace errors; only scholarship feature files and the two design/plan documents are present; the pre-existing `tests/search.test.ts` modification is not staged or committed.
