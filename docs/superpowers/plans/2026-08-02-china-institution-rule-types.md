# China Institution Rule Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distinguish genuine institution eligibility restrictions from grade-threshold lists, mixed rules, and ordinary China requirements while preserving the existing directory, folded panels, reverse search, and free static architecture.

**Architecture:** Add one required, human-reviewed `institutionRule` object to each registered official source. The server-side display model and reverse-evidence model carry that metadata to the Astro page, where shared presentation helpers produce accurate Chinese labels and source-specific listed/unlisted explanations. Existing requirement facts remain the single source of institution rows; `link-only` sources stay neutral and never generate local matches.

**Tech Stack:** Node.js 22, TypeScript 6, Astro 7, Vitest 4, JSON Schema/AJV, existing static JSON datasets and GitHub Pages workflow.

## Global Constraints

- Keep the existing 28-university QS 2027 cohort, dual-direction search, static Pages deployment, and daily guarded update workflow.
- Do not translate university Tier or Band values into Chinese university rankings.
- Do not infer a rule type from scraped text; `institutionRule` is human-reviewed source metadata.
- Do not describe a match as permission to apply or a miss as inability to apply.
- A `link-only` source never produces institution-specific local evidence.
- Faculty/programme rules must display their exact scope and must not be presented as university-wide.
- Do not add a runtime dependency, paid API, database, server, or second manually maintained institution list.
- Preserve 320px layouts without horizontal overflow.

---

### Task 1: Add Human-Reviewed Institution Rule Contracts

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/data/sources.schema.json`
- Modify: `src/data/sources.json`
- Modify: `tests/data.test.ts`
- Modify: `tests/catalog.test.ts`

**Interfaces:**
- Produces:

```ts
export type InstitutionRuleType = 'eligibility' | 'grade-threshold' | 'mixed' | 'none';

export interface InstitutionRule {
  type: InstitutionRuleType;
  summaryZh: string;
  listedMeaningZh?: string;
  unlistedMeaningZh?: string;
  caveatZh?: string;
}

export interface OfficialSourceConfig {
  // existing fields unchanged
  institutionRule: InstitutionRule;
}
```

- Every record in `src/data/sources.json` must contain exactly one non-empty `institutionRule` object.
- UCL: `grade-threshold`; Edinburgh: `mixed`; Southampton: `grade-threshold`; Manchester Law: `none`.
- All other currently registered requirements-only/link sources: `none` unless the existing accepted dataset contains institution facts.

- [ ] **Step 1: Write failing schema and classification tests**

Add to `tests/data.test.ts`:

```ts
it('requires human-reviewed institution rule metadata on every official source', () => {
  expect(validateOfficialSources(sources)).toHaveLength(sources.length);
  expect(sources.every((source) => source.institutionRule.summaryZh.trim().length > 0)).toBe(true);
});
```

Add to `tests/catalog.test.ts`:

```ts
it('distinguishes eligibility, grade-threshold, mixed, and requirements-only sources', () => {
  const ruleType = (sourceId: string) => sources.find((source) => source.id === sourceId)?.institutionRule.type;
  expect(ruleType('ucl-china')).toBe('grade-threshold');
  expect(ruleType('edinburgh-china')).toBe('mixed');
  expect(ruleType('southampton-china')).toBe('grade-threshold');
  expect(ruleType('manchester-law-china')).toBe('none');
});

