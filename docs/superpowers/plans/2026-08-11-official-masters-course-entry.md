# Official Masters Course Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有 101 所英国大学各增加一个经过核验的官方硕士／研究生课程目录入口，同时保留现有六列排版、中国规则、排名、公开 List 和每日巡查安全语义。

**Architecture:** 新建独立的 `masters-course-directories.json` 注册表和 schema，不把课程入口混入中国规则 `sourceIds`。数据加载层将一条课程入口连接到每所大学，公开构建把它加入大学记录；每日巡查把两个注册表合并为检查目标；课程入口只核对人工确认的 requiredText 页面身份锚点，不对动态课程列表做全文哈希。UI 只在现有“来源 / 操作”列增加同级入口；中国规则来源达到 3 条时使用原位折叠。

**Tech Stack:** Astro 5、TypeScript、JSON Schema 2020-12、AJV、Vitest、LinkeDOM、Node.js 22、GitHub Actions、现有静态 GitHub Pages 构建。

## Global Constraints

- 目录必须继续恰好包含当前 101 所大学；每所大学恰好连接一个硕士课程入口。
- 保留现有六列桌面排版、移动端卡片顺序、排序、筛选、中文院校反查、规则摘要、公开 List 和来源链接。
- 不新增“硕士专业”页面或目录列，不建立站内专业数据库，不抓取单个专业申请要求。
- 新入口固定主文案为“查看全部硕士课程”，次级文案为“硕士专业官网入口”。
- 入口必须是 HTTPS 大学官方课程列表／检索／研究生课程总入口；不得使用大学首页、单个专业或第三方聚合页。
- 优先选择覆盖授课型硕士和研究型硕士（包括 MPhil）的入口。
- 硕士课程入口不得进入大学的中国规则 `sourceIds`、规则状态统计、List 数量或 requirement facts。
- 中国规则来源少于 3 条时继续逐条展示；达到 3 条时默认聚合为“中国硕士入学要求（N 条）”并可键盘展开。
- 每日巡查只更新检查状态；不自动更换正式 URL，不自动改写中国规则或课程数据。
- 课程目录页采用 page-identity 检查：检查 HTTP、最终跳转和 requiredText 页面身份锚点；不对动态课程列表做全文内容哈希。
- 不新增运行时依赖、付费 API、服务器或需要个人电脑常开的进程。
- 不修改 `src/data/universities.json`、`src/data/rankings.json`、`src/data/institutions.json`、`src/data/generated/requirements.json`、`src/data/china-rule-audit.json` 或既有中国规则来源事实。
- 所有生产代码变更先有 RED，再做最小 GREEN；每个任务独立提交并接受审查。
- 发布、PR 合并和部署不属于本计划的自动步骤，最终 QA 通过后另行确认。

---

## File and Interface Map

- `src/data/masters-course-directories.json`: 101 条官方课程入口生产注册表。
- `src/data/masters-course-directories.schema.json`: 独立 JSON Schema；固定字段、HTTPS、唯一 ID 和核验元数据。
- `src/lib/types.ts`: `MastersCourseDirectory`、`MastersCourseDirectoryWithStatus` 和大学公开连接类型。
- `src/lib/data.ts`: schema 校验、101 一一覆盖校验和课程入口连接。
- `scripts/build-public-data.mjs`: 把课程入口和状态连接到 `public/generated/universities.json`。
- `scripts/check-sources.mjs`: 将中国规则来源与课程入口合并为每日检查目标。
- `scripts/source-checker.mjs`: page-identity 模式检查可访问性、最终 URL 和 requiredText，不做全文哈希。
- `.github/workflows/daily-check.yml`: Lychee、Issue 源映射和每日检查同时读取两个注册表。
- `src/pages/index.astro`: 在现有“来源 / 操作”列渲染同级课程入口和 3+ 来源折叠。
- `src/styles/global.css`: 复用当前链接行样式；只补充折叠和移动端规则。
- `tests/masters-course-directories.test.ts`: schema、唯一性、官方域名和最终 101 覆盖。
- `tests/masters-course-directory-batch-*.test.ts`: 四批逐条固定 URL、标题、锚点和核验日期。
- `tests/public-data.test.mjs`: 公开连接一一对应且不污染中国规则来源。
- `tests/check-sources-runner.test.mjs`、`tests/check-sources.test.ts`、`tests/workflows.test.mjs`: 每日巡查双注册表与 status-only 写入。
- `tests/source-actions.test.ts`、`tests/page-content.test.mjs`、`tests/mobile-ranking-layout.test.mjs`: 普通入口、曼大折叠、键盘和响应式布局。

### Task 1: 建立独立课程入口数据契约

**Files:**
- Create: `src/data/masters-course-directories.json`
- Create: `src/data/masters-course-directories.schema.json`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`
- Create: `tests/masters-course-directories.test.ts`

**Interfaces:**
- Produces: `MastersCourseDirectory`、`MastersCourseDirectoryWithStatus`、`validateMastersCourseDirectories(input, universities)`、`loadMastersCourseDirectories(input?)`。
- Consumes: 现有 `University`、`SourceStatus`、`DataValidationError` 和 `officialDomain`。

- [ ] **Step 1: 写 schema 与 loader 的失败测试**

```ts
const valid = [{
  id: 'masters-imperial-college-london',
  universityId: 'imperial-college-london',
  labelZh: '查看全部硕士课程',
  url: 'https://www.imperial.ac.uk/study/courses/',
  pageTitle: 'Postgraduate courses',
  reviewedAt: '2026-08-11',
  requiredText: ['Postgraduate', 'Courses'],
  monitorMode: 'page-identity',
}];

