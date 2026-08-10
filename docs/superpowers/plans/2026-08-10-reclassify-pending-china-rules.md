# 待确认院校状态纠正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 11 所“待确认”院校按当前官方证据纠正为 9 所“中国申请要求”和 2 所“官网暂无可核验规则”，同时保持零伪造院校名单和现有每日巡查安全边界。

**Architecture:** 沿用现有 `universities → sources/status/audit → public generated data → Astro UI` 数据流。9 个新证据全部作为大学层级、第一方 HTTPS、`link-only`、零结构化记录的来源登记；UAL 和 UEL 保持内部 `pending`/`blocked`，只改善用户可见文案。先通过精确数据合同测试锁定证据，再更新源数据、生成公开快照并做浏览器验收。

**Tech Stack:** Astro、TypeScript、JSON Schema、Vitest、Node.js、GitHub Actions、GitHub Pages。

## Global Constraints

- 目录必须保持 101 所：93 所 QS 2027 英国院校 + 8 所特色院校。
- QS/THE 排名、特色院校说明、院校身份、已有院校 List、`institutions.json` 和 `requirements.json` 不得改变。
- 9 个新增来源必须是当前官方第一方 HTTPS 页面，且全部为 `china-requirements`、`scope: university`、`parser.mode: link-only`、零结构化记录。
- 不得从 211、985、认可院校、高排名院校、精英院校或其他模糊类别推断中国大学成员。
- UAL 和 UEL 保持 `pending`、`reviewStatus: blocked`、`sourceIds: []`；不得为缺失页面创建虚假巡查来源。
- “官网暂无可核验规则”只陈述本站当前公开证据边界，不得声称学校没有内部规则或不能申请。
- 每日巡查只记录可达性、成功日期和内容变化；未经人工确认，不自动改写状态、摘要、成绩要求或院校事实。
- 所有生产文件修改使用 `apply_patch`；生成文件只能通过现有生成命令产生。
- 每个实现任务必须遵循 RED → GREEN → review → commit。

## File Structure

- `tests/pending-china-audit.test.ts`：锁定 11 所精确状态、9 个来源的 URL/语义/锚点/零事实合同和 UAL/UEL source-free 合同。
- `tests/source-coverage.test.mjs`：更新完整目录生命周期、来源数量和 CLI 输出合同。
- `src/data/universities.json`：更新 11 所状态、来源引用和中性中文摘要。
- `src/data/sources.json`：登记 9 个第一方 link-only 来源。
- `src/data/status.json`：为 9 个新来源登记 `unchecked` 巡查状态。
- `src/data/china-rule-audit.json`：记录 2026-08-10 二次复核结论。
- `tests/presentation.test.ts`：锁定新的 pending 展示名称和免责声明。
- `tests/page-content.test.mjs`：锁定方法说明页的用户文案。
- `src/lib/presentation.ts`：集中修改 pending 状态文案。
- `src/pages/methodology.astro`：解释“官网暂无可核验规则”的证据边界。
- `tests/public-data.test.mjs`：验证 101 所公开快照与当前目录逐行一致，并抽查新状态。
- `public/generated/universities.json`：通过 `pnpm build:public` 重新生成。

---

### Task 1: 锁定并写入 11 所二次复核结果

**Files:**
- Modify: `tests/pending-china-audit.test.ts`
- Modify: `tests/source-coverage.test.mjs`
- Modify: `src/data/universities.json`
- Modify: `src/data/sources.json`
- Modify: `src/data/status.json`
- Modify: `src/data/china-rule-audit.json`
- Verify unchanged: `src/data/institutions.json`
- Verify unchanged: `src/data/requirements.json`
- Verify unchanged: `src/data/rankings.json`

**Interfaces:**
- Consumes: `expectUnacceptedLinkOnlyStatus(status, sourceId)` in `tests/pending-china-audit.test.ts`; `evaluateCoverage({ cohort, rankings, universities, sources, audit })` in `scripts/report-source-coverage.mjs`.
- Produces: 9 catalog records with `state: 'china-requirements'`; 9 source IDs with matching status entries; exactly 2 blocked pending records; coverage counts `ruleOnlyUniversities: 81`, `linkOnlySources: 93`.

- [ ] **Step 1: Add the failing 11-school evidence contract**

