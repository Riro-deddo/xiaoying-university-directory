# Expand UK Specialist Universities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the directory to 101 universities by adding RCA, RVC, RCM, ICR, and LSTM, give UAL and all eight specialists accurately typed strength evidence, and monitor five new official application sources without changing accepted Chinese-institution facts.

**Architecture:** Replace the specialist-only ranking object with an optional `strengthEvidence` value that any university can render through one presentation helper. Keep the 93 QS-directory records and QS/THE sorting untouched, add five link-only application sources and audit rows for the new specialists, then update SSR/public output and methodology scope from 96 to 101. Subject-strength sources remain catalog metadata and never enter the daily application-source checker.

**Tech Stack:** Astro 7.1.6, TypeScript 6.0.3, Node.js 22+, pnpm 10.13.1, Vitest 4.1.10, AJV JSON Schema, Fuse.js, LinkeDOM.

## Global Constraints

- Only display facts verified from university sites, official ranking-provider pages, or official UK research-assessment material.
- Keep exactly 93 `qs-directory` universities and exactly eight approved `specialist` universities, for 101 unique records total.
- The approved specialist IDs are `cranfield-university`, `institute-of-cancer-research-london`, `liverpool-school-of-tropical-medicine`, `london-business-school`, `london-school-of-hygiene-and-tropical-medicine`, `royal-college-of-art`, `royal-college-of-music`, and `royal-veterinary-college`.
- UAL remains `qs-directory`; it keeps its QS/THE overall rankings and receives only an additional subject-strength highlight.
- All eight specialists display QS 2027 and THE 2026 overall rankings as `—` and sort after all 93 QS-directory universities for QS, THE, and name sorts.
- Strength evidence does not affect sorting or applicant eligibility. Exact global ranks use `全球第`; bands use `全球 76–100` without `第`; REF evidence says `结果加权分析` and `英国第` and is never called a global ranking.
- Chinese application guidance and a complete Chinese undergraduate institution list are different concepts. Do not mark an institution as `official-list` unless a complete public list exists.
- The five new application sources use `link-only`; daily checks may record access failures or observed content changes but may not rewrite reviewed summaries.
- Do not modify `src/data/rankings.json`, accepted facts in `src/data/generated/requirements.json`, `src/data/institutions.json`, existing public List files, or existing reverse-index facts.
- Do not add dependencies, paid APIs, programme crawling, a third ranking sort, or any additional specialist institution.
- Preserve the current worktree's already verified 96-school scope changes and atomic reverse-index writer; commit them in Tasks 1–2 before editing overlapping files.
- Do not push, merge, or deploy. Stop after a local desktop/mobile preview and obtain explicit publication approval.

Use this PowerShell bootstrap before every Node/pnpm command in this environment:

```powershell
$runtimeNode = 'C:\Users\ROG\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$runtimeOverride = 'C:\Users\ROG\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\override'
$runtimeFallback = 'C:\Users\ROG\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback'
$env:Path = "$runtimeNode;$runtimeOverride;$runtimeFallback;$env:Path"
$env:npm_config_script_shell = 'powershell.exe'
$env:ASTRO_TELEMETRY_DISABLED = '1'
```

---

### Task 1: Checkpoint the verified atomic reverse-index writer

**Files:**
- Modify: `scripts/build-reverse-index.mjs`
- Test: `tests/reverse-index.test.mjs`

**Interfaces:**
- Consumes: the existing `buildReverseIndex(...)` result.
- Produces: `writeJsonAtomically(target: string, value: unknown): Promise<boolean>`, returning `false` without touching the target when serialized JSON is unchanged and otherwise replacing it atomically.

This change is already present in the working tree and already completed its RED → GREEN cycle. Preserve it instead of rewriting it.

- [ ] **Step 1: Inspect the isolated diff**

```powershell
git diff -- scripts/build-reverse-index.mjs tests/reverse-index.test.mjs
```

Expected: the helper compares existing serialized JSON, writes a UUID-named temporary file only when content differs, renames it to the target, and removes the temporary file in `finally`. The test repeatedly parses a 40,000-record target while an unchanged write runs.

- [ ] **Step 2: Run the focused regression test**

```powershell
node node_modules\vitest\vitest.mjs run tests/reverse-index.test.mjs
```

Expected: PASS; a no-op build does not rewrite `src/data/generated/reverse-index.json`, and concurrent readers never observe partial JSON.

- [ ] **Step 3: Commit only the atomic-write change**

```powershell
git add scripts/build-reverse-index.mjs tests/reverse-index.test.mjs
git diff --cached --check
git diff --cached --name-only
git commit -m "fix: keep generated reverse index stable"
```

Expected staged files: exactly the two files listed above.

---

### Task 2: Finish the already verified 96-school public scope checkpoint