expect(validateMastersCourseDirectories(valid, universities)).toEqual(valid);
expect(() => validateMastersCourseDirectories([...valid, ...valid], universities))
  .toThrow(/duplicate/);
expect(() => validateMastersCourseDirectories([{ ...valid[0], universityId: 'unknown' }], universities))
  .toThrow(/unregistered university/);
expect(() => validateMastersCourseDirectories([{ ...valid[0], url: 'http://example.com' }], universities))
  .toThrow(/schema/);
```

另断言 `labelZh` 只能是“查看全部硕士课程”、`id` 必须等于 `masters-${universityId}`、URL host 必须等于大学官方 host 或其子域，恶意后缀 `official.ac.uk.evil.test` 必须拒绝。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `pnpm exec vitest run tests/masters-course-directories.test.ts`

Expected: FAIL，因为 schema、类型和 loader 尚不存在。

- [ ] **Step 3: 添加最小类型与 schema**

```ts
export interface MastersCourseDirectory {
  id: string;
  universityId: string;
  labelZh: '查看全部硕士课程';
  url: string;
  pageTitle: string;
  reviewedAt: string;
  requiredText: string[];
  monitorMode: 'page-identity';
}

export type MastersCourseDirectoryWithStatus =
  MastersCourseDirectory & { status?: SourceStatus };
```

schema 必须 `additionalProperties: false`，要求上面全部字段；`requiredText` 至少 2 条且去重；日期为 `YYYY-MM-DD`；生产 JSON 初始值为 `[]`。

- [ ] **Step 4: 实现独立校验函数**

`validateMastersCourseDirectories` 先做 AJV schema 校验，再检查 ID 唯一、大学引用存在、每条 ID 派生正确、URL host 属于对应大学官方域。不要修改 `loadUniversities()` 或现有 `UniversityWithStatus`，避免空注册表影响现有网站。

- [ ] **Step 5: 运行焦点和数据回归**

Run: `pnpm exec vitest run tests/masters-course-directories.test.ts tests/data.test.ts tests/catalog.test.ts`

Expected: PASS；生产目录和中国规则连接结果与任务开始前 deep-equal。

- [ ] **Step 6: 提交数据契约**

```bash
git add src/data/masters-course-directories.json src/data/masters-course-directories.schema.json src/lib/types.ts src/lib/data.ts tests/masters-course-directories.test.ts
git commit -m "feat: define masters course directory registry"
```

### Task 2: 核验并录入第 1 批硕士课程官网入口

**Files:**
- Modify: `src/data/masters-course-directories.json`
- Create: `docs/research/masters-course-directory-batch-1.md`
- Test: `tests/masters-course-directory-batch-1.test.ts`

**Interfaces:**
- Consumes: `validateMastersCourseDirectories(input, universities)` 和下面固定的大学 ID 集合。
- Produces: 第 1 批完整 `MastersCourseDirectory` 记录；后续任务只能追加其他批次，不得改写本批已核验记录。

- [ ] **Step 1: 用官方网页逐校完成研究表**

在 `docs/research/masters-course-directory-batch-1.md` 为下列每个 ID 写一行，固定列为：`universityId | official URL | final URL | page title | requiredText 1 | requiredText 2 | reviewedAt | decision note`。

```ts
const batch1UniversityIds = [
  'imperial-college-london',
  'university-of-oxford',
  'university-of-cambridge',
  'university-college-london',
  'university-of-edinburgh',
  'kings-college-london',
  'university-of-manchester',
  'university-of-bristol',
  'london-school-of-economics-and-political-science',
  'university-of-warwick',
  'university-of-birmingham',
  'university-of-leeds',
  'university-of-glasgow',
  'university-of-sheffield',
  'durham-university',
  'university-of-nottingham',
  'queen-mary-university-of-london',
  'university-of-southampton',
  'university-of-st-andrews',
  'university-of-bath',
  'university-of-exeter',
  'university-of-liverpool',
  'newcastle-university',
  'university-of-york',
  'lancaster-university',
  'queens-university-belfast',
] as const;
```

每一行都必须通过大学官网直接打开并满足：HTTPS、大学官方域名或官方子域、是研究生／硕士课程列表或检索入口、不是首页、不是单个课程、不是第三方聚合页。优先采用同时覆盖授课型硕士和研究型硕士（含 MPhil）的总入口。

- [ ] **Step 2: 写入精确失败契约**

在 `tests/masters-course-directory-batch-1.test.ts` 写入上面的 ID 常量，并断言：

```ts
const records = loadMastersCourseDirectories();
const byUniversityId = new Map(records.map((record) => [record.universityId, record]));

