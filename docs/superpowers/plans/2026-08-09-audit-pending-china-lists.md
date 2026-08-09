# Pending China-List Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete a traceable official-source review of all 65 currently pending universities, publish genuine Chinese-institution lists or faculty lists where available, and classify official China requirements without inventing lists.

**Architecture:** Extend the audit matrix with an explicit review lifecycle, then process the fixed 65-university cohort in five evidence batches. Each batch uses official-domain discovery, writes reviewed source semantics into the existing catalog, accepts structured facts only through the guarded source synchronizer, and is protected by a batch-specific failing test before any production data changes.

**Tech Stack:** Astro 7, TypeScript 6, Vitest 4, JSON Schema/Ajv, Node.js 22, existing guarded HTML/PDF source parsers, GitHub Actions daily source review, in-app Browser QA.

## Global Constraints

- Audit exactly the 65 universities that were `pending` at feature start; do not expand or shrink the 101-university directory.
- Use only university/faculty official pages, first-party country selectors, and official first-party downloads as facts.
- Third-party pages may identify candidates but must never be stored as a source or quoted as evidence.
- A normal China percentage/degree requirement becomes `china-requirements`, never an `official-list`.
- Use `official-list` only for a university-wide, deterministically identifiable roster/group; use `faculty-only` for faculty/programme-specific rosters.
- `not-public` requires affirmative official evidence that institution background or an internal list matters but members are not public; absence from search alone remains `pending` with `reviewStatus: "blocked"`.
- Do not modify any existing reviewed university facts, QS/THE rankings, specialist strength evidence, or UI layout.
- New source URLs must be HTTPS and owned or first-party linked by the reviewed university/faculty.
- Daily checking may record observations but must not auto-rewrite accepted summaries, states, or rules.
- No new dependency and no paid API.
- Every production change follows RED → GREEN; no data update before its batch test fails for the expected missing review.
- Stop before push, PR, merge, or deployment until final verification and integration handoff.

---

### Task 1: Add an Explicit Audit Review Lifecycle

**Files:**
- Create: `tests/fixtures/pending-china-audit-baseline.json`
- Modify: `src/data/china-rule-audit.schema.json`
- Modify: `src/data/china-rule-audit.json`
- Modify: `scripts/report-source-coverage.mjs`
- Modify: `tests/source-coverage.test.mjs`
- Modify: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: existing audit rows `{ universityId, directoryCategory, expectedState, reviewDate, finding }`.
- Produces: required `reviewStatus: "unreviewed" | "reviewed" | "blocked"`; source coverage treats `unreviewed` as incomplete while permitting evidence-specific `blocked` rows to remain `pending` without a source; baseline fixture freezes the 65 target IDs, 36 non-target university objects, every pre-existing source config, and the count plus SHA-256 digest of requirement facts belonging to pre-existing source IDs.

- [ ] **Step 1: Capture the immutable feature-start baseline fixture**

Create `tests/fixtures/pending-china-audit-baseline.json` from the current committed data before any lifecycle or university/source edit. Store:

```json
{
  "targetIds": ["the exact 65 current pending university IDs in catalog order"],
  "reviewedUniversities": ["the exact 36 non-target university objects"],
  "reviewedSources": ["every exact pre-existing source object"],
  "reviewedRequirementCount": 5754,
  "reviewedRequirementSha256": "the SHA-256 of JSON.stringify(requirements) at feature start"
}
```

The quoted descriptions above specify the fixture members, not literal values: write the actual JSON objects, IDs, and computed 64-character digest produced from the current files. Later tests must filter requirement facts by the fixture's pre-existing source IDs before recomputing the digest, so newly accepted sources do not affect the protected baseline.

- [ ] **Step 2: Write the failing lifecycle schema and reporting tests**

Add assertions equivalent to:

```ts
expect(audit).toHaveLength(101);
expect(audit.every((row) => ['unreviewed', 'reviewed', 'blocked'].includes(row.reviewStatus))).toBe(true);
expect(audit.filter((row) => row.expectedState !== 'pending').every((row) => row.reviewStatus === 'reviewed')).toBe(true);
expect(audit.filter((row) => row.expectedState === 'pending')).toHaveLength(65);
expect(audit.filter((row) => row.expectedState === 'pending').every((row) => row.reviewStatus === 'unreviewed')).toBe(true);
```

In `tests/source-coverage.test.mjs`, mutate one pending row to `reviewStatus: 'blocked'` with a specific finding and assert that it no longer produces `pending university` or `missing source`; keep `reviewStatus: 'unreviewed'` as a coverage failure.

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:

```powershell
$env:PATH='C:\Users\ROG\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\ROG\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;' + $env:PATH
pnpm exec vitest run tests/source-coverage.test.mjs tests/catalog.test.ts
```

Expected: schema validation and lifecycle assertions fail because `reviewStatus` does not exist.

- [ ] **Step 4: Implement the lifecycle field and reporter semantics**

Require the field in the audit schema:

```json
"reviewStatus": { "enum": ["unreviewed", "reviewed", "blocked"] }
```

Set all 36 existing non-pending reviewed rows to `"reviewStatus":"reviewed"`; set exactly the 65 target rows to `"reviewStatus":"unreviewed"`. In `report-source-coverage.mjs`, fail an audit target only when `reviewStatus === 'unreviewed'`; require sources for `reviewed` non-pending states, and allow `blocked` + `pending` to remain source-free.

- [ ] **Step 5: Run the focused tests and confirm GREEN**

Run the Step 3 command. Expected: both files pass and the audit still contains 101 unique university IDs.

- [ ] **Step 6: Commit the lifecycle contract**

```powershell
git add tests/fixtures/pending-china-audit-baseline.json src/data/china-rule-audit.schema.json src/data/china-rule-audit.json scripts/report-source-coverage.mjs tests/source-coverage.test.mjs tests/catalog.test.ts
git commit -m "feat: track pending audit review lifecycle"
```

---

### Task 2: Review Batch 1 — Highest-Ranked Pending Universities

**Files:**
- Read: `tests/fixtures/pending-china-audit-baseline.json`
- Create: `tests/pending-china-audit.test.ts`
- Modify: `src/data/universities.json`
- Modify: `src/data/sources.json`
- Modify: `src/data/status.json`
- Modify: `src/data/china-rule-audit.json`
- Modify when a guarded public list is accepted: `src/data/institutions.json`
- Modify when a guarded public list is accepted: `src/data/generated/requirements.json`

**Interfaces:**
- Consumes batch IDs: `loughborough-university`, `university-of-strathclyde`, `university-of-surrey`, `university-of-sussex`, `university-of-aberdeen`, `university-of-leicester`, `swansea-university`, `heriot-watt-university`, `brunel-university-of-london`, `birkbeck-university-of-london`, `city-st-georges-university-of-london`, `university-of-east-anglia`, `oxford-brookes-university`.
- Produces reviewed or blocked audit outcomes plus official sources and guarded facts for those 13 universities.

- [ ] **Step 1: Collect official evidence for the exact batch**

For each ID, run a domain-limited query combining its official domain with `China postgraduate entry requirements`, `Chinese university list`, `recognised institution`, `country requirements`, and `PDF`; then inspect official university navigation and faculty links. Record the final official URL, exact page anchors, scope, rule meaning, and whether a deterministically identifiable institution roster exists. Keep third-party-only cases as `blocked` + `pending`.

- [ ] **Step 2: Write the failing batch test**

Create `tests/pending-china-audit.test.ts` with the 13 IDs and a helper that asserts:

```ts
for (const id of batch1Ids) {
  const university = universityById.get(id)!;
  const auditRow = auditById.get(id)!;
  expect(auditRow.reviewStatus).not.toBe('unreviewed');
  expect(auditRow.reviewDate).toBe('2026-08-09');
  expect(auditRow.finding).not.toContain('have not yet been reviewed');
  expect(auditRow.expectedState).toBe(university.state);
  if (auditRow.reviewStatus === 'reviewed') {
    expect(university.state).not.toBe('pending');
    expect(university.sourceIds.length).toBeGreaterThan(0);
  } else {
    expect(auditRow.reviewStatus).toBe('blocked');
    expect(university.state).toBe('pending');
  }
}
```

Also assert that every referenced source belongs to the same `universityId`, uses HTTPS, contains `institutionRule.verification.reviewedAt === '2026-08-09'`, and has at least two exact `requiredText` anchors.

- [ ] **Step 3: Run the focused test and confirm RED**

Run `pnpm exec vitest run tests/pending-china-audit.test.ts tests/data.test.ts`. Expected: all 13 rows fail because their lifecycle remains `unreviewed`.

- [ ] **Step 4: Write minimal reviewed data for the batch**

Update each university, audit row, and source using the approved state rules. Use `parser.mode: "link-only"` with a zero-record guard when no roster can be reliably extracted. Use an existing guarded parser mode only when the official page exposes stable rows and the verification anchors confirm the list meaning.

- [ ] **Step 5: Accept only the batch’s guarded sources**

Run a Node 22 one-shot import of `syncRegisteredSources` with `options.sources` filtered to the new batch source IDs. Inspect every new requirement fact, source hash, canonical Chinese institution match, parser count, and anomaly before keeping the generated data. If extraction is partial or ambiguous, revert those generated facts, use `link-only`, and state that the official entry is confirmed but the structured list is not yet recorded.

- [ ] **Step 6: Run the focused tests and confirm GREEN**

Run `pnpm exec vitest run tests/pending-china-audit.test.ts tests/data.test.ts tests/catalog.test.ts tests/source-coverage.test.mjs`. Expected: Batch 1 passes and existing reviewed source tests remain green.

- [ ] **Step 7: Commit Batch 1**

```powershell
git add src/data tests/pending-china-audit.test.ts
git commit -m "data: review first pending China-rule batch"
```

---

### Task 3: Review Batch 2 — Mid-Directory Research Universities

**Files:**
- Modify: `tests/pending-china-audit.test.ts`
- Modify: `src/data/universities.json`
- Modify: `src/data/sources.json`
- Modify: `src/data/status.json`
- Modify: `src/data/china-rule-audit.json`
- Modify for accepted lists: `src/data/institutions.json`
- Modify for accepted lists: `src/data/generated/requirements.json`

**Interfaces:**
- Consumes batch IDs: `university-of-kent`, `aston-university`, `university-of-essex`, `university-of-dundee`, `soas-university-of-london`, `royal-holloway-university-of-london`, `university-of-bradford`, `university-of-huddersfield`, `northumbria-university`, `university-of-stirling`, `bangor-university`, `university-of-hull`, `coventry-university`.
- Produces reviewed or blocked outcomes and same-university official evidence for these 13 IDs.

- [ ] **Step 1: Collect official university and faculty evidence**

Apply the same official-domain discovery terms to all 13 IDs, following official country selectors and downloadable files. Confirm postgraduate applicability separately from undergraduate pages and record faculty/programme scope whenever the rule is not university-wide.

- [ ] **Step 2: Add a failing Batch 2 test**

Add `batch2Ids` and run the same lifecycle/source assertions used by Batch 1. Add an explicit assertion that `faculty-only` universities have at least one source whose `scope` is `faculty` or `programme`, while `official-list` universities have a university-scoped list source.

- [ ] **Step 3: Run RED**

Run `pnpm exec vitest run tests/pending-china-audit.test.ts`. Expected: the 13 new Batch 2 cases fail as `unreviewed`; Batch 1 remains green.