**Files:**
- Modify: `scripts/check-initial-html.mjs`
- Modify: `src/lib/presentation.ts`
- Modify: `src/pages/methodology.astro`
- Modify: `tests/initial-html.test.mjs`
- Modify: `tests/page-content.test.mjs`
- Modify: `tests/public-data.test.mjs`
- Modify: `tests/search.test.ts`
- Generated: `public/generated/universities.json`

**Interfaces:**
- Consumes: the committed 93 QS-directory records plus LBS, LSHTM, and Cranfield.
- Produces: the existing intermediate 96-record public/SSR checkpoint, including `inspectProductionInitialHtml(...)` and the three-specialist scope copy. Later tasks intentionally expand this checkpoint to 101.

These changes are already present and have completed their RED → GREEN cycle. This task prevents the five-school expansion from being mixed with unfinished prior work.

- [ ] **Step 1: Verify the exact carry-forward diff**

```powershell
git diff -- scripts/check-initial-html.mjs src/lib/presentation.ts src/pages/methodology.astro tests/initial-html.test.mjs tests/page-content.test.mjs tests/public-data.test.mjs tests/search.test.ts public/generated/universities.json
```

Expected: scope 93 + 3, a 96-row SSR guard, three approved specialist explanations, 96 public records, and the missing `noteZh` in the specialist search fixture. No application facts or overall ranking records appear.

- [ ] **Step 2: Run focused tests, the full suite, and the production build**

```powershell
node node_modules\vitest\vitest.mjs run tests/initial-html.test.mjs tests/page-content.test.mjs tests/public-data.test.mjs tests/search.test.ts
pnpm test:run
pnpm build
```

Expected: all tests PASS; Astro check/build PASS with zero errors; the postbuild guard reports 96 unique QS-sorted rows.

- [ ] **Step 3: Prove protected facts did not drift**

```powershell
git diff -- src/data/rankings.json src/data/generated/requirements.json src/data/institutions.json src/data/generated/reverse-index.json
git diff -- public/generated/institutions.json public/generated/reverse-index.json public/generated/lists
```

Expected: no protected semantic diff. If the build changed only public timestamps or formatting, inspect each path and restore only those mechanical changes before continuing.

- [ ] **Step 4: Commit the 96-school checkpoint**

```powershell
git add scripts/check-initial-html.mjs src/lib/presentation.ts src/pages/methodology.astro tests/initial-html.test.mjs tests/page-content.test.mjs tests/public-data.test.mjs tests/search.test.ts public/generated/universities.json
git diff --cached --check
git commit -m "feat: publish the three-specialist directory scope"
```

---

### Task 3: Replace specialist-only rankings with universal strength evidence

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/data/universities.schema.json`
- Modify: `src/data/universities.json`
- Modify: `src/lib/presentation.ts`
- Modify: `src/pages/index.astro`
- Test: `tests/presentation.test.ts`
- Test: `tests/data.test.ts`
- Test: `tests/page-content.test.mjs`
- Test: `tests/search.test.ts`
- Test: `tests/public-data.test.mjs`
- Generated: `public/generated/universities.json`

**Interfaces:**
- Consumes: `University.specialistRanking`, `specialistRankingCopy(...)`, and the four existing 96-school highlight records (LBS, LSHTM, Cranfield, plus UAL without a highlight).
- Produces: `StrengthEvidence`, optional `University.strengthEvidence`, and `strengthEvidenceCopy(reference: StrengthEvidence): string`.

- [ ] **Step 1: Write failing presentation contracts**

Replace specialist helper coverage in `tests/presentation.test.ts` with exact, band, and REF cases:

```ts
import { strengthEvidenceCopy } from '../src/lib/presentation';