expect(batch1UniversityIds.every((id) => byUniversityId.has(id))).toBe(true);
for (const id of batch1UniversityIds) {
  const record = byUniversityId.get(id)!;
  expect(record.id).toBe(`masters-${id}`);
  expect(record.labelZh).toBe('查看全部硕士课程');
  expect(record.monitorMode).toBe('page-identity');
  expect(record.requiredText.length).toBeGreaterThanOrEqual(2);
}
```

测试还必须逐条固定研究表中的 exact URL、pageTitle、requiredText 和 reviewedAt，不能只检查字段存在。

- [ ] **Step 3: 运行测试并确认因本批记录缺失而失败**

Run: `pnpm exec vitest run tests/masters-course-directory-batch-1.test.ts`

Expected: FAIL，首个失败为本批第一个 universityId 尚无对应记录；不得出现 schema、旧数据或环境无关失败。

- [ ] **Step 4: 仅追加本批生产记录**

把研究表中已经直接核验的记录按大学目录顺序追加到 `src/data/masters-course-directories.json`。每条记录必须使用：

```ts
type ReviewedCourseDirectoryRow = {
  universityId: string;
  finalUrl: string;
  pageTitle: string;
  requiredText: [string, string, ...string[]];
};

function productionRecord(row: ReviewedCourseDirectoryRow): MastersCourseDirectory {
  return {
    id: `masters-${row.universityId}`,
    universityId: row.universityId,
    labelZh: '查看全部硕士课程',
    url: row.finalUrl,
    pageTitle: row.pageTitle,
    reviewedAt: '2026-08-11',
    requiredText: [...row.requiredText],
    monitorMode: 'page-identity',
  };
}
```

只把研究表中已经通过官方网页直接核验的行转成上述生产记录。无法证明为完整官方课程入口的院校不得猜测 URL；保留该批 RED 并在报告中明确阻塞。

- [ ] **Step 5: 运行本批、累计数据和既有目录测试**

Run: `pnpm exec vitest run tests/masters-course-directory-batch-1.test.ts tests/masters-course-directories.test.ts tests/data.test.ts`

Expected: PASS；此前批次记录 deep-equal 不变，`universities.json`、中国规则来源和排名无 diff。

- [ ] **Step 6: 提交本批**

```bash
git add src/data/masters-course-directories.json docs/research/masters-course-directory-batch-1.md tests/masters-course-directory-batch-1.test.ts
git commit -m "data: add masters course directory batch 1"
```


### Task 3: 核验并录入第 2 批硕士课程官网入口

**Files:**
- Modify: `src/data/masters-course-directories.json`
- Create: `docs/research/masters-course-directory-batch-2.md`
- Test: `tests/masters-course-directory-batch-2.test.ts`

**Interfaces:**
- Consumes: `validateMastersCourseDirectories(input, universities)` 和下面固定的大学 ID 集合。
- Produces: 第 2 批完整 `MastersCourseDirectory` 记录；后续任务只能追加其他批次，不得改写本批已核验记录。

- [ ] **Step 1: 用官方网页逐校完成研究表**

在 `docs/research/masters-course-directory-batch-2.md` 为下列每个 ID 写一行，固定列为：`universityId | official URL | final URL | page title | requiredText 1 | requiredText 2 | reviewedAt | decision note`。

```ts
const batch2UniversityIds = [
  'cardiff-university',
  'university-of-reading',
  'cranfield-university',
  'london-business-school',
  'london-school-of-hygiene-and-tropical-medicine',
  'royal-college-of-art',
  'royal-veterinary-college',
  'royal-college-of-music',
  'institute-of-cancer-research-london',
  'liverpool-school-of-tropical-medicine',
  'loughborough-university',
  'university-of-strathclyde',
  'university-of-surrey',
  'university-of-sussex',
  'university-of-aberdeen',
  'university-of-leicester',
  'swansea-university',
  'heriot-watt-university',
  'brunel-university-of-london',
  'birkbeck-university-of-london',
  'city-st-georges-university-of-london',
  'university-of-east-anglia',
  'oxford-brookes-university',
  'university-of-kent',
  'aston-university',
] as const;
```

每一行都必须通过大学官网直接打开并满足：HTTPS、大学官方域名或官方子域、是研究生／硕士课程列表或检索入口、不是首页、不是单个课程、不是第三方聚合页。优先采用同时覆盖授课型硕士和研究型硕士（含 MPhil）的总入口。

- [ ] **Step 2: 写入精确失败契约**

在 `tests/masters-course-directory-batch-2.test.ts` 写入上面的 ID 常量，并断言：

```ts
const records = loadMastersCourseDirectories();
const byUniversityId = new Map(records.map((record) => [record.universityId, record]));

expect(batch2UniversityIds.every((id) => byUniversityId.has(id))).toBe(true);
for (const id of batch2UniversityIds) {
  const record = byUniversityId.get(id)!;
  expect(record.id).toBe(`masters-${id}`);
  expect(record.labelZh).toBe('查看全部硕士课程');
  expect(record.monitorMode).toBe('page-identity');
  expect(record.requiredText.length).toBeGreaterThanOrEqual(2);
}
```

测试还必须逐条固定研究表中的 exact URL、pageTitle、requiredText 和 reviewedAt，不能只检查字段存在。

- [ ] **Step 3: 运行测试并确认因本批记录缺失而失败**

Run: `pnpm exec vitest run tests/masters-course-directory-batch-2.test.ts`

Expected: FAIL，首个失败为本批第一个 universityId 尚无对应记录；不得出现 schema、旧数据或环境无关失败。

- [ ] **Step 4: 仅追加本批生产记录**

把研究表中已经直接核验的记录按大学目录顺序追加到 `src/data/masters-course-directories.json`。每条记录必须使用：

```ts
type ReviewedCourseDirectoryRow = {
  universityId: string;
  finalUrl: string;
  pageTitle: string;
  requiredText: [string, string, ...string[]];
};