- [ ] **Step 4: Add only evidence-supported states and sources**

Update catalog, audit, source, and status records. Preserve `pending` only with `reviewStatus: "blocked"` and a precise reason such as inaccessible first-party selector, conflicting official pages, or third-party-only roster.

- [ ] **Step 5: Run guarded synchronization only for Batch 2 source IDs**

Use `syncRegisteredSources({ sources: sources.filter((source) => batch2SourceIds.has(source.id)) })`, inspect all new facts/anomalies, and retain structured facts only when guard counts and official meanings are complete.

- [ ] **Step 6: Run GREEN and commit**

Run the focused four-file suite from Task 2 Step 6. Then:

```powershell
git add src/data tests/pending-china-audit.test.ts
git commit -m "data: review second pending China-rule batch"
```

---

### Task 4: Review Batch 3 — Applied and Modern Universities

**Files:**
- Modify: `tests/pending-china-audit.test.ts`
- Modify: `src/data/universities.json`
- Modify: `src/data/sources.json`
- Modify: `src/data/status.json`
- Modify: `src/data/china-rule-audit.json`
- Modify for accepted lists: `src/data/institutions.json`
- Modify for accepted lists: `src/data/generated/requirements.json`

**Interfaces:**
- Consumes batch IDs: `ulster-university`, `manchester-metropolitan-university`, `nottingham-trent-university`, `university-of-portsmouth`, `kingston-university-london`, `university-of-plymouth`, `goldsmiths-university-of-london`, `university-of-the-west-of-england`, `university-of-greenwich`, `aberystwyth-university`, `bournemouth-university`, `edinburgh-napier-university`, `keele-university`.
- Produces reviewed or blocked outcomes plus guarded official evidence for these 13 IDs.

- [ ] **Step 1: Review all 13 official domains**

Search each official domain and follow first-party country pages, qualification databases, downloadable admissions documents, business-school/faculty pages, and postgraduate course requirements. Treat agent-facing PDFs as facts only when the university itself hosts or links them and their current cycle is clear.

- [ ] **Step 2: Add and run the failing Batch 3 contract**

Append the exact `batch3Ids` array to `tests/pending-china-audit.test.ts`, apply the lifecycle, source ownership, scope, HTTPS, and verification-anchor assertions, and run the file. Expected: only Batch 3 is RED.

- [ ] **Step 3: Implement minimal Batch 3 data**

Write the official source entries and reviewed findings. Do not infer a whitelist from words such as `recognised`, `reputable`, or `well-ranked`; those remain `china-requirements` unless the official source identifies roster membership.

- [ ] **Step 4: Synchronize only parser-enabled Batch 3 sources**

Filter `syncRegisteredSources` to the new source IDs, inspect generated facts and anomalies, and reject incomplete list extraction by returning that source to `link-only`.

- [ ] **Step 5: Run GREEN and commit**

Run the focused four-file suite and commit:

```powershell
git add src/data tests/pending-china-audit.test.ts
git commit -m "data: review third pending China-rule batch"
```

---

### Task 5: Review Batch 4 — London, Arts, and Regional Universities

**Files:**
- Modify: `tests/pending-china-audit.test.ts`
- Modify: `src/data/universities.json`
- Modify: `src/data/sources.json`
- Modify: `src/data/status.json`
- Modify: `src/data/china-rule-audit.json`
- Modify for accepted lists: `src/data/institutions.json`
- Modify for accepted lists: `src/data/generated/requirements.json`

**Interfaces:**
- Consumes batch IDs: `de-montfort-university`, `liverpool-john-moores-university`, `university-of-hertfordshire`, `university-of-lincoln`, `university-of-the-arts-london`, `university-of-westminster`, `london-south-bank-university`, `middlesex-university`, `university-of-brighton`, `anglia-ruskin-university`, `birmingham-city-university`, `glasgow-caledonian-university`, `leeds-beckett-university`.
- Produces reviewed or blocked outcomes plus guarded official evidence for these 13 IDs.