it.each([
  [{ kind: 'subject-ranking', provider: 'qs', rankingName: 'QS World University Rankings by Subject', subjectZh: '艺术与设计', edition: 2026, placement: 'exact', displayRank: '1', sourceUrl: 'https://example.test/rca', noteZh: '专业院校，不参与综合大学排序' }, 'QS 2026 艺术与设计全球第 1 · 专业院校，不参与综合大学排序'],
  [{ kind: 'subject-ranking', provider: 'shanghai', rankingName: 'ShanghaiRanking Global Ranking of Academic Subjects', subjectZh: '公共卫生', edition: 2025, placement: 'band', displayRank: '76–100', sourceUrl: 'https://example.test/lstm', noteZh: '专业院校，不参与综合大学排序' }, '软科 2025 公共卫生全球 76–100 · 专业院校，不参与综合大学排序'],
  [{ kind: 'research-assessment', provider: 'ref', rankingName: 'Research Excellence Framework 2021', subjectZh: '生物科学', edition: 2021, placement: 'derived-national-exact', displayRank: '1', sourceUrl: 'https://example.test/icr', noteZh: '不是全球学科榜' }, 'REF 2021 结果加权分析：生物科学英国第 1 · 不是全球学科榜'],
] as const)('renders strength evidence without changing its meaning', (reference, expected) => {
  expect(strengthEvidenceCopy(reference)).toBe(expected);
});
```

- [ ] **Step 2: Write failing schema, data, and page tests**

Add to `tests/data.test.ts` and `tests/page-content.test.mjs`:

```ts
expect(universities.every((item) => !('specialistRanking' in item))).toBe(true);
expect(universities.find((item) => item.id === 'university-of-the-arts-london')).toMatchObject({
  directoryCategory: 'qs-directory',
  strengthEvidence: { provider: 'qs', placement: 'exact', subjectZh: '艺术与设计', displayRank: '2' },
});
for (const id of ['london-business-school', 'cranfield-university', 'london-school-of-hygiene-and-tropical-medicine']) {
  expect(universities.find((item) => item.id === id)?.strengthEvidence).toBeDefined();
}
```

```js
expect(page).toContain('strengthEvidenceCopy(university.strengthEvidence)');
expect(page).not.toContain('specialistRankingCopy');
expect(page).not.toContain('university.id === \'university-of-the-arts-london\'');
```

Update specialist fixtures in `tests/search.test.ts` to use `strengthEvidence` with the complete new shape.

Update `tests/public-data.test.mjs` so the three existing specialists and UAL expose `strengthEvidence`, and assert that serialized records contain no `specialistRanking` key.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
node node_modules\vitest\vitest.mjs run tests/presentation.test.ts tests/data.test.ts tests/page-content.test.mjs tests/search.test.ts
```

Expected: FAIL because `StrengthEvidence`, `strengthEvidence`, and `strengthEvidenceCopy` do not exist and the page still uses the specialist-only property.

- [ ] **Step 4: Define the type and schema**

Replace `SpecialistRankingReference` in `src/lib/types.ts` with:

```ts
export interface StrengthEvidence {
  kind: 'subject-ranking' | 'research-assessment';
  provider: 'qs' | 'shanghai' | 'ref';
  rankingName: string;
  subjectZh: string;
  edition: number;
  placement: 'exact' | 'band' | 'derived-national-exact';
  displayRank: string;
  sourceUrl: string;
  noteZh: string;
}
```

Import `StrengthEvidence` into `src/lib/presentation.ts` from `./types` before adding the helper.

Change `University` to:

```ts
strengthEvidence?: StrengthEvidence;
```

In `src/data/universities.schema.json`, replace `specialistRanking` with `strengthEvidence`, require all nine fields, restrict the three enums exactly as above, require a positive integer `edition`, non-empty strings, and `^https://` for `sourceUrl`. Remove the current rule that forbids strength evidence on `qs-directory`; keep `qsDirectory` required only for that category.

- [ ] **Step 5: Migrate existing highlights and add UAL**

Rename the three existing objects and add `kind`/`placement`. Add this UAL value without changing its QS membership, rankings, state, sources, or note:

```json
"strengthEvidence": {
  "kind": "subject-ranking",
  "provider": "qs",
  "rankingName": "QS World University Rankings by Subject",
  "subjectZh": "艺术与设计",
  "edition": 2026,
  "placement": "exact",
  "displayRank": "2",
  "sourceUrl": "https://www.arts.ac.uk/about-ual/press-office/stories/qs-world-rankings-2026",
  "noteZh": "艺术与设计强势院校，仍参与 QS/THE 综合大学排序"
}
```

Use `placement: "exact"` for LBS, Cranfield, and LSHTM. Change LSHTM's evidence URL to the official ranking-provider page:

```text
https://www.shanghairanking.com/universities/london-school-of-hygiene-tropical-medicine
```

- [ ] **Step 6: Implement one data-driven presentation path**

Add to `src/lib/presentation.ts`:

```ts
export function strengthEvidenceCopy(reference: StrengthEvidence): string {
  const provider = reference.provider === 'qs' ? 'QS' : reference.provider === 'shanghai' ? '软科' : 'REF';
  const headline = reference.placement === 'band'
    ? `${provider} ${reference.edition} ${reference.subjectZh}全球 ${reference.displayRank}`
    : reference.placement === 'derived-national-exact'
      ? `${provider} ${reference.edition} 结果加权分析：${reference.subjectZh}英国第 ${reference.displayRank}`
      : `${provider} ${reference.edition} ${reference.subjectZh}全球第 ${reference.displayRank}`;
  return `${headline} · ${reference.noteZh}`;
}
```

In `src/pages/index.astro`, replace the `specialistRanking` conditional with:

```astro
{university.strengthEvidence && (
  <div class="specialist-detail">
    <a href={university.strengthEvidence.sourceUrl} target="_blank" rel="noopener noreferrer">
      {strengthEvidenceCopy(university.strengthEvidence)}
    </a>
  </div>
)}
```

Do not change the QS/THE cells or sort comparator.

- [ ] **Step 7: Run focused and full tests, regenerate public university data, and commit**

```powershell
node node_modules\vitest\vitest.mjs run tests/presentation.test.ts tests/data.test.ts tests/page-content.test.mjs tests/search.test.ts tests/public-data.test.mjs
node scripts/build-public-data.mjs
pnpm test:run
git diff --check
git add src/lib/types.ts src/data/universities.schema.json src/data/universities.json src/lib/presentation.ts src/pages/index.astro tests/presentation.test.ts tests/data.test.ts tests/page-content.test.mjs tests/search.test.ts tests/public-data.test.mjs public/generated/universities.json
git commit -m "refactor: generalize university strength evidence"
```

Expected: all tests PASS; the public records use `strengthEvidence`; no `specialistRanking` remains in source, tests, or public JSON.

---

### Task 4: Add five specialist institutions and monitored application sources

**Files:**
- Modify: `src/data/universities.json`
- Modify: `src/data/sources.json`
- Modify: `src/data/status.json`
- Modify: `src/data/china-rule-audit.json`
- Modify: `scripts/report-source-coverage.mjs`
- Test: `tests/data.test.ts`
- Test: `tests/catalog.test.ts`
- Test: `tests/search.test.ts`
- Test: `tests/directory-dom.test.ts`
- Test: `tests/source-coverage.test.mjs`
- Test: `tests/reverse-index.test.mjs`

**Interfaces:**
- Consumes: `StrengthEvidence`, existing link-only source/status/audit shapes, and `compareDirectoryUniversities(...)`.
- Produces: five stable university IDs, five application source IDs, five `unchecked` source statuses, and exact coverage for eight specialists.

- [ ] **Step 1: Write failing scope, identity, and search tests**

Use this exact approved set in `tests/data.test.ts` and `tests/source-coverage.test.mjs`:

```ts
const approvedSpecialistIds = [
  'cranfield-university',
  'institute-of-cancer-research-london',
  'liverpool-school-of-tropical-medicine',
  'london-business-school',
  'london-school-of-hygiene-and-tropical-medicine',
  'royal-college-of-art',
  'royal-college-of-music',
  'royal-veterinary-college',
];
expect(universities).toHaveLength(101);
expect(universities.filter((item) => item.directoryCategory === 'qs-directory')).toHaveLength(93);
expect(universities.filter((item) => item.directoryCategory === 'specialist').map((item) => item.id).sort())
  .toEqual(approvedSpecialistIds);
```

Add exact alias searches in `tests/search.test.ts`:

```ts
for (const [query, id] of [
  ['RCA', 'royal-college-of-art'],
  ['皇家兽医学院', 'royal-veterinary-college'],
  ['RCM', 'royal-college-of-music'],
  ['ICR', 'institute-of-cancer-research-london'],
  ['LSTM', 'liverpool-school-of-tropical-medicine'],
] as const) {
  expect(directory.search(query, []).map((item) => item.id)).toEqual([id]);
}
```

- [ ] **Step 2: Write failing source, audit, and no-List-fact tests**

In `tests/catalog.test.ts`, assert the exact mapping:

```ts
const expectedSources = [
  ['rca-postgraduate-entry', 'royal-college-of-art', 'https://www.rca.ac.uk/study/apply-to-study/'],
  ['rvc-international-entry', 'royal-veterinary-college', 'https://www.rvc.ac.uk/study/international-students/how-to-apply'],
  ['rcm-china-entry', 'royal-college-of-music', 'https://www.rcm.ac.uk/international/china/'],
  ['icr-msc-oncology-entry', 'institute-of-cancer-research-london', 'https://www.icr.ac.uk/study-and-careers/opportunities-for-clinicians/msc-in-oncology'],
  ['lstm-postgraduate-entry', 'liverpool-school-of-tropical-medicine', 'https://lstmed.ac.uk/study/'],
] as const;

for (const [sourceId, universityId, url] of expectedSources) {
  expect(sources.find((item) => item.id === sourceId)).toMatchObject({
    universityId, url, kind: 'china-requirements', parser: { mode: 'link-only' },
    institutionRule: { type: 'none', verification: { reviewedAt: '2026-08-09' } },
  });
  expect(statuses[sourceId]).toEqual({ sourceId, health: 'unchecked', consecutiveFailures: 0 });
  expect(requirements.some((fact) => fact.sourceId === sourceId)).toBe(false);
}
```