function productionRecord(row: ReviewedCourseDirectoryRow): MastersCourseDirectory {
  return {
    id: `masters-${row.universityId}`,
    universityId: row.universityId,
    labelZh: '查看全部硕士课程',
    url: row.finalUrl,
    pageTitle: row.pageTitle,
    reviewedAt: '2026-08-11',
    requiredText: [...row.requiredText],
    monitorMode: 'page-identity',
  };
}
```

只把研究表中已经通过官方网页直接核验的行转成上述生产记录。无法证明为完整官方课程入口的院校不得猜测 URL；保留该批 RED 并在报告中明确阻塞。

- [ ] **Step 5: 运行本批、累计数据和既有目录测试**

Run: `pnpm exec vitest run tests/masters-course-directory-batch-2.test.ts tests/masters-course-directories.test.ts tests/data.test.ts`

Expected: PASS；此前批次记录 deep-equal 不变，`universities.json`、中国规则来源和排名无 diff。

- [ ] **Step 6: 提交本批**

```bash
git add src/data/masters-course-directories.json docs/research/masters-course-directory-batch-2.md tests/masters-course-directory-batch-2.test.ts
git commit -m "data: add masters course directory batch 2"
```


### Task 4: 核验并录入第 3 批硕士课程官网入口

**Files:**
- Modify: `src/data/masters-course-directories.json`
- Create: `docs/research/masters-course-directory-batch-3.md`
- Test: `tests/masters-course-directory-batch-3.test.ts`

**Interfaces:**
- Consumes: `validateMastersCourseDirectories(input, universities)` 和下面固定的大学 ID 集合。
- Produces: 第 3 批完整 `MastersCourseDirectory` 记录；后续任务只能追加其他批次，不得改写本批已核验记录。

- [ ] **Step 1: 用官方网页逐校完成研究表**

在 `docs/research/masters-course-directory-batch-3.md` 为下列每个 ID 写一行，固定列为：`universityId | official URL | final URL | page title | requiredText 1 | requiredText 2 | reviewedAt | decision note`。

```ts
const batch3UniversityIds = [
  'university-of-essex',
  'university-of-dundee',
  'soas-university-of-london',
  'royal-holloway-university-of-london',
  'university-of-bradford',
  'university-of-huddersfield',
  'northumbria-university',
  'university-of-stirling',
  'bangor-university',
  'university-of-hull',
  'coventry-university',
  'ulster-university',
  'manchester-metropolitan-university',
  'nottingham-trent-university',
  'university-of-portsmouth',
  'kingston-university-london',
  'university-of-plymouth',
  'goldsmiths-university-of-london',
  'university-of-the-west-of-england',
  'university-of-greenwich',
  'aberystwyth-university',
  'bournemouth-university',
  'edinburgh-napier-university',
  'keele-university',
  'de-montfort-university',
] as const;
```

每一行都必须通过大学官网直接打开并满足：HTTPS、大学官方域名或官方子域、是研究生／硕士课程列表或检索入口、不是首页、不是单个课程、不是第三方聚合页。优先采用同时覆盖授课型硕士和研究型硕士（含 MPhil）的总入口。

- [ ] **Step 2: 写入精确失败契约**

在 `tests/masters-course-directory-batch-3.test.ts` 写入上面的 ID 常量，并断言：

```ts
const records = loadMastersCourseDirectories();
const byUniversityId = new Map(records.map((record) => [record.universityId, record]));

expect(batch3UniversityIds.every((id) => byUniversityId.has(id))).toBe(true);
for (const id of batch3UniversityIds) {
  const record = byUniversityId.get(id)!;
  expect(record.id).toBe(`masters-${id}`);
  expect(record.labelZh).toBe('查看全部硕士课程');
  expect(record.monitorMode).toBe('page-identity');
  expect(record.requiredText.length).toBeGreaterThanOrEqual(2);
}
```

测试还必须逐条固定研究表中的 exact URL、pageTitle、requiredText 和 reviewedAt，不能只检查字段存在。

- [ ] **Step 3: 运行测试并确认因本批记录缺失而失败**

Run: `pnpm exec vitest run tests/masters-course-directory-batch-3.test.ts`

Expected: FAIL，首个失败为本批第一个 universityId 尚无对应记录；不得出现 schema、旧数据或环境无关失败。

- [ ] **Step 4: 仅追加本批生产记录**

把研究表中已经直接核验的记录按大学目录顺序追加到 `src/data/masters-course-directories.json`。每条记录必须使用：

```ts
type ReviewedCourseDirectoryRow = {
  universityId: string;
  finalUrl: string;
  pageTitle: string;
  requiredText: [string, string, ...string[]];
};