- [ ] **Step 1: Collect current postgraduate China evidence**

Review official international-country pages and specialist faculty/course pages. For UAL and other portfolio-based institutions, keep portfolio or course requirements separate from Chinese institution-list evidence; the existing subject-strength note must not affect the China-rule state.

- [ ] **Step 2: Add the failing Batch 4 contract**

Append `batch4Ids` to the test and assert the same lifecycle and ownership rules. Add a regression assertion that UAL retains its existing `strengthEvidence` unchanged while its China-rule state is reviewed independently.

- [ ] **Step 3: Run RED, implement evidence-supported data, and synchronize the batch**

Run the focused test, update only Batch 4 records, and invoke filtered guarded synchronization for Batch 4 sources. Reject parser output when a page lists partner institutions, articulation agreements, or undergraduate entry qualifications rather than postgraduate Chinese-university rules.

- [ ] **Step 4: Run GREEN and commit**

Run the focused four-file suite and commit:

```powershell
git add src/data tests/pending-china-audit.test.ts
git commit -m "data: review fourth pending China-rule batch"
```

---

### Task 6: Review Batch 5 — Remaining Directory Universities

**Files:**
- Modify: `tests/pending-china-audit.test.ts`
- Modify: `src/data/universities.json`
- Modify: `src/data/sources.json`
- Modify: `src/data/status.json`
- Modify: `src/data/china-rule-audit.json`
- Modify for accepted lists: `src/data/institutions.json`
- Modify for accepted lists: `src/data/generated/requirements.json`

**Interfaces:**
- Consumes batch IDs: `london-metropolitan-university`, `robert-gordon-university`, `sheffield-hallam-university`, `university-of-east-london`, `university-of-lancashire`, `university-of-roehampton`, `university-of-salford`, `university-of-wolverhampton`, `queen-margaret-university-edinburgh`, `university-of-northampton`, `university-of-derby`, `university-of-south-wales`, `canterbury-christ-church-university`.
- Produces the final reviewed or blocked outcomes and closes the 65-target cohort.

- [ ] **Step 1: Review the 13 official domains**

Check current university China/country pages, qualification tables, postgraduate course rules, faculty pages, and first-party downloads. Record `blocked` rather than `not-public` when the only evidence is an inaccessible selector or a third-party claim.

- [ ] **Step 2: Add and run the failing Batch 5 test**

Append the corrected 13-ID array, assert a 65-ID unique union, and apply all lifecycle/source rules. Expected: Batch 5 fails before data changes while Batches 1–4 pass.

- [ ] **Step 3: Implement and synchronize Batch 5**

Update only the 13 target records, filter guarded synchronization to their new sources, inspect new facts and anomalies, and preserve source-free pending only for evidence-specific `blocked` rows.

- [ ] **Step 4: Run GREEN and commit**

Run the focused four-file suite and commit:

```powershell
git add src/data tests/pending-china-audit.test.ts
git commit -m "data: complete pending China-rule review"
```

---

### Task 7: Lock Global Data Integrity and Generated Outputs

**Files:**
- Modify: `tests/pending-china-audit.test.ts`
- Modify: `tests/catalog.test.ts`
- Modify: `tests/source-coverage.test.mjs`
- Regenerate: `src/data/generated/reverse-index.json`
- Regenerate when list facts changed: `src/data/generated/requirements.json`
- Regenerate: `public/generated/universities.json`
- Regenerate when list facts changed: `public/generated/institutions.json`
- Regenerate when list facts changed: `public/generated/lists/*.json`
- Regenerate when list facts changed: `public/generated/reverse-index.json`

**Interfaces:**
- Consumes: the five reviewed batches, all new official sources, and all guarded requirement facts.
- Produces: a 101-row catalog with zero `unreviewed` audit rows and mechanically consistent public data.