Add an ICR contract requiring the summary to contain `医学学位`, `两年临床经验`, `GMC`, `在英临床岗位`, and a sentence that it is not a general international taught master's route.

- [ ] **Step 3: Run the focused tests and verify RED**

```powershell
node node_modules\vitest\vitest.mjs run tests/data.test.ts tests/catalog.test.ts tests/search.test.ts tests/directory-dom.test.ts tests/source-coverage.test.mjs tests/reverse-index.test.mjs
```

Expected: FAIL on 96 versus 101, the missing five IDs/sources/statuses/audit rows, and the old three-specialist coverage allowlist.

- [ ] **Step 4: Add the five university records**

Add these identity/application fields to `src/data/universities.json`; each record also receives the `strengthEvidence` object shown in the next code block:

```json
[
  { "id": "royal-college-of-art", "nameZh": "皇家艺术学院", "nameEn": "Royal College of Art", "aliases": ["RCA"], "directoryCategory": "specialist", "state": "not-public", "officialDomain": "https://www.rca.ac.uk", "sourceIds": ["rca-postgraduate-entry"] },
  { "id": "royal-veterinary-college", "nameZh": "皇家兽医学院", "nameEn": "Royal Veterinary College", "aliases": ["RVC"], "directoryCategory": "specialist", "state": "not-public", "officialDomain": "https://www.rvc.ac.uk", "sourceIds": ["rvc-international-entry"] },
  { "id": "royal-college-of-music", "nameZh": "皇家音乐学院", "nameEn": "Royal College of Music", "aliases": ["RCM"], "directoryCategory": "specialist", "state": "china-requirements", "officialDomain": "https://www.rcm.ac.uk", "sourceIds": ["rcm-china-entry"] },
  { "id": "institute-of-cancer-research-london", "nameZh": "伦敦癌症研究院", "nameEn": "The Institute of Cancer Research, London", "aliases": ["ICR", "Institute of Cancer Research"], "directoryCategory": "specialist", "state": "not-public", "officialDomain": "https://www.icr.ac.uk", "sourceIds": ["icr-msc-oncology-entry"] },
  { "id": "liverpool-school-of-tropical-medicine", "nameZh": "利物浦热带医学院", "nameEn": "Liverpool School of Tropical Medicine", "aliases": ["LSTM"], "directoryCategory": "specialist", "state": "not-public", "officialDomain": "https://lstmed.ac.uk", "sourceIds": ["lstm-postgraduate-entry"] }
]
```

Use these exact strength facts:

```json
[
  { "id": "royal-college-of-art", "kind": "subject-ranking", "provider": "qs", "rankingName": "QS World University Rankings by Subject", "subjectZh": "艺术与设计", "edition": 2026, "placement": "exact", "displayRank": "1", "sourceUrl": "https://www.rca.ac.uk/news-and-events/news/royal-college-of-art-celebrates-12th-consecutive-year-as-the-worlds-leading-university-for-art-and-design/", "noteZh": "艺术与设计专业院校，不参与综合大学排序" },
  { "id": "royal-veterinary-college", "kind": "subject-ranking", "provider": "qs", "rankingName": "QS World University Rankings by Subject", "subjectZh": "兽医学", "edition": 2026, "placement": "exact", "displayRank": "1", "sourceUrl": "https://www.rvc.ac.uk/news-and-events/rvc-news/the-rvc-tops-global-rankings-once-again", "noteZh": "兽医学专业院校，不参与综合大学排序" },
  { "id": "royal-college-of-music", "kind": "subject-ranking", "provider": "qs", "rankingName": "QS World University Rankings by Subject", "subjectZh": "音乐与表演艺术", "edition": 2026, "placement": "exact", "displayRank": "2", "sourceUrl": "https://www.rcm.ac.uk/about/news/all/2026-03-26qsrankings2026.aspx", "noteZh": "音乐与表演艺术专业院校，不参与综合大学排序" },
  { "id": "institute-of-cancer-research-london", "kind": "research-assessment", "provider": "ref", "rankingName": "Research Excellence Framework 2021", "subjectZh": "生物科学", "edition": 2021, "placement": "derived-national-exact", "displayRank": "1", "sourceUrl": "https://www.icr.ac.uk/about-us/icr-news/detail/icr-rated-second-in-uk-among-all-higher-education-institutions-in-ref-2021-analysis", "noteZh": "癌症研究专业院校，不参与综合大学排序；该依据不是全球学科榜" },
  { "id": "liverpool-school-of-tropical-medicine", "kind": "subject-ranking", "provider": "shanghai", "rankingName": "ShanghaiRanking Global Ranking of Academic Subjects", "subjectZh": "公共卫生", "edition": 2025, "placement": "band", "displayRank": "76–100", "sourceUrl": "https://www.shanghairanking.com/universities/liverpool-school-of-tropical-medicine", "noteZh": "热带医学与公共卫生专业院校，不参与综合大学排序" }
]
```