function productionRecord(row: ReviewedCourseDirectoryRow): MastersCourseDirectory {
  return {
    id: `masters-${row.universityId}`,
    universityId: row.universityId,
    labelZh: '查看全部硕士课程',
    url: row.finalUrl,
    pageTitle: row.pageTitle,
    reviewedAt: '2026-08-11',
    requiredText: [...row.requiredText],
    monitorMode: 'page-identity',
  };
}
```

只把研究表中已经通过官方网页直接核验的行转成上述生产记录。无法证明为完整官方课程入口的院校不得猜测 URL；保留该批 RED 并在报告中明确阻塞。

- [ ] **Step 5: 运行本批、累计数据和既有目录测试**

Run: `pnpm exec vitest run tests/masters-course-directory-batch-3.test.ts tests/masters-course-directories.test.ts tests/data.test.ts`

Expected: PASS；此前批次记录 deep-equal 不变，`universities.json`、中国规则来源和排名无 diff。

- [ ] **Step 6: 提交本批**

```bash
git add src/data/masters-course-directories.json docs/research/masters-course-directory-batch-3.md tests/masters-course-directory-batch-3.test.ts
git commit -m "data: add masters course directory batch 3"
```


### Task 5: 核验并录入第 4 批硕士课程官网入口

**Files:**
- Modify: `src/data/masters-course-directories.json`
- Create: `docs/research/masters-course-directory-batch-4.md`
- Test: `tests/masters-course-directory-batch-4.test.ts`

**Interfaces:**
- Consumes: `validateMastersCourseDirectories(input, universities)` 和下面固定的大学 ID 集合。
- Produces: 第 4 批完整 `MastersCourseDirectory` 记录；后续任务只能追加其他批次，不得改写本批已核验记录。

- [ ] **Step 1: 用官方网页逐校完成研究表**

在 `docs/research/masters-course-directory-batch-4.md` 为下列每个 ID 写一行，固定列为：`universityId | official URL | final URL | page title | requiredText 1 | requiredText 2 | reviewedAt | decision note`。

```ts
const batch4UniversityIds = [
  'liverpool-john-moores-university',
  'university-of-hertfordshire',
  'university-of-lincoln',
  'university-of-the-arts-london',
  'university-of-westminster',
  'london-south-bank-university',
  'middlesex-university',
  'university-of-brighton',
  'anglia-ruskin-university',
  'birmingham-city-university',
  'glasgow-caledonian-university',
  'leeds-beckett-university',
  'london-metropolitan-university',
  'robert-gordon-university',
  'sheffield-hallam-university',
  'university-of-east-london',
  'university-of-lancashire',
  'university-of-roehampton',
  'university-of-salford',
  'university-of-wolverhampton',
  'queen-margaret-university-edinburgh',
  'university-of-northampton',
  'university-of-derby',
  'university-of-south-wales',
  'canterbury-christ-church-university',
] as const;
```

每一行都必须通过大学官网直接打开并满足：HTTPS、大学官方域名或官方子域、是研究生／硕士课程列表或检索入口、不是首页、不是单个课程、不是第三方聚合页。优先采用同时覆盖授课型硕士和研究型硕士（含 MPhil）的总入口。

- [ ] **Step 2: 写入精确失败契约**

在 `tests/masters-course-directory-batch-4.test.ts` 写入上面的 ID 常量，并断言：

```ts
const records = loadMastersCourseDirectories();
const byUniversityId = new Map(records.map((record) => [record.universityId, record]));

expect(batch4UniversityIds.every((id) => byUniversityId.has(id))).toBe(true);
for (const id of batch4UniversityIds) {
  const record = byUniversityId.get(id)!;
  expect(record.id).toBe(`masters-${id}`);
  expect(record.labelZh).toBe('查看全部硕士课程');
  expect(record.monitorMode).toBe('page-identity');
  expect(record.requiredText.length).toBeGreaterThanOrEqual(2);
}
```

测试还必须逐条固定研究表中的 exact URL、pageTitle、requiredText 和 reviewedAt，不能只检查字段存在。

- [ ] **Step 3: 运行测试并确认因本批记录缺失而失败**

Run: `pnpm exec vitest run tests/masters-course-directory-batch-4.test.ts`

Expected: FAIL，首个失败为本批第一个 universityId 尚无对应记录；不得出现 schema、旧数据或环境无关失败。

- [ ] **Step 4: 仅追加本批生产记录**

把研究表中已经直接核验的记录按大学目录顺序追加到 `src/data/masters-course-directories.json`。每条记录必须使用：

```ts
type ReviewedCourseDirectoryRow = {
  universityId: string;
  finalUrl: string;
  pageTitle: string;
  requiredText: [string, string, ...string[]];
};

function productionRecord(row: ReviewedCourseDirectoryRow): MastersCourseDirectory {
  return {
    id: `masters-${row.universityId}`,
    universityId: row.universityId,
    labelZh: '查看全部硕士课程',
    url: row.finalUrl,
    pageTitle: row.pageTitle,
    reviewedAt: '2026-08-11',
    requiredText: [...row.requiredText],
    monitorMode: 'page-identity',
  };
}
```

只把研究表中已经通过官方网页直接核验的行转成上述生产记录。无法证明为完整官方课程入口的院校不得猜测 URL；保留该批 RED 并在报告中明确阻塞。

- [ ] **Step 5: 运行本批、累计数据和既有目录测试**

Run: `pnpm exec vitest run tests/masters-course-directory-batch-4.test.ts tests/masters-course-directories.test.ts tests/data.test.ts`

Expected: PASS；此前批次记录 deep-equal 不变，`universities.json`、中国规则来源和排名无 diff。

- [ ] **Step 6: 提交本批**

```bash
git add src/data/masters-course-directories.json docs/research/masters-course-directory-batch-4.md tests/masters-course-directory-batch-4.test.ts
git commit -m "data: add masters course directory batch 4"
```

### Task 6: 强制 101 所完整覆盖并连接公开目录

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`
- Modify: `scripts/build-public-data.mjs`
- Modify: `public/generated/universities.json`（仅由构建脚本生成）
- Modify: `tests/masters-course-directories.test.ts`
- Modify: `tests/data.test.ts`
- Modify: `tests/public-data.test.mjs`