- [ ] **Step 1: Write the failing final-cohort assertions**

Assert:

```ts
expect(new Set(allBatchIds).size).toBe(65);
expect(allBatchIds.every((id) => auditById.get(id)?.reviewStatus !== 'unreviewed')).toBe(true);
expect(universities).toHaveLength(101);
expect(universities.filter((item) => item.directoryCategory === 'qs-directory')).toHaveLength(93);
expect(universities.filter((item) => item.directoryCategory === 'specialist')).toHaveLength(8);
expect(sources.every((source) => source.url.startsWith('https://'))).toBe(true);
expect(requirements.every((fact) => sourceById.get(fact.sourceId)?.parser.mode !== 'link-only')).toBe(true);
```

Also deep-compare non-target university objects and pre-existing source objects against the feature-start fixture. Filter current requirement facts to the fixture's pre-existing source IDs, assert the count is `reviewedRequirementCount`, and assert their `JSON.stringify` SHA-256 equals `reviewedRequirementSha256`.

- [ ] **Step 2: Run RED if any batch or baseline contract is incomplete**

Run `pnpm exec vitest run tests/pending-china-audit.test.ts tests/catalog.test.ts tests/source-coverage.test.mjs tests/reverse-index.test.mjs tests/public-data.test.mjs`.

- [ ] **Step 3: Regenerate through repository scripts**

Run:

```powershell
pnpm build:index
pnpm build
```

Keep only generated changes causally produced by reviewed states/sources/lists. Restore unrelated timestamp-only or existing-source drift.

- [ ] **Step 4: Run GREEN and commit generated integrity**

Run the Step 2 suite, then:

```powershell
git add src/data/generated public/generated tests/pending-china-audit.test.ts tests/catalog.test.ts tests/source-coverage.test.mjs
git commit -m "test: protect reviewed China-rule coverage"
```

---

### Task 8: Full Verification and Rendered QA

**Files:**
- No production file should change unless QA exposes a regression; any fix requires its own RED → GREEN cycle.
- Write screenshots and QA notes outside the repository.

**Interfaces:**
- Consumes: final static build and generated 101-university directory.
- Produces: reproducible test/build evidence and desktop/mobile browser evidence, stopping before publication.

**Faculty-list acceptance:** This is conditional on accepted structured faculty/programme facts. When the current `faculty-only` count is zero, record N/A only after validating a faculty/programme-scoped official source card and confirming that it exposes no structured List; never fabricate a list to satisfy QA.

- [ ] **Step 1: Run fresh repository verification**

```powershell
pnpm test:run
pnpm build
git diff --check
git status --short
```

Expected: all tests pass, Astro reports zero errors/warnings, initial HTML guard reports 101 unique rows, and only intentional reviewed-data/generated diffs remain.

- [ ] **Step 2: Start a production preview**

Use the existing `astro preview` path on an available `127.0.0.1` port. The flow under test is: directory loads → filter each reviewed state → search representative updated universities → open a full list and faculty list → inspect source links and evidence → repeat at 390×844.

- [ ] **Step 3: Run in-app Browser desktop QA**

At 1440×1000 verify page identity, 101 unique rows, no overlay, no console warnings/errors, no overflow, and representative cases for `official-list`, `faculty-only`, `china-requirements`, `not-public`, and blocked `pending`. Open one new structured List and confirm its count, scope, source link, and sampled Chinese institutions against the official evidence.

- [ ] **Step 4: Run in-app Browser mobile QA**

At 390×844 verify updated state labels, long university names, ranking pills, source links, and an expanded new list without clipping or horizontal overflow. Exercise search and one status filter and confirm real visible-row changes.

- [ ] **Step 5: Capture evidence and stop before publishing**

Save desktop and mobile screenshots outside the repository, stop the preview, verify the worktree is clean after committed changes, and invoke `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, then `superpowers:finishing-a-development-branch` for the integration decision.