Store each second-block object as the matching university's `strengthEvidence`, excluding its helper-only `id` key.

- [ ] **Step 5: Add five reviewed link-only application sources**

Create the five records in `src/data/sources.json` with the URL mapping from Step 2 and this exact reviewed content:

```ts
const sourceContent = {
  'rca-postgraduate-entry': {
    scope: 'university', scopeZh: '学校研究生课程申请入口',
    summaryZh: '申请要求按课程页核对，通常涉及学术背景、作品集和英语要求；未发现完整公开的中国本科院校名称名单。',
    requiredText: ['Apply to study'],
  },
  'rvc-international-entry': {
    scope: 'university', scopeZh: '学校面向国际学生的申请入口',
    summaryZh: '学术资格和其他条件按具体研究生课程页核对；未发现完整公开的中国本科院校名称名单。',
    requiredText: ['How to apply'],
  },
  'rcm-china-entry': {
    scope: 'university', scopeZh: '学校面向中国学生的申请说明',
    summaryZh: '中国学生按课程要求准备申请，并通过 UCAS Conservatoires 完成相应流程；作品集、试演或面试要求因课程而异。该页面不是中国本科院校准入名单。',
    requiredText: ['China', 'UCAS Conservatoires'],
  },
  'icr-msc-oncology-entry': {
    scope: 'programme', scopeZh: 'MSc Oncology（肿瘤学理学硕士，在职临床课程）',
    summaryZh: '该授课型项目是范围非常狭窄的在职临床课程，通常要求医学学位、至少两年临床经验、英国 GMC 注册和在英临床岗位；它不是面向普通国际学生的通用授课型硕士申请入口。',
    requiredText: ['MSc in Oncology', 'GMC', 'clinical'],
  },
  'lstm-postgraduate-entry': {
    scope: 'university', scopeZh: '学校研究生课程申请入口',
    summaryZh: '研究生入学要求按具体课程页面核对；未发现完整公开的中国本科院校名称名单。',
    requiredText: ['Study'],
  },
};
```

Construct every source with the exact top-level URL from Step 2 and set `institutionRule.verification.url` to that same value:

```ts
const source = {
  id: sourceId,
  universityId,
  labelZh: labels[sourceId],
  url,
  kind: 'china-requirements',
  scope: sourceContent[sourceId].scope,
  scopeZh: sourceContent[sourceId].scopeZh,
  institutionRule: {
    type: 'none',
    summaryZh: sourceContent[sourceId].summaryZh,
    verification: {
      reviewedAt: '2026-08-09',
      url,
      requiredText: sourceContent[sourceId].requiredText,
    },
  },
  parser: { mode: 'link-only', guard: { minimumRecords: 0, maximumRecords: 1, maximumRemovalRatio: 0 } },
};
```

Use these exact labels:

```ts
const labels = {
  'rca-postgraduate-entry': 'RCA 研究生课程申请入口',
  'rvc-international-entry': 'RVC 国际学生申请入口',
  'rcm-china-entry': 'RCM 中国学生申请说明',
  'icr-msc-oncology-entry': 'ICR 肿瘤学硕士申请要求',
  'lstm-postgraduate-entry': 'LSTM 研究生课程申请入口',
};
```

- [ ] **Step 6: Add source statuses, audit rows, and exact coverage**

Add these five statuses:

```json
{
  "rca-postgraduate-entry": { "sourceId": "rca-postgraduate-entry", "health": "unchecked", "consecutiveFailures": 0 },
  "rvc-international-entry": { "sourceId": "rvc-international-entry", "health": "unchecked", "consecutiveFailures": 0 },
  "rcm-china-entry": { "sourceId": "rcm-china-entry", "health": "unchecked", "consecutiveFailures": 0 },
  "icr-msc-oncology-entry": { "sourceId": "icr-msc-oncology-entry", "health": "unchecked", "consecutiveFailures": 0 },
  "lstm-postgraduate-entry": { "sourceId": "lstm-postgraduate-entry", "health": "unchecked", "consecutiveFailures": 0 }
}
```

Add these exact audit rows:

```json
[
  { "universityId": "royal-college-of-art", "directoryCategory": "specialist", "expectedState": "not-public", "reviewDate": "2026-08-09", "finding": "The reviewed postgraduate application page is not a complete public Chinese undergraduate institution roster." },
  { "universityId": "royal-veterinary-college", "directoryCategory": "specialist", "expectedState": "not-public", "reviewDate": "2026-08-09", "finding": "The reviewed international application page is not a complete public Chinese undergraduate institution roster." },
  { "universityId": "royal-college-of-music", "directoryCategory": "specialist", "expectedState": "china-requirements", "reviewDate": "2026-08-09", "finding": "The official China page provides application guidance but not a complete public Chinese undergraduate institution roster." },
  { "universityId": "institute-of-cancer-research-london", "directoryCategory": "specialist", "expectedState": "not-public", "reviewDate": "2026-08-09", "finding": "The reviewed MSc Oncology page covers a narrow clinical programme and is not a complete public Chinese undergraduate institution roster." },
  { "universityId": "liverpool-school-of-tropical-medicine", "directoryCategory": "specialist", "expectedState": "not-public", "reviewDate": "2026-08-09", "finding": "The reviewed postgraduate study entry is not a complete public Chinese undergraduate institution roster." }
]
```

Replace `approvedSpecialistIds` in `scripts/report-source-coverage.mjs` with the eight-ID sorted array from Step 1. Do not infer approval from `directoryCategory`; keep the exact allowlist.

- [ ] **Step 7: Prove link-only sources do not alter List facts or reverse index**

Add a regression in `tests/reverse-index.test.mjs` that builds the index with the real datasets and asserts:

```ts
const newUniversityIds = new Set([
  'royal-college-of-art', 'royal-veterinary-college', 'royal-college-of-music',
  'institute-of-cancer-research-london', 'liverpool-school-of-tropical-medicine',
]);
expect(index.some((entry) => newUniversityIds.has(entry.universityId))).toBe(false);
```

Also compare the protected reverse-index file to its pre-task bytes after running `pnpm build:index`.

- [ ] **Step 8: Run focused and full tests and commit**

```powershell
node node_modules\vitest\vitest.mjs run tests/data.test.ts tests/catalog.test.ts tests/search.test.ts tests/directory-dom.test.ts tests/source-coverage.test.mjs tests/reverse-index.test.mjs
pnpm test:run
git diff --check
git add src/data/universities.json src/data/sources.json src/data/status.json src/data/china-rule-audit.json scripts/report-source-coverage.mjs tests/data.test.ts tests/catalog.test.ts tests/search.test.ts tests/directory-dom.test.ts tests/source-coverage.test.mjs tests/reverse-index.test.mjs
git commit -m "feat: add five specialist institutions"
```

Expected: 101 unique university data records; five new source/status/audit records; all focused and full tests PASS; protected fact files remain unchanged.

---

### Task 5: Publish the 101-school scope, methodology, SSR guard, and public JSON

**Files:**
- Modify: `src/lib/presentation.ts`
- Modify: `src/pages/methodology.astro`
- Modify: `scripts/check-initial-html.mjs`
- Modify: `tests/page-content.test.mjs`
- Modify: `tests/initial-html.test.mjs`
- Modify: `tests/public-data.test.mjs`
- Generated: `public/generated/universities.json`

**Interfaces:**
- Consumes: 101 joined university records and all nine `strengthEvidence` values (UAL plus eight specialists).
- Produces: `directoryScopeCopy = '93 所 QS 2027 英国院校 + 8 所特色院校'`, a 101-row QS-first SSR page, and a 101-record public university JSON.

- [ ] **Step 1: Write failing page, SSR, and public-output tests**

Use these assertions:

```js
expect(presentation).toContain("directoryScopeCopy = '93 所 QS 2027 英国院校 + 8 所特色院校'");
expect(methodology).toContain('学科精确名次');
expect(methodology).toContain('排名区间');
expect(methodology).toContain('REF 2021 结果加权分析');
expect(methodology).toContain('不是全球学科榜');
```

Set production HTML options to:

```js
{
  expectedDirectoryCount: 101,
  expectedFirstIds: ['imperial-college-london', 'university-of-oxford', 'university-of-cambridge'],
  expectedLastId: 'institute-of-cancer-research-london',
}
```