**Interfaces:**
- Consumes: 101 条 `MastersCourseDirectory` 和现有 `StatusMap`。
- Produces: `UniversityDirectoryRecord = UniversityWithStatus & { mastersCourse: MastersCourseDirectoryWithStatus }`；`loadUniversities()` 与公开 JSON 均返回恰好一条已连接课程入口。

- [ ] **Step 1: 写最终覆盖和公开连接失败测试**

```ts
const universities = validateUniversities(universitiesJson);
const masters = loadMastersCourseDirectories();

expect(masters).toHaveLength(101);
expect(new Set(masters.map((record) => record.universityId)))
  .toEqual(new Set(universities.map((university) => university.id)));

const joined = joinMastersCourseDirectories(universitiesWithStatuses, masters, statuses);
expect(joined).toHaveLength(101);
expect(joined.every((university) => university.mastersCourse.universityId === university.id)).toBe(true);
expect(joined.every((university) => university.sources.every((source) => !source.id.startsWith('masters-')))).toBe(true);
```

`tests/public-data.test.mjs` 必须读取生成后的 `universities.json`，逐行 deep-compare `mastersCourse`，并确认原 `sources` 数量、ID 和状态完全不变。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `pnpm exec vitest run tests/masters-course-directories.test.ts tests/data.test.ts tests/public-data.test.mjs`

Expected: FAIL，因为生产 loader 和 public builder 尚未连接 `mastersCourse`。

- [ ] **Step 3: 实现严格一一连接**

新增：

```ts
export function joinMastersCourseDirectories(
  universities: UniversityWithStatus[],
  directories: MastersCourseDirectory[],
  statuses: StatusMap,
): UniversityDirectoryRecord[]
```

函数必须拒绝缺失、额外或重复 universityId；返回复制对象，不 mutate 输入；从 `statuses[directory.id]` 连接可选状态。更新 `loadUniversities()` 的最终流水线，使排名和中国来源完成后再连接硕士入口。

- [ ] **Step 4: 更新公开构建**

给 `buildPublicData` 增加 `mastersCourseDirectories` 参数和 CLI JSON 读取；`joinedUniversityRecords` 使用同一一一连接语义生成 `mastersCourse`。运行 `pnpm build:public`，只保留 `public/generated/universities.json` 的因果变化，恢复 institutions、lists、reverse-index 的时间戳或换行漂移。

- [ ] **Step 5: 运行 GREEN 与构建守卫**

Run: `pnpm exec vitest run tests/masters-course-directories.test.ts tests/data.test.ts tests/public-data.test.mjs`

Run: `pnpm build:public`

Expected: PASS；公开大学 101 条、101 个唯一 ID、101 条课程入口；中国规则 sources deep-equal 不变。

- [ ] **Step 6: 提交完整连接**

```bash
git add src/lib/types.ts src/lib/data.ts scripts/build-public-data.mjs public/generated/universities.json tests/masters-course-directories.test.ts tests/data.test.ts tests/public-data.test.mjs
git commit -m "feat: join masters course entries into directory"
```

### Task 7: 把课程入口纳入低噪音页面身份巡查

**Files:**
- Modify: `scripts/source-checker.mjs`
- Create: `scripts/source-identity.mjs`
- Modify: `scripts/check-sources.mjs`
- Modify: `scripts/render-anomaly-issue.mjs`
- Modify: `.github/workflows/daily-check.yml`
- Modify: `tests/check-sources.test.ts`
- Create: `tests/source-identity.test.mjs`
- Modify: `tests/check-sources-runner.test.mjs`
- Modify: `tests/anomaly-issue.test.mjs`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `OfficialSourceConfig[]` 与 `MastersCourseDirectory[]`，两者共享 `id`、`universityId`、`url`。
- Produces: `loadCheckTargets({ chinaSources, mastersCourseDirectories })`、`missingRequiredText(html, requiredText)` 和保持现有状态阈值的 `checkSource()` page-identity 分支。

- [ ] **Step 1: 写 page-identity 模式失败测试**

覆盖以下行为：

```js
const source = {
  id: 'masters-university-of-manchester',
  universityId: 'university-of-manchester',
  url: 'https://www.manchester.ac.uk/study/masters/courses/list/',
  monitorMode: 'page-identity',
  requiredText: ['Postgraduate', 'courses'],
};

expect(fetchImpl).toHaveBeenCalledWith(source.url, expect.objectContaining({ method: 'GET' }));
expect(result.health).toBe('ok');
expect(result.contentHash).toBeUndefined();
expect(result.observedContentHash).toBeUndefined();
expect(missingRequiredText('<h1>Postgraduate courses</h1>', ['Postgraduate', 'courses']))
  .toEqual([]);
```