it('records safe listed and unlisted meanings for every source with institution rules', () => {
  for (const source of sources.filter((item) => item.institutionRule.type !== 'none')) {
    expect(source.institutionRule.listedMeaningZh?.trim()).toBeTruthy();
    expect(source.institutionRule.unlistedMeaningZh?.trim()).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run:

```powershell
.\node_modules\.bin\vitest.CMD run tests/data.test.ts tests/catalog.test.ts
```

Expected: FAIL because `institutionRule` is not defined or present.

- [ ] **Step 3: Add the TypeScript and JSON Schema contracts**

In `src/lib/types.ts`, define `InstitutionRuleType` and `InstitutionRule`, then add required `institutionRule: InstitutionRule` to `OfficialSourceConfig`.

In `src/data/sources.schema.json`, add `institutionRule` to the source `required` array and add:

```json
"institutionRule": {
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "summaryZh"],
  "properties": {
    "type": { "enum": ["eligibility", "grade-threshold", "mixed", "none"] },
    "summaryZh": { "type": "string", "minLength": 1, "pattern": "\\S" },
    "listedMeaningZh": { "type": "string", "minLength": 1, "pattern": "\\S" },
    "unlistedMeaningZh": { "type": "string", "minLength": 1, "pattern": "\\S" },
    "caveatZh": { "type": "string", "minLength": 1, "pattern": "\\S" }
  },
  "allOf": [
    {
      "if": { "properties": { "type": { "const": "none" } }, "required": ["type"] },
      "then": {},
      "else": { "required": ["listedMeaningZh", "unlistedMeaningZh"] }
    }
  ]
}
```

- [ ] **Step 4: Populate every registered source without changing parser modes**

Use these exact reviewed semantics for the four named sources:

```json
{
  "id": "ucl-china",
  "institutionRule": {
    "type": "grade-threshold",
    "summaryZh": "中国本科院校会影响 UCL 硕士申请的最低成绩门槛。",
    "listedMeaningZh": "名单内院校通常要求：2:1 对应加权均分 85%，2:2 对应 80%。",
    "unlistedMeaningZh": "其他获中国教育部认可的院校仍按更高门槛考虑：2:1 通常为 90%，2:2 通常为 85%。",
    "caveatZh": "部分带标记的院校及具体课程存在额外要求，最终以课程页和官网注释为准。"
  }
}
```

```json
{
  "id": "edinburgh-china",
  "institutionRule": {
    "type": "mixed",
    "summaryZh": "Priority List 是否构成准入限制取决于课程标注的 Band。",
    "listedMeaningZh": "Band A/B 要求 Priority List 背景；Band C 对名单内外设置不同成绩门槛。",
    "unlistedMeaningZh": "名单外认可院校能否满足要求取决于课程 Band；Band C/D 存在名单外路径。",
    "caveatZh": "必须先在课程页确认 Band，再解释 Priority List。"
  }
}
```

```json
{
  "id": "southampton-china",
  "institutionRule": {
    "type": "grade-threshold",
    "summaryZh": "中国本科院校所属 Tier 决定对应的最低成绩换算门槛。",
    "listedMeaningZh": "官网将已列院校分为 Tier A、B、C。",
    "unlistedMeaningZh": "官网说明未列出的院校按 Tier D 成绩门槛处理。",
    "caveatZh": "本站尚未安全结构化这份大型名单，请直接核对官网 Tier 页。"
  }
}
```

```json
{
  "id": "manchester-law-china",
  "institutionRule": {
    "type": "none",
    "summaryZh": "法学院页面公开中国申请者成绩要求，但没有中国本科院校名单。"
  }
}
```

For other `none` sources, use a source-specific `summaryZh` that states what the page contains and that no institution membership list was confirmed. Do not change URL, scope, kind, cycle, parser, or guard fields in this step.

- [ ] **Step 5: Run focused and full data tests**

Run:

```powershell
.\node_modules\.bin\vitest.CMD run tests/data.test.ts tests/catalog.test.ts tests/source-registry-audit.test.ts
```

Expected: PASS with no skipped tests.

- [ ] **Step 6: Commit the rule contracts**

```powershell
git add src/lib/types.ts src/data/sources.schema.json src/data/sources.json tests/data.test.ts tests/catalog.test.ts
git commit -m "feat: classify Chinese institution rules"
```

---

### Task 2: Carry Rule Meaning Into Folded Institution Panels

**Files:**
- Modify: `src/lib/official-list-display.ts`
- Modify: `tests/official-list-display.test.ts`
- Modify: `src/lib/presentation.ts`
- Modify: `tests/presentation.test.ts`

**Interfaces:**
- Extends `OfficialListDisplayPanel` with:

```ts
ruleType: InstitutionRuleType;
ruleSummaryZh: string;
listedMeaningZh: string;
unlistedMeaningZh: string;
caveatZh?: string;
scope: SourceScope;
```

- Produces:

```ts
export const institutionRuleTypeCopy: Record<InstitutionRuleType, { label: string }>;
export function officialPanelTitle(type: Exclude<InstitutionRuleType, 'none'>, count: number): string;
```

- [ ] **Step 1: Write failing panel-model tests**

Update every `OfficialSourceConfig` fixture in `tests/official-list-display.test.ts` with an `institutionRule` object. Add:

```ts
it('carries grade-threshold meaning and exact scope into a folded panel', () => {
  const panel = buildOfficialListDisplays({
    universities: [university(structuredSource.universityId, structuredSource)],
    institutions: [beihang],
    requirements: [fact('beihang', beihang.id, '2026-08-01T00:00:00.000Z')],
  }).get(structuredSource.universityId)?.[0];

  expect(panel).toMatchObject({
    ruleType: 'grade-threshold',
    ruleSummaryZh: structuredSource.institutionRule.summaryZh,
    listedMeaningZh: structuredSource.institutionRule.listedMeaningZh,
    unlistedMeaningZh: structuredSource.institutionRule.unlistedMeaningZh,
    scope: 'university',
  });
});

it('supports a safely structured faculty rule without making it university-wide', () => {
  const faculty = {
    ...structuredSource,
    id: 'faculty-rule',
    kind: 'faculty-page' as const,
    scope: 'faculty' as const,
    scopeZh: '商学院硕士项目',
  };
  const panel = buildOfficialListDisplays({
    universities: [university(faculty.universityId, faculty)],
    institutions: [beihang],
    requirements: [{ ...fact('faculty', beihang.id, '2026-08-01T00:00:00.000Z'), sourceId: faculty.id, scope: 'faculty', scopeZh: faculty.scopeZh }],
  }).get(faculty.universityId)?.[0];
  expect(panel).toMatchObject({ scope: 'faculty', scopeZh: '商学院硕士项目' });
});

it('rejects institution facts for a source classified as requirements-only', () => {
  const noListSource = {
    ...structuredSource,
    institutionRule: { type: 'none' as const, summaryZh: '只有一般要求。' },
  };
  expect(() => buildOfficialListDisplays({
    universities: [university(noListSource.universityId, noListSource)],
    institutions: [beihang],
    requirements: [fact('invalid', beihang.id, '2026-08-01T00:00:00.000Z')],
  })).toThrow(/requirements-only|institution rule/i);
});
```

- [ ] **Step 2: Write failing presentation-label tests**

Add to `tests/presentation.test.ts`:

```ts
it('uses distinct Chinese labels for eligibility, grade, mixed, and no-list rules', () => {
  expect(institutionRuleTypeCopy.eligibility.label).toBe('院校准入限制');
  expect(institutionRuleTypeCopy['grade-threshold'].label).toBe('院校成绩分档');
  expect(institutionRuleTypeCopy.mixed.label).toBe('准入与成绩混合规则');
  expect(institutionRuleTypeCopy.none.label).toBe('未发现院校名单');
});

it('uses rule-specific folded panel titles', () => {
  expect(officialPanelTitle('eligibility', 12)).toBe('查看官方院校准入名单（12 所）');
  expect(officialPanelTitle('grade-threshold', 84)).toBe('查看官方院校成绩分档（84 所）');
  expect(officialPanelTitle('mixed', 81)).toBe('查看官方 Priority List（81 所）');
});
```

- [ ] **Step 3: Run tests and verify they fail on missing rule fields/helpers**

Run:

```powershell
.\node_modules\.bin\vitest.CMD run tests/official-list-display.test.ts tests/presentation.test.ts
```

Expected: FAIL because the panel does not carry rule metadata and the helpers do not exist.

- [ ] **Step 4: Extend the validated panel join**

In `buildOfficialListDisplays`:

1. Reject facts whose source has `institutionRule.type === 'none'`.
2. Preserve the existing rejection for `parser.mode === 'link-only'`.
3. Copy `ruleType`, `summaryZh`, listed/unlisted meaning, caveat, and exact source scope into each panel.
4. Keep duplicate detection, Chinese sorting, maximum extraction time, and source grouping unchanged.

Use a narrowing helper so a fact-bearing source must have non-empty meanings:

```ts
function assertDisplayableRule(source: SourceWithStatus): asserts source is SourceWithStatus & {
  institutionRule: InstitutionRule & {
    type: Exclude<InstitutionRuleType, 'none'>;
    listedMeaningZh: string;
    unlistedMeaningZh: string;
  };
} {
  if (source.institutionRule.type === 'none') {
    throw new Error(`Source ${source.id} is requirements-only and cannot carry institution facts`);
  }
  if (!source.institutionRule.listedMeaningZh || !source.institutionRule.unlistedMeaningZh) {
    throw new Error(`Source ${source.id} has incomplete institution rule meaning`);
  }
}
```

- [ ] **Step 5: Add shared rule labels and folded titles**

In `src/lib/presentation.ts`:

```ts
export const institutionRuleTypeCopy = {
  eligibility: { label: '院校准入限制' },
  'grade-threshold': { label: '院校成绩分档' },
  mixed: { label: '准入与成绩混合规则' },
  none: { label: '未发现院校名单' },
} satisfies Record<InstitutionRuleType, { label: string }>;

export function officialPanelTitle(type: Exclude<InstitutionRuleType, 'none'>, count: number): string {
  if (type === 'eligibility') return `查看官方院校准入名单（${count} 所）`;
  if (type === 'grade-threshold') return `查看官方院校成绩分档（${count} 所）`;
  return `查看官方 Priority List（${count} 所）`;
}
```

Also change the user-facing directory labels only:

- `official-list`: `有中国院校规则`
- `not-public`: `未发现院校规则`

Keep the internal `UniversityState` values and filtering behavior unchanged.

- [ ] **Step 6: Run focused and full model tests**

Run:

```powershell
.\node_modules\.bin\vitest.CMD run tests/official-list-display.test.ts tests/presentation.test.ts tests/search.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the display model and terminology**

```powershell
git add src/lib/official-list-display.ts tests/official-list-display.test.ts src/lib/presentation.ts tests/presentation.test.ts
git commit -m "feat: distinguish institution rule displays"
```

---

### Task 3: Make Reverse Evidence Rule-Aware Without Eligibility Claims

**Files:**
- Modify: `src/lib/evidence.ts`
- Modify: `src/lib/presentation.ts`
- Modify: `src/pages/index.astro`
- Modify: `tests/evidence.test.ts`
- Modify: `tests/presentation.test.ts`
- Modify: `tests/search.test.ts`

**Interfaces:**
- Extends `EvidenceResult` with optional `institutionRule?: InstitutionRule`.
- Produces:

```ts
export function evidenceCopyFor(result: EvidenceResult): { label: string; description: string };
```

- [ ] **Step 1: Write failing rule-aware evidence tests**

Add `institutionRule` metadata to all source fixtures in `tests/evidence.test.ts` and `tests/search.test.ts`. Add to `tests/evidence.test.ts`:

```ts
it('carries reviewed rule meaning into positive and negative structured evidence', () => {
  const match = deriveEvidence({ fact: universityFact, source: universitySource, status: ok });
  const miss = deriveEvidence({ source: universitySource, status: ok });
  expect(match.institutionRule).toEqual(universitySource.institutionRule);
  expect(miss.institutionRule).toEqual(universitySource.institutionRule);
});

it('keeps link-only rule sources neutral even when an unlisted meaning exists', () => {
  const source = {
    ...universitySource,
    parser: { mode: 'link-only' as const, guard: { minimumRecords: 0, maximumRecords: 1, maximumRemovalRatio: 0 } },
  };
  const result = deriveEvidence({ source, status: ok });
  expect(result.state).toBe('no-public-list');
});
```

- [ ] **Step 2: Write failing source-specific copy tests**

Add to `tests/presentation.test.ts`:

```ts
it('describes a grade-threshold match without calling it permission to apply', () => {
  const copy = evidenceCopyFor({
    state: 'official-match',
    institutionRule: gradeThresholdRule,
  });
  expect(copy.label).toBe('在官方院校成绩分档中找到');
  expect(copy.description).toBe(gradeThresholdRule.listedMeaningZh);
  expect(`${copy.label}${copy.description}`).not.toMatch(/可以申请|不能申请/);
});

it('uses the reviewed unlisted meaning for a structured miss', () => {
  const copy = evidenceCopyFor({
    state: 'not-found-in-public-list',
    institutionRule: gradeThresholdRule,
  });
  expect(copy.description).toBe(gradeThresholdRule.unlistedMeaningZh);
});

it('does not apply an unlisted conclusion to an unparsed source', () => {
  const copy = evidenceCopyFor({ state: 'no-public-list', institutionRule: gradeThresholdRule });
  expect(copy.description).toContain('暂未完成安全结构化');
  expect(copy.description).not.toBe(gradeThresholdRule.unlistedMeaningZh);
});
```

- [ ] **Step 3: Run focused tests and verify the expected failure**

Run:

```powershell
.\node_modules\.bin\vitest.CMD run tests/evidence.test.ts tests/presentation.test.ts tests/search.test.ts
```

Expected: FAIL because `EvidenceResult` lacks rule metadata and `evidenceCopyFor` does not exist.

- [ ] **Step 4: Propagate rule metadata through evidence derivation**

In `sourceMetadata`, copy `input.source?.institutionRule` when present. Keep anomaly precedence unchanged. Keep `link-only` sources on `no-public-list` and do not create a new positive or negative evidence state.

- [ ] **Step 5: Implement rule-aware evidence copy**

In `src/lib/presentation.ts`, keep `evidenceStateCopy` as anomaly/general fallback and add `evidenceCopyFor` with this behavior:

```ts
export function evidenceCopyFor(result: EvidenceResult): { label: string; description: string } {
  const rule = result.institutionRule;
  if (result.state === 'official-match' || result.state === 'faculty-match') {
    if (rule?.type === 'eligibility') return { label: '在官方院校准入名单中找到', description: rule.listedMeaningZh ?? rule.summaryZh };
    if (rule?.type === 'grade-threshold') return { label: '在官方院校成绩分档中找到', description: rule.listedMeaningZh ?? rule.summaryZh };
    if (rule?.type === 'mixed') return { label: '在官方 Priority List 中找到', description: rule.listedMeaningZh ?? rule.summaryZh };
  }
  if (result.state === 'not-found-in-public-list' && rule?.type !== 'none' && rule?.unlistedMeaningZh) {
    return { label: '结构化院校表中暂未找到', description: rule.unlistedMeaningZh };
  }
  if (result.state === 'no-public-list' && rule && rule.type !== 'none') {
    return { label: institutionRuleTypeCopy[rule.type].label, description: '官网存在院校规则，但本站暂未完成安全结构化，暂不判断该院校所在分组。' };
  }
  return evidenceStateCopy[result.state];
}
```

For `faculty-match`, prepend or append `仅适用于${result.scopeZh}` in the rendered metadata; do not change the rule meaning itself.

- [ ] **Step 6: Switch the client-rendered evidence card to the helper**

In `src/pages/index.astro`:

```ts
import { evidenceCopyFor, sourceFreshnessCopy } from '../lib/presentation';
// ...
const copy = evidenceCopyFor(card.evidence);
```

Keep tier, score, scope, cycle, freshness, and official-source fields unchanged.

- [ ] **Step 7: Run focused and complete search/evidence tests**

Run:

```powershell
.\node_modules\.bin\vitest.CMD run tests/evidence.test.ts tests/presentation.test.ts tests/search.test.ts tests/reverse-index.test.ts
```

Expected: PASS; anomaly ordering and 165 positive reverse-index rows remain unchanged.

- [ ] **Step 8: Commit rule-aware evidence**

```powershell
git add src/lib/evidence.ts src/lib/presentation.ts src/pages/index.astro tests/evidence.test.ts tests/presentation.test.ts tests/search.test.ts
git commit -m "feat: explain institution evidence by rule type"
```

---

### Task 4: Render Accurate Folded Rules and Faculty Scope

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/page-content.test.mjs`

**Interfaces:**
- Consumes `OfficialListDisplayPanel.ruleType`, its reviewed meanings, and `officialPanelTitle(...)`.
- Produces type badges, accurate folded headings, source-level meaning blocks, exact scope warnings, and generic neutral disclosures for unparsed rules.

- [ ] **Step 1: Write the failing page contract**

Add to `tests/page-content.test.mjs`:

```js
it('labels institution rules by meaning instead of treating every source as an eligibility List', () => {
  expect(page).toContain('officialPanelTitle(panel.ruleType, panel.rows.length)');
  expect(page).toContain('panel.ruleSummaryZh');
  expect(page).toContain('panel.listedMeaningZh');
  expect(page).toContain('panel.unlistedMeaningZh');
  expect(page).toContain("panel.scope !== 'university'");
  expect(page).toContain('仅适用于：');
  expect(page).toContain('官网存在院校规则，但本站暂未完成安全结构化');
  expect(page).not.toContain('查看已收录院校 List（');
});
```

- [ ] **Step 2: Run the page test and verify the expected failure**

Run:

```powershell
.\node_modules\.bin\vitest.CMD run tests/page-content.test.mjs
```

Expected: FAIL on the old generic List title and missing meanings.

- [ ] **Step 3: Render source rule badges and reviewed meanings**

At the Astro frontmatter import `institutionRuleTypeCopy` and `officialPanelTitle`.

Inside each official source action, add:

```astro
<small class="rule-type">{institutionRuleTypeCopy[source.institutionRule.type].label}</small>
```

Inside each folded panel:

```astro
<summary>{officialPanelTitle(panel.ruleType, panel.rows.length)}</summary>
<div class="official-rule-meaning">
  <strong>{panel.ruleSummaryZh}</strong>
  <p><span>名单内：</span>{panel.listedMeaningZh}</p>
  <p><span>名单外：</span>{panel.unlistedMeaningZh}</p>
  {panel.caveatZh && <p>{panel.caveatZh}</p>}
  {panel.scope !== 'university' && <p class="scope-warning">仅适用于：{panel.scopeZh}</p>}
</div>
```

Keep the existing source/cycle/extraction metadata and institution rows below this block.

- [ ] **Step 4: Generalize the link-only disclosure without university IDs**

For each source where `source.parser.mode === 'link-only'` and `source.institutionRule.type !== 'none'`, render:

```astro
<div class="link-only-disclosure">
  <strong>{institutionRuleTypeCopy[source.institutionRule.type].label}</strong>
  <span>{source.institutionRule.summaryZh}</span>
  <span>官网存在院校规则，但本站暂未完成安全结构化，本站暂不附表。</span>
  <span>{source.institutionRule.unlistedMeaningZh}</span>
</div>
```

Do not use `university.id`, `state === 'official-list'`, or a Southampton-specific conditional. A `none` faculty source receives no disclosure block and keeps its normal source link.

- [ ] **Step 5: Add responsive meaning and badge styles**

Add styles for `.rule-type`, `.official-rule-meaning`, and `.scope-warning`:

- all blocks `min-width: 0; max-width: 100%`;
- long English and Chinese text uses `overflow-wrap: anywhere`;
- meaning block has a subtle background distinct from the institution rows;
- scope warning has an accessible text label, not color alone;
- under `@media(max-width:800px)`, meanings and metadata remain one column.

- [ ] **Step 6: Run page and full tests**

Run:

```powershell
.\node_modules\.bin\vitest.CMD run tests/page-content.test.mjs tests/official-list-display.test.ts tests/presentation.test.ts
pnpm test:run
```

Expected: all tests pass.

- [ ] **Step 7: Build and run rendered QA**

Run:

```powershell
pnpm build
```

With the Browser plugin at `http://127.0.0.1:4322/`, verify:

1. UCL is labelled `院校成绩分档`, the folded title says `84 所`, and both the 85/80 and 90/85 meanings appear before rows.
2. Edinburgh is labelled `准入与成绩混合规则`, the folded title says `81 所`, and the Band-dependent warning appears.
3. Southampton has no local rows, links directly to the Tier page, and says unlisted institutions use Tier D without assigning the searched institution locally.
4. Manchester Law shows `部分学院公开` plus its source scope, but no folded List because the page has no institution names.
5. A fixture or model test proves a future structured faculty list would show `仅适用于：...`.
6. Desktop and 320px views have no horizontal overflow, framework overlay, console error, clipping, or unreadable long name.
7. Native `<details>` opens and closes with pointer; summary receives visible keyboard focus.

- [ ] **Step 8: Commit the accurate UI**

```powershell
git add src/pages/index.astro src/styles/global.css tests/page-content.test.mjs
git commit -m "feat: label folded institution rules accurately"
```

---

### Task 5: Update Public Methodology and Reverify the Release

**Files:**
- Modify: `src/pages/methodology.astro`
- Modify: `README.md`
- Modify: `tests/page-content.test.mjs`

**Interfaces:**
- Documents the same four rule types and the faculty/link-only boundaries used by code.

- [ ] **Step 1: Write the failing documentation contract**

Add to `tests/page-content.test.mjs`:

```js
it('explains the difference between eligibility rules and grade-threshold lists', () => {
  for (const phrase of ['院校准入限制', '院校成绩分档', '混合规则', '名单外不一定不能申请', '仅适用于部分学院']) {
    expect(`${methodology}${readme}`).toContain(phrase);
  }
});
```

- [ ] **Step 2: Run the page test and verify the expected failure**

Run:

```powershell
.\node_modules\.bin\vitest.CMD run tests/page-content.test.mjs
```

Expected: FAIL because the public docs still use undifferentiated List language.

- [ ] **Step 3: Update methodology and README**

Document:

- a List may control eligibility, grade thresholds, or both;
- UCL is grade-threshold, Southampton is Tier grade-threshold, Edinburgh is mixed, and Manchester Law is requirements-only;
- a structured faculty list is shown with exact scope, while a faculty page without institution rows is not a List;
- a match is not an admission decision and a miss is interpreted through the source's reviewed unlisted meaning;
- rule meaning is manually reviewed and is not changed automatically by the scraper;
- daily automation, free-service boundary, and official-source-only policy remain unchanged.

- [ ] **Step 4: Run fresh release verification**

Run:

```powershell
pnpm test:run
pnpm build
node scripts/report-source-coverage.mjs
git diff --check
git status --short
```

Expected:

- all tests pass with zero failures;
- Astro reports 0 errors, 0 warnings, and 0 hints;
- coverage remains 28 cohort universities, 3 full public-rule records, 1 faculty-only record, 24 no-public-list records, 2 parser-enabled sources, and 26 link-only sources;
- only the planned documentation/test files are uncommitted before commit.

- [ ] **Step 5: Commit documentation**

```powershell
git add src/pages/methodology.astro README.md tests/page-content.test.mjs
git commit -m "docs: explain Chinese institution rule types"
```

- [ ] **Step 6: Request a final whole-branch review**

Review `7aa3db0d457a80b734a71cc2582807b3971668b8..HEAD` against:

- `docs/superpowers/specs/2026-08-01-inline-official-lists-design.md`
- `docs/superpowers/specs/2026-08-02-china-institution-rule-types-design.md`
- this implementation plan

Fix every Critical and Important issue, then rerun the complete release verification before offering integration options.