The last ID follows the existing specialist English-name then stable-ID comparator. In `tests/public-data.test.mjs`, require 101 unique IDs, 93 QS records, eight specialists with `rankings: {}`, UAL with non-empty QS/THE rankings, and nine `strengthEvidence` values.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
node node_modules\vitest\vitest.mjs run tests/page-content.test.mjs tests/initial-html.test.mjs tests/public-data.test.mjs
```

Expected: FAIL on the old 93 + 3 copy, 96-row guard, old last ID, and stale 96-record public JSON.

- [ ] **Step 3: Update scope and methodology without adding a new sort**

Set:

```ts
export const directoryScopeCopy = '93 所 QS 2027 英国院校 + 8 所特色院校';
```

Update `src/pages/methodology.astro` to explain:

```text
学科精确名次：例如 QS 2026 艺术与设计全球第 1。
排名区间：例如软科 2025 公共卫生全球 76–100，区间不写成“第 76–100”。
REF 2021 结果加权分析：ICR 的“生物科学英国第 1”是对英国研究评估结果的加权分析，不是全球学科榜。
这些亮点不改变 QS/THE 综合排名、不参与排序，也不用于判断申请资格。
```

Keep the existing QS/THE buttons and all ranking-year copy unchanged.

- [ ] **Step 4: Update the production SSR guard to 101**

In `inspectProductionInitialHtml(...)`, set the exact options from Step 1. Update fixtures so they contain 101 unique rows and reject the old 96-row directory, duplicate IDs, wrong first IDs, and a wrong last specialist.

- [ ] **Step 5: Generate and inspect public data**

```powershell
node scripts/build-public-data.mjs
git diff -- public/generated/universities.json
git diff -- src/data/rankings.json src/data/generated/requirements.json src/data/institutions.json src/data/generated/reverse-index.json
git diff -- public/generated/institutions.json public/generated/reverse-index.json public/generated/lists
```

Expected: `public/generated/universities.json` has 101 records and nine `strengthEvidence` values. Protected facts and existing public List content have no semantic change.

- [ ] **Step 6: Run focused, full, and build verification**

```powershell
node node_modules\vitest\vitest.mjs run tests/page-content.test.mjs tests/initial-html.test.mjs tests/public-data.test.mjs
pnpm test:run
pnpm build
git diff --check
```

Expected: all tests PASS; Astro reports zero errors and zero warnings; postbuild reports 101 unique QS-sorted rows; no generated fact drift remains.

- [ ] **Step 7: Commit the public 101-school scope**

```powershell
git add src/lib/presentation.ts src/pages/methodology.astro scripts/check-initial-html.mjs tests/page-content.test.mjs tests/initial-html.test.mjs tests/public-data.test.mjs public/generated/universities.json
git diff --cached --check
git commit -m "feat: publish the 101-school specialist directory"
```

---

### Task 6: Final regression and local rendered-browser QA

**Files:**
- Verify only: all files changed in Tasks 1–5
- Temporary evidence outside the repository: desktop and 390px mobile screenshots

**Interfaces:**
- Consumes: the production build and local preview URL.
- Produces: test/build/browser evidence for user approval; no push, PR, merge, or deployment.

- [ ] **Step 1: Run a fresh final verification**

```powershell
pnpm test:run
pnpm build
git diff --check
git status --short
git diff -- src/data/rankings.json src/data/generated/requirements.json src/data/institutions.json src/data/generated/reverse-index.json
```

Expected: tests PASS; build PASS; worktree clean; all four protected files have no feature diff.

- [ ] **Step 2: Start a production preview**

```powershell
pnpm exec astro preview --host 127.0.0.1 --port 4323
```

Keep `http://127.0.0.1:4323/` running. Use the in-app Browser first according to `browser:control-in-app-browser` and `build-web-apps:frontend-testing-debugging`; only fall back when the Browser skill's recovery procedure permits it.

- [ ] **Step 3: Verify desktop behavior**

At 1440×1000, verify:

```text
101 rendered university rows and 101 unique data-id values
QS default first rows remain Imperial, Oxford, Cambridge
all eight specialists remain after the 93 QS-directory rows in QS, THE, and name sorts
UAL keeps its QS/THE values and shows QS 2026 艺术与设计全球第 2
RCA/RVC/RCM exact ranks use 全球第
LSTM uses 全球 76–100 without 第
ICR uses REF 2021 结果加权分析 and 英国第 1, not 全球
RCA, RVC, RCM, ICR, and LSTM searches each return exactly one row
the 中国申请要求 filter includes RCM and excludes the four not-public newcomers
all five official application links and all nine evidence links are HTTPS
console errors/warnings = 0; framework overlay absent; horizontal overflow = 0
```

- [ ] **Step 4: Verify ICR's safety boundary**

Search `ICR` and confirm the card visibly states the narrow part-time clinical route, medical degree, two years of clinical experience, UK GMC registration, and UK clinical post. It must not read like a general international taught master's option.

- [ ] **Step 5: Verify 390px mobile layout**

At 390×844, search UAL and each new specialist. Confirm Chinese/English names, state, QS/THE pills, strength link, application summary, and source action wrap normally without one-character vertical columns, overlap, clipping, or horizontal scrolling. Open at least one long ICR card and the LSTM band card. Save desktop and mobile screenshots outside the repository.

- [ ] **Step 6: Stop preview and report for publication approval**

Stop the preview process. Report the exact test count, build result, Browser surface, desktop/mobile findings, screenshot paths, commit list, and protected-data comparison. If Browser QA reveals a defect, use `superpowers:systematic-debugging` and `superpowers:test-driven-development`, add a failing regression, fix it, rerun Task 6, and commit the fix. Do not publish until the user explicitly approves.