另覆盖 GET 页面缺少任一 requiredText 时立即返回 changed、人工更新锚点后成功检查可清除 changed、前三次网络／403／404／429／5xx 连续失败阈值、两个注册表 ID 冲突时立即失败、纯 checkedAt 变化不改写 tracked status。requiredText 比较必须 NFKC 归一化、合并空白并忽略大小写。

- [ ] **Step 2: 写 workflow 失败契约**

断言 Lychee 同时检查 `src/data/sources.json` 和 `src/data/masters-course-directories.json`；Issue 脚本建立的 `sourceById` 来自两个注册表；提交步骤仍只允许 `git add src/data/status.json`。

- [ ] **Step 3: 运行 RED**

Run: `pnpm exec vitest run tests/check-sources.test.ts tests/source-identity.test.mjs tests/check-sources-runner.test.mjs tests/anomaly-issue.test.mjs tests/workflows.test.mjs`

Expected: FAIL，原因是 runner 尚未加载课程入口且 checker 尚无 requiredText 页面身份分支。

- [ ] **Step 4: 实现合并目标与 page-identity 分支**

`loadCheckTargets` 按注册表顺序返回中国规则来源后接课程入口，拒绝任意重复 ID。`checkSource` 对 `monitorMode === 'page-identity'` 执行 GET，把正文交给 `missingRequiredText(html, requiredText)`；锚点齐全时返回 ok／redirected，缺失时返回 changed 并在当前 attempt 中列出缺失锚点；不得写入 contentHash 或 observedContentHash。锚点恢复或经人工更新后，成功检查必须清除旧 changed。403／404、429／5xx、timeout 的三次阈值和成功清零保持现有语义。

- [ ] **Step 5: 更新 Issue 与 workflow**

Issue 的 source 元数据查询必须覆盖两个注册表；同一 `sourceId` 继续只创建或更新一个带 marker 的 Issue。保留 workflow concurrency `daily-official-source-check` 和 `cancel-in-progress: false`。

- [ ] **Step 6: 运行 GREEN 和真实 CLI**

Run: `pnpm exec vitest run tests/check-sources.test.ts tests/source-identity.test.mjs tests/check-sources-runner.test.mjs tests/anomaly-issue.test.mjs tests/workflows.test.mjs`

Run: `pnpm check:sources`

Expected: tests PASS；CLI 检查数等于现有中国来源数 + 101，且没有事实数据被自动改写。真实 CLI 产生的 `status.json` 网络结果不作为本任务提交内容，除非是明确审核后的因果状态初始化。

- [ ] **Step 7: 提交每日巡查接入**

```bash
git add scripts/source-checker.mjs scripts/source-identity.mjs scripts/check-sources.mjs scripts/render-anomaly-issue.mjs .github/workflows/daily-check.yml tests/check-sources.test.ts tests/source-identity.test.mjs tests/check-sources-runner.test.mjs tests/anomaly-issue.test.mjs tests/workflows.test.mjs
git commit -m "feat: audit masters course directory links"
```

### Task 8: 在现有“来源 / 操作”列渲染入口和曼大折叠

**Files:**
- Modify: `src/lib/presentation.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Create: `tests/source-actions.test.ts`
- Modify: `tests/page-content.test.mjs`
- Modify: `tests/mobile-ranking-layout.test.mjs`

**Interfaces:**
- Consumes: `UniversityDirectoryRecord.sources` 和 `UniversityDirectoryRecord.mastersCourse`。
- Produces: `chinaSourceActionModel(sources)`，返回 `{ collapsed: boolean; count: number; label: string }`；页面使用它决定逐条来源或原位 `details`。

- [ ] **Step 1: 写纯逻辑和页面行为失败测试**

```ts
expect(chinaSourceActionModel([sourceA, sourceB])).toEqual({
  collapsed: false,
  count: 2,
  label: '中国硕士入学要求',
});
expect(chinaSourceActionModel([sourceA, sourceB, sourceC])).toEqual({
  collapsed: true,
  count: 3,
  label: '中国硕士入学要求（3 条）',
});
```

LinkeDOM 页面测试必须断言：帝国理工的中国来源和“查看全部硕士课程”同级存在；曼大默认只显示一个聚合 summary 和课程入口；展开后恰好三条既有中国来源，无重复、无丢失；Enter/Space 可触发原生 `summary`；所有 101 行各有一个 HTTPS 课程入口。

- [ ] **Step 2: 运行 RED**

Run: `pnpm exec vitest run tests/source-actions.test.ts tests/page-content.test.mjs tests/mobile-ranking-layout.test.mjs`

Expected: FAIL，因为 helper、课程入口和 3+ 来源折叠尚未渲染。

- [ ] **Step 3: 实现最小展示**

在原 `.source-actions` 中：

```astro
{sourceModel.collapsed ? (
  <details class="china-source-bundle">
    <summary>{sourceModel.label}</summary>
    <div class="china-source-bundle-list">{university.sources.map((source) => (
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          <span>{source.labelZh}</span>
          <small class="rule-type">{institutionRuleTypeCopy[source.institutionRule.type].label}</small>
          <small>{sourceHealthCopy[source.status?.health ?? 'unchecked']} · {sourceFreshnessCopy(source.status)}</small>
        </a>
      ))}</div>
  </details>
) : university.sources.map(renderSourceLink)}
<a class="masters-course-action" href={university.mastersCourse.url} target="_blank" rel="noopener noreferrer">
  <span>查看全部硕士课程</span>
  <small>硕士专业官网入口</small>