Append a new `describe('2026-08-10 pending-school recheck', ...)` block to `tests/pending-china-audit.test.ts`. Use this exact identity/URL manifest and assert each source has the shared shape shown below:

```ts
const recheckedSources = [
  {
    universityId: 'university-of-aberdeen', sourceId: 'aberdeen-china-entry-requirements',
    url: 'https://www.abdn.ac.uk/study/international/country-territory/china/entry/',
    requiredText: ['Postgraduate Studies', '65% equates to a 2.2', '60% equates to a 3rd'],
    scopeZh: '学校中国国别页的本科和研究生入学要求',
    summaryZh: '页面提供中国学历和研究生成绩等效指引，未公开院校分组或院校名录。',
    caveatZh: '页面说明仅作一般指引，课程可能另有要求。',
  },
  {
    universityId: 'university-of-east-anglia', sourceId: 'uea-china-country-requirements',
    url: 'https://www.uea.ac.uk/study/international-students/country-map/china',
    requiredText: ['Bachelor Degree from a recognised institution', 'UK 2:1', '75%', 'UK 2:2', '70%'],
    scopeZh: '学校中国国别页的本科和研究生入学要求',
    summaryZh: '页面要求学士学位来自认可院校，并说明具体门槛会随课程和本科院校变化；未公开认可范围或院校名录。',
    caveatZh: '具体要求须结合课程并向招生部门确认，不能从认可院校措辞推断成员。',
  },
  {
    universityId: 'london-metropolitan-university', sourceId: 'london-metropolitan-china-requirements',
    url: 'https://www.londonmet.ac.uk/international/applying/countries/students-from-china/',
    requiredText: ['high-ranking Chinese institution', '70% or above', 'three-year Diploma', '80% or above'],
    scopeZh: '学校中国国别页的本科和研究生入学要求',
    summaryZh: '页面对高排名中国院校的四年制学士和三年制文凭给出门槛，但未定义或公开相关院校成员。',
    caveatZh: '“高排名院校”无法从本页确定，课程特定要求仍可能适用。',
  },
  {
    universityId: 'university-of-roehampton', sourceId: 'roehampton-china-requirements',
    url: 'https://www.roehampton.ac.uk/student-support/international-students/countries/china/',
    requiredText: ['70% or GPA 2.8', '60% or GPA 2.4', 'Project 211'],
    scopeZh: '学校中国国别页的硕士和 MBA 入学指引',
    summaryZh: '页面对认可中国大学和 Project 211 大学给出不同成绩门槛，但未公开院校成员名录。',
    caveatZh: '要求为一般指引且申请逐案评估，Project 211 不能被本站扩展为校方名单。',
  },
  {
    universityId: 'university-of-salford', sourceId: 'salford-china-requirements',
    url: 'https://www.salford.ac.uk/international/your-country-or-region/salford-and-china',
    requiredText: ['bachelor’s degree from a reputable Chinese university', 'GPA of 2.4/4.0 or 60%'],
    scopeZh: '学校中国国别页的研究生入学指引',
    summaryZh: '页面要求学士学位来自信誉良好的中国大学并给出成绩门槛，但未定义或公开院校范围。',
    caveatZh: '“信誉良好”由学校招生部门判断，具体课程可能要求更高。',
  },
  {
    universityId: 'university-of-wolverhampton', sourceId: 'wolverhampton-china-requirements',
    url: 'https://www.wlv.ac.uk/international/your-country/china/',
    requiredText: ['four-year degree from an accredited university or college', 'elite universities', '70%', '65%', '80%', '75%'],
    scopeZh: '学校中国国别页的本科和研究生入学指引',
    summaryZh: '页面按普通认可院校与精英或双评级院校给出不同研究生成绩门槛，但未公开类别成员。',
    caveatZh: '精英或双评级院校没有可核验名单，页面仅为指导且课程要求可能不同。',
  },
  {
    universityId: 'queen-margaret-university-edinburgh', sourceId: 'qmu-china-requirements',
    url: 'https://www.qmu.ac.uk/study-here/international-students/information-for-your-country/china',
    requiredText: ['good Bachelor’s degree from a recognised university', 'minimum score of 70%', 'Grade B', 'GPA 3.0'],
    scopeZh: '学校中国国别页的研究生入学要求',
    summaryZh: '页面要求认可大学的良好学士学位并给出最低成绩，未公开认可院校名录。',
    caveatZh: '认可范围由学校判断，课程页面可能有更高或附加条件。',
  },
  {
    universityId: 'university-of-northampton', sourceId: 'northampton-china-entry-requirements',
    url: 'https://www.northampton.ac.uk/international/your-country/east-asia-and-south-east-asia/',
    requiredText: ['a Bachelor’s degree from a Chinese university', 'successful completion of a recognised pre-Master’s'],
    scopeZh: '学校东亚地区页中的中国本科和研究生学历指引',
    summaryZh: '页面说明中国大学学士学位或认可硕士预科可用于研究生申请，未公开院校分组或成绩换算表。',
    caveatZh: '具体成绩和课程条件须查课程页或向学校确认。',
  },
  {
    universityId: 'university-of-south-wales', sourceId: 'usw-china-entry-requirements',
    url: 'https://www.southwales.ac.uk/international/your-country/china/',
    requiredText: ['Bachelor degree from a recognized Chinese university', 'postgraduate taught study', 'Masters degree from a recognised Chinese university', 'PhD'],
    scopeZh: '学校中国国别页的授课型研究生和博士学历要求',
    summaryZh: '页面要求相应学位来自认可中国大学，但没有公开认可范围、成绩换算或院校名录。',
    caveatZh: '认可资格及课程附加条件由学校判断，不能从页面推断院校成员。',
  },
] as const;

const stillBlockedIds = ['university-of-the-arts-london', 'university-of-east-london'] as const;

for (const item of recheckedSources) {
  expect(universityById.get(item.universityId)).toMatchObject({
    state: 'china-requirements', sourceIds: [item.sourceId],
  });
  expect(auditById.get(item.universityId)).toMatchObject({
    expectedState: 'china-requirements', reviewStatus: 'reviewed', reviewDate: '2026-08-10',
  });
  expect(sourceById.get(item.sourceId)).toMatchObject({
    id: item.sourceId,
    universityId: item.universityId,
    url: item.url,
    kind: 'china-requirements',
    scope: 'university',
    scopeZh: item.scopeZh,
    institutionRule: {
      type: 'none', summaryZh: item.summaryZh, caveatZh: item.caveatZh,
      verification: { reviewedAt: '2026-08-10', url: item.url, requiredText: item.requiredText },
    },
    parser: { mode: 'link-only', guard: { minimumRecords: 0, maximumRecords: 0, maximumRemovalRatio: 0 } },
  });
  expectUnacceptedLinkOnlyStatus(statuses[item.sourceId], item.sourceId);
  expect(requirements.some((fact) => fact.sourceId === item.sourceId)).toBe(false);
}

for (const id of stillBlockedIds) {
  expect(universityById.get(id)).toMatchObject({ state: 'pending', sourceIds: [] });
  expect(universityById.get(id)?.noteZh).toMatch(/已核查|当前公开官网/u);
  expect(universityById.get(id)?.noteZh).not.toMatch(/尚待核查|尚未开始/u);
  expect(auditById.get(id)).toMatchObject({
    expectedState: 'pending', reviewStatus: 'blocked', reviewDate: '2026-08-10',
  });
}
```

Also update `tests/source-coverage.test.mjs` expectations:

```js
expect(audit.filter((row) => row.reviewStatus === 'reviewed')).toHaveLength(99);
expect(audit.filter((row) => row.reviewStatus === 'blocked')).toHaveLength(2);

// CLI output
'Rule-only universities: 81',
'Link-only sources: 93',

// evaluateCoverage counts
ruleOnlyUniversities: 81,
```

Add the 9 IDs to `batchReviewedIds`, leaving the filtered feature-start pending set equal to exactly UAL and UEL.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
pnpm exec vitest run tests/pending-china-audit.test.ts tests/source-coverage.test.mjs
```

Expected: FAIL because the 9 catalog records are still `pending`, the sources/statuses do not exist, audit counts are still 90/11, and coverage still reports 72/84.

- [ ] **Step 3: Write the minimal catalog, source, status, and audit data**

Translate the exact `recheckedSources` manifest into JSON records using this complete mapping; this defines every production field rather than introducing a second source of truth:

```ts
const newSourceRecords = recheckedSources.map((item) => ({
  id: item.sourceId,
  universityId: item.universityId,
  labelZh: '中国学生入学要求',
  url: item.url,
  kind: 'china-requirements',
  scope: 'university',
  scopeZh: item.scopeZh,
  institutionRule: {
    type: 'none',
    summaryZh: item.summaryZh,
    caveatZh: item.caveatZh,
    verification: {
      reviewedAt: '2026-08-10',
      url: item.url,
      requiredText: [...item.requiredText],
    },
  },
  parser: {
    mode: 'link-only',
    guard: { minimumRecords: 0, maximumRecords: 0, maximumRemovalRatio: 0 },
  },
}));