</a>
```

把来源链接渲染抽成一个局部 Astro fragment，并让逐条模式和折叠模式共同调用；fragment 必须同时渲染 labelZh、rule-type、sourceHealthCopy 和 sourceFreshnessCopy，不能维护两份分叉实现。课程入口默认不显示检查日期；只有状态为 temporary-error 或 unavailable 时显示“官网入口暂不可用，请稍后重试”。

- [ ] **Step 4: 只补充必要 CSS**

继续使用当前六列 grid。`.china-source-bundle` 和 `.masters-course-action` 继承现有 source link 字体、颜色、图标和分隔线；桌面不改变列宽。800px 以下沿用 source-actions 全宽单列；430px 检查长校名和长 URL 不溢出。

- [ ] **Step 5: 运行 GREEN 和完整页面测试**

Run: `pnpm exec vitest run tests/source-actions.test.ts tests/page-content.test.mjs tests/mobile-ranking-layout.test.mjs tests/directory-dom.test.ts`

Expected: PASS；六列 header 文案和排序 DOM 顺序不变。

- [ ] **Step 6: 提交 UI**

```bash
git add src/lib/presentation.ts src/pages/index.astro src/styles/global.css tests/source-actions.test.ts tests/page-content.test.mjs tests/mobile-ranking-layout.test.mjs
git commit -m "feat: show official masters course entries"
```

### Task 9: 全量回归、构建和浏览器验收

**Files:**
- Modify only if a verified product defect is found: files owned by Tasks 6–8
- Create: `.superpowers/sdd/2026-08-11-official-masters-course-entry/final-qa-report.md`（若该目录被 ignore，保持 ignore）
- Update: `README.md` only if its public feature list describes directory actions

**Interfaces:**
- Consumes: 完整 101 条数据、公开构建、每日巡查和 UI。
- Produces: 可审查的自动化证据、桌面／移动截图、clean worktree；不自动 push、开 PR、合并或部署。

- [ ] **Step 1: 运行新功能焦点套件**

Run: `pnpm exec vitest run tests/masters-course-directories.test.ts tests/masters-course-directory-batch-1.test.ts tests/masters-course-directory-batch-2.test.ts tests/masters-course-directory-batch-3.test.ts tests/masters-course-directory-batch-4.test.ts tests/public-data.test.mjs tests/check-sources.test.ts tests/source-identity.test.mjs tests/check-sources-runner.test.mjs tests/source-actions.test.ts tests/page-content.test.mjs tests/mobile-ranking-layout.test.mjs tests/workflows.test.mjs`

Expected: PASS，且报告准确记录文件数和测试数。

- [ ] **Step 2: 运行全量数据、巡查和构建守卫**

Run: `pnpm test:run`

Run: `pnpm check:index`

Run: `node scripts/report-source-coverage.mjs`

Run: `pnpm build`

Expected: 全部退出 0；Astro 0 errors；initial HTML guard 101 unique rows；SEO guard PASS。构建后恢复与本功能无因果关系的 generated timestamp／换行漂移。

- [ ] **Step 3: 核验保护数据零变化**

Run: `git diff edbf372..HEAD -- src/data/universities.json src/data/rankings.json src/data/institutions.json src/data/generated/requirements.json src/data/china-rule-audit.json public/generated/lists public/generated/reverse-index.json`

Expected: 无输出。`src/data/sources.json` 既有中国来源对象也必须通过基线 deep-equal 测试保持不变。

- [ ] **Step 4: 启动 production preview 并使用 in-app Browser**

Run: `pnpm exec astro preview --host 127.0.0.1 --port 4321`

桌面 1440×1000 验收：
- 101 rows、101 unique，默认 QS 排序和六列标题不变；
- 帝国理工显示一个中国来源 + 一个课程入口；
- 曼大默认显示“中国硕士入学要求（3 条）” + 一个课程入口；
- 曼大展开后恰好三条原来源，灰色规则摘要保持原内容；
- 课程入口 href 为对应生产 JSON 的 HTTPS URL；
- console error/warn 为空，水平 overflow 为 0。

移动 390×844 验收：
- 名称、状态、排名、范围、来源／课程入口顺序不变；
- 两类入口纵向可读；
- 曼大展开无单字竖排、无裁切、无横向滚动；
- 键盘 focus 样式可见。

- [ ] **Step 5: 保存截图和报告并停止精确 preview 进程**

保存桌面帝国理工、桌面曼大折叠／展开、移动曼大展开截图；记录 URL、viewport、console、overflow、DOM counts。停止由本任务启动的精确 PID，并确认 4321 端口释放。

- [ ] **Step 6: 最终 clean-state 检查**

Run: `git diff --check`

Run: `git status --short --untracked-files=all`

Expected: diff check 无输出；除计划内且已提交的文件外工作树为空。若 README 有用户可见功能列表，先用一句“每所大学提供经核验的官方硕士课程目录入口”更新并单独提交；否则不改 README。