const newStatuses = Object.fromEntries(recheckedSources.map(({ sourceId }) => [sourceId, {
  sourceId,
  health: 'unchecked',
  consecutiveFailures: 0,
}]));
```

For the 9 reviewed universities, set `state` to `china-requirements`, set `sourceIds` to the one `sourceId` in the manifest, and set `noteZh` exactly equal to that manifest row’s `summaryZh`. Use these exact audit findings:

```ts
const findingByUniversityId = {
  'university-of-aberdeen': 'The current applicant-facing China page publishes postgraduate percentage equivalencies but no institution grouping or named roster.',
  'university-of-east-anglia': 'The current China page requires a recognised institution and says the exact threshold varies by previous university and course, but publishes no recognition roster.',
  'london-metropolitan-university': 'The current China page applies thresholds to high-ranking Chinese institutions but neither defines nor lists those institutions.',
  'university-of-roehampton': 'The current China page applies different Master’s thresholds to recognised Chinese universities and Project 211 universities but publishes no member roster.',
  'university-of-salford': 'The current China page requires a degree from a reputable Chinese university and gives a minimum result, but does not define reputable institutions.',
  'university-of-wolverhampton': 'The current China page differentiates recognised institutions from elite or double-rated universities but publishes no category membership.',
  'queen-margaret-university-edinburgh': 'The current China page requires a good bachelor’s degree from a recognised university with a published minimum result but no university roster.',
  'university-of-northampton': 'The current regional China entry section accepts a Chinese university bachelor’s degree or recognised pre-Master’s and delegates exact grades to course requirements; it publishes no institution grouping.',
  'university-of-south-wales': 'The current China page requires the relevant degree from a recognised Chinese university for postgraduate taught or PhD study but publishes no recognition roster.',
} as const;
```

Set those audit rows to `expectedState: "china-requirements"`, `reviewStatus: "reviewed"`, and `reviewDate: "2026-08-10"`.

Keep UAL and UEL source-free. Use these exact notes:

```json
"当前公开招生政策和申请页要求以课程页面为准，未找到可核验的当前中国学历或院校规则；不代表学校没有内部评估标准。"
"已核查当前地区、国际申请和课程要求页面，未找到可核验的中国大陆学历换算或院校规则；不代表学校没有内部评估标准。"
```

Update their audit rows to `reviewDate: "2026-08-10"`, retain `expectedState: "pending"` and `reviewStatus: "blocked"`, and record the checked current pages instead of saying the review has not happened.

Use these exact blocked findings:

```ts
const blockedFindingByUniversityId = {
  'university-of-the-arts-london': 'Current admissions policy and postgraduate application guidance defer to course pages and publish no current China-specific academic or institution rule; the public 2023–24 scholarship equivalency PDF is historical and is not current admissions evidence.',
  'university-of-east-london': 'Current regional, international-entry, postgraduate-application and representative course pages publish only generic overseas-equivalent requirements and no mainland-China academic conversion or institution rule.',
} as const;
```

- [ ] **Step 4: Run focused tests, coverage CLI, and protected-data checks**

Run:

```powershell
pnpm exec vitest run tests/pending-china-audit.test.ts tests/source-coverage.test.mjs
node scripts/report-source-coverage.mjs
git diff --exit-code origin/main -- src/data/institutions.json src/data/requirements.json src/data/rankings.json src/data/generated/reverse-index.json
git diff --check
```

Expected: both test files PASS; coverage exits 0 and prints `Rule-only universities: 81` and `Link-only sources: 93`; protected data diff is empty; diff check is clean.

- [ ] **Step 5: Commit Task 1**

```powershell
git add tests/pending-china-audit.test.ts tests/source-coverage.test.mjs src/data/universities.json src/data/sources.json src/data/status.json src/data/china-rule-audit.json
git commit -m "data: reclassify verified China requirements"
```

---

### Task 2: 将剩余 pending 文案改为“官网暂无可核验规则”

**Files:**
- Modify: `tests/presentation.test.ts`
- Modify: `tests/page-content.test.mjs`
- Modify: `src/lib/presentation.ts`
- Modify: `src/pages/methodology.astro`

**Interfaces:**
- Consumes: `stateCopy.pending` and `directoryFilters` from `src/lib/presentation.ts`.
- Produces: UI label `官网暂无可核验规则` and a consistent methodology definition; no enum or schema change.

- [ ] **Step 1: Write failing copy contracts**

In `tests/presentation.test.ts` assert:

```ts
expect(stateCopy.pending).toEqual({
  label: '官网暂无可核验规则',
  description: '已核查当前公开官网，但信息不足以确认中国学历或院校限制；不代表学校没有内部规则，也不代表不能申请。',
});
expect(directoryFilters).toContainEqual(['pending', '官网暂无可核验规则']);
```

In `tests/page-content.test.mjs` assert the methodology source contains all three phrases and no longer defines pending as merely unreviewed:

```js
expect(methodology).toContain('<dt>官网暂无可核验规则</dt>');
expect(methodology).toContain('已核查当前公开官网');
expect(methodology).toContain('不代表学校没有内部规则');
expect(methodology).not.toContain('<dt>待确认</dt>');
```

- [ ] **Step 2: Run focused copy tests and verify RED**

```powershell
pnpm exec vitest run tests/presentation.test.ts tests/page-content.test.mjs
```

Expected: FAIL because the current label remains `待确认` and methodology still says the source is being verified.

- [ ] **Step 3: Make the minimal copy-only implementation**

Change only `stateCopy.pending`:

```ts
pending: {
  label: '官网暂无可核验规则',
  description: '已核查当前公开官网，但信息不足以确认中国学历或院校限制；不代表学校没有内部规则，也不代表不能申请。',
},
```

Replace the methodology definition with:

```astro
<dt>官网暂无可核验规则</dt>
<dd>已核查当前公开官网，但信息不足以确认中国学历或院校限制；这不代表学校没有内部规则，也不代表不能申请。</dd>
```

Do not rename the internal `pending` enum and do not change CSS or page structure.

- [ ] **Step 4: Run focused tests and verify GREEN**

```powershell
pnpm exec vitest run tests/presentation.test.ts tests/page-content.test.mjs
git diff --check
```

Expected: both files PASS; diff check is clean.

- [ ] **Step 5: Commit Task 2**

```powershell
git add tests/presentation.test.ts tests/page-content.test.mjs src/lib/presentation.ts src/pages/methodology.astro
git commit -m "fix: clarify unavailable China-rule evidence"
```

---

### Task 3: 重新生成并锁定公开目录快照

**Files:**
- Modify: `tests/public-data.test.mjs`
- Generate: `public/generated/universities.json`
- Verify unchanged: `public/generated/institutions.json`
- Verify unchanged: `public/generated/lists/*.json`
- Verify unchanged: `public/generated/reverse-index.json`

**Interfaces:**
- Consumes: `buildPublicData(...)` and the joined catalog/source/status data.
- Produces: one 101-record public directory snapshot with 81 `china-requirements` and 2 `pending` records.

- [ ] **Step 1: Add failing public-data assertions**

Extend the existing full-join test in `tests/public-data.test.mjs`:

```js
expect(publicRecords.filter((record) => record.state === 'china-requirements')).toHaveLength(81);
expect(publicRecords.filter((record) => record.state === 'pending').map((record) => record.id).sort())
  .toEqual(['university-of-east-london', 'university-of-the-arts-london']);

for (const id of [
  'university-of-aberdeen',
  'university-of-east-anglia',
  'london-metropolitan-university',
  'university-of-roehampton',
  'university-of-salford',
  'university-of-wolverhampton',
  'queen-margaret-university-edinburgh',
  'university-of-northampton',
  'university-of-south-wales',
]) {
  const record = publicRecords.find((item) => item.id === id);
  expect(record?.state, id).toBe('china-requirements');
  expect(record?.sources, id).toHaveLength(1);
  expect(record?.sources[0]).toMatchObject({
    kind: 'china-requirements',
    parser: { mode: 'link-only' },
    status: { health: 'unchecked', consecutiveFailures: 0 },
  });
}
```

- [ ] **Step 2: Run the public-data test and verify RED**

```powershell
pnpm exec vitest run tests/public-data.test.mjs
```

Expected: FAIL because tracked `public/generated/universities.json` still contains the old 72/11 state split.

- [ ] **Step 3: Regenerate only public data and classify the diff**

```powershell
pnpm build:public
git status --short
git diff -- public/generated/universities.json
git diff --exit-code HEAD -- public/generated/institutions.json public/generated/lists public/generated/reverse-index.json
```

Expected: the university snapshot changes causally; unrelated generated files remain byte-identical. If the generator causes only line-ending or timestamp drift in protected outputs, restore those exact unrelated paths with `git restore -- <paths>` before continuing.

- [ ] **Step 4: Run public and initial-HTML contracts**

```powershell
pnpm exec vitest run tests/public-data.test.mjs tests/initial-html.test.mjs
node scripts/check-initial-html.mjs
git diff --check
```

Expected: tests PASS; the initial HTML guard reports 101 unique QS-sorted rows; diff check is clean.

- [ ] **Step 5: Commit Task 3**

```powershell
git add tests/public-data.test.mjs public/generated/universities.json
git commit -m "build: publish corrected China-rule states"
```

---

### Task 4: 全量验证与浏览器验收

**Files:**
- Create if tracked by project convention: `docs/superpowers/task-reclassify-pending-china-rules-report.md`
- No production changes unless a reproduced failure requires a separate RED → GREEN fix.

**Interfaces:**
- Consumes: final branch state and production Astro build.
- Produces: verified preview evidence and a clean branch ready for review/publish.

- [ ] **Step 1: Run fresh full automated verification**

```powershell
pnpm test:run
node scripts/report-source-coverage.mjs
pnpm check:index
pnpm build
git diff --check
git status --short --untracked-files=all
```

Expected:

- all Vitest files PASS;
- coverage exits 0 with 93 QS, 8 specialist, 10 full lists, 81 rule-only, 8 no-public, 9 parser-enabled, 93 link-only;
- reverse-index consistency passes;
- Astro check/build has 0 errors and initial HTML has 101 unique rows;
- only intentional committed files differ from `origin/main` and the worktree is clean.

- [ ] **Step 2: Start a production preview**

```powershell
$env:ASTRO_TELEMETRY_DISABLED='1'
pnpm exec astro preview --host 127.0.0.1 --port 4321
```

Expected: `http://127.0.0.1:4321/` returns HTTP 200. Keep the server active only for QA and stop it afterward.

- [ ] **Step 3: Verify desktop behavior in the in-app Browser**

At 1440×1000 verify:

- page title and meaningful directory are present;
- 101 `article[data-id]` nodes are unique;
- filters show `中国申请要求 = 81` and `官网暂无可核验规则 = 2`;
- search each of Aberdeen, UEA, London Met, Roehampton, Salford, Wolverhampton, QMU, Northampton, and South Wales; each shows “中国申请要求”, one official HTTPS source, the correct caveat, and no `<details>` List;
- search UAL and UEL; both show “官网暂无可核验规则”, the reviewed boundary note, and no invented source;
- UCL’s existing 84-record List still expands normally;
- QS/THE/name sorting still moves the same 101 nodes;
- console has no errors/warnings and horizontal overflow is zero.

- [ ] **Step 4: Verify mobile behavior in the in-app Browser**

At 390×844 repeat the UAL, UEA, Roehampton, and UCL checks. Confirm no single-character vertical title, no horizontal overflow, readable source/caveat layout, and no console errors.

- [ ] **Step 5: Stop preview and record final evidence**

Stop the exact preview process, confirm port 4321 is released, and record:

```text
HEAD commit
full test count
coverage counts
build result
desktop/mobile viewport results
console/overflow results
screenshots
protected-file diff result
```

If the report path is ignored by repository convention, leave it ignored; do not force-add it unless the project’s current task-report convention explicitly requires tracking.

- [ ] **Step 6: Final branch check**

```powershell
git status --short --untracked-files=all
git log --oneline origin/main..HEAD
git diff --check origin/main..HEAD
```

Expected: clean worktree, three intentional implementation commits after the design commit, and no whitespace errors.
