# Daily Check Date and Ranking Edition Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every successful daily official-source request publish a fresh `最近成功检查` date without accepting changed application facts, and add a separate weekly review-only detector for new QS and THE editions.

**Architecture:** Keep the existing source checker as the only daily writer of operational source status, but treat `lastSuccessfulAt` as a persisted semantic field and rebuild the public join before tests. Changed official content keeps the last accepted facts, records an observed fingerprint, and opens or updates a review Issue; the existing reviewed synchronization path remains the only route that can accept the change. A separate pure ranking-edition detector reads the two reviewed release records, writes an audit artifact, and lets a weekly workflow upsert review Issues without writing rankings or deploying the site.

**Tech Stack:** Node.js 22, ECMAScript modules, TypeScript 6, Vitest 4, pnpm 10, Astro 7, GitHub Actions, GitHub Pages.

## Global Constraints

- Keep the existing university directory UI and source-row layout unchanged.
- A successfully reached source, including a source whose content changed, must publish the current run time as `lastSuccessfulAt`.
- A failed source must retain its previous `lastSuccessfulAt`; failed reachability must never be presented as a successful check.
- Daily automation may update only operational source status. It must not accept an observed hash or edit university lists, grade requirements, Chinese summaries, institution identities, generated requirements, or rankings.
- Changed official content is a review event, not a workflow failure. Retain accepted facts, record the observed fingerprint when the response body is available, and create or update one review Issue; a temporarily missing fingerprint must be stated rather than fail the workflow.
- QS 2027 and THE 2026 remain published until a separately reviewed ranking pull request is merged.
- The ranking-edition monitor runs weekly, uses only official HTTPS release URLs, exits successfully on temporary failures or ambiguous pages, and never guesses or writes an edition.
- Keep GitHub Actions on Node.js 22 and keep every third-party action pinned to its approved full commit SHA.
- Add no paid API, runtime server, database, or always-on personal computer requirement.
- Use strict RED → GREEN TDD for every behavior change and commit each independently reviewable task.

---

### Task 1: Persist successful daily dates without weakening failure semantics

**Files:**
- Modify: `scripts/check-sources.mjs`
- Modify: `tests/check-sources.test.ts`
- Modify: `tests/check-sources-runner.test.mjs`

**Interfaces:**
- Consumes: `checkSource(source, fetchImpl, previous, now): Promise<SourceStatus>` from `scripts/source-checker.mjs`.
- Changes: `semanticState(status, source)` includes `lastSuccessfulAt` when deciding whether tracked `status.json` must be rewritten.
- Preserves: accepted `contentHash`, observed-change behavior, three-failure exposure thresholds, and previous success dates on failed requests.

- [ ] **Step 1: Rewrite the runner test to require a tracked success-date change**

In `tests/check-sources-runner.test.mjs`, import `runSourceChecks` and `vi`, then replace the old “timestamp-only status does not persist” contract with a deterministic test using `now: new Date('2026-08-10T03:17:00.000Z')`:

```js
const result = await runSourceChecks({
  root: temporaryRoot,
  sources: [{ id: 'source-1', url: 'https://www.example.ac.uk/china' }],
  previous: previousStatus,
  fetchImpl: vi.fn().mockImplementation(() => new Response(
    '<html>official requirements</html>',
    { status: 200, headers: { 'content-type': 'text/html' } },
  )),
  now: new Date('2026-08-10T03:17:00.000Z'),
  minimumGapMs: 0,
});

expect(result.statusChanged).toBe(true);
expect(result.status['source-1']).toMatchObject({
  health: 'ok',
  contentHash: acceptedRequirementsHash,
  lastSuccessfulAt: '2026-08-10T03:17:00.000Z',
});
```

Keep the audit-artifact assertion and assert that the persisted status date equals the attempt date. Change the 200-then-304 test to use two fixed dates and require the second successful 304 to persist the second date.

- [ ] **Step 2: Strengthen changed-page and failed-page date assertions**

In `tests/check-sources.test.ts`, extend the existing changed-content test:

```ts
expect(result).toMatchObject({
  health: 'changed',
  contentHash: acceptedRequirementsHash,
  observedContentHash: observedRequirementsHash,
  lastSuccessfulAt: now1.toISOString(),
});
```

Retain the existing 403/404/429/5xx and timeout assertions that each failure keeps `previous.lastSuccessfulAt`. Add the same date assertion to the 304 pending-review test because a successful 304 is also a successful check.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
pnpm exec vitest run tests/check-sources.test.ts tests/check-sources-runner.test.mjs
```

Expected: the runner date-persistence cases fail because `semanticState()` currently omits `lastSuccessfulAt`; the source-checker behavior assertions for changed pages and failed requests already pass.

- [ ] **Step 4: Persist `lastSuccessfulAt` as semantic operational state**

In `scripts/check-sources.mjs`, change only `semanticState`:

```js
function semanticState(status, source) {
  return {
    contentHash: status?.contentHash,
    observedContentHash: status?.observedContentHash,
    health: status?.health,
    redirectDestination: redirectDestination(status, source),
    consecutiveFailures: status?.consecutiveFailures ?? 0,
    lastSuccessfulAt: status?.lastSuccessfulAt,
  };
}
```

Do not add `checkedAt`, validators, or raw HTTP metadata to this comparison; unsuccessful timestamp churn must not overwrite the last successful date.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
pnpm exec vitest run tests/check-sources.test.ts tests/check-sources-runner.test.mjs
```

Expected: all cases pass; unchanged 200, changed 200, and 304 persist a new successful date, while failures retain the previous date.

- [ ] **Step 6: Commit the status-persistence unit**

```powershell
git add scripts/check-sources.mjs tests/check-sources.test.ts tests/check-sources-runner.test.mjs
git commit -m "fix: persist daily source success dates"
```

---

### Task 2: Make integrity tests accept mutable operational status only

**Files:**
- Create: `tests/helpers/source-status.ts`
- Create: `tests/helpers/source-status.test.ts`
- Modify: `tests/catalog.test.ts`
- Modify: `tests/pending-china-audit.test.ts`

**Interfaces:**
- Produces: `expectUnacceptedLinkOnlyStatus(value: unknown, sourceId: string): void`.
- Consumes: the exact existing batch source manifests and `SourceStatus` type.
- Preserves: exact URLs, source IDs, university ownership, scope, rule meaning, parser guards, approved hashes, institution registry digest, requirements digest, ranking data, and audit decisions.

- [ ] **Step 1: Add a failing lifecycle-helper contract**

Create `tests/helpers/source-status.test.ts` first. Exercise the intended helper with an `ok` status containing dates and an observed hash, and with malformed cases:

```ts
expect(() => expectUnacceptedLinkOnlyStatus({
  sourceId: 'example-source',
  health: 'ok',
  consecutiveFailures: 0,
  checkedAt: '2026-08-10T03:17:00.000Z',
  lastSuccessfulAt: '2026-08-10T03:17:00.000Z',
  observedContentHash: 'a'.repeat(64),
}, 'example-source')).not.toThrow();

expect(() => expectUnacceptedLinkOnlyStatus({
  sourceId: 'example-source', health: 'invented', consecutiveFailures: 0,
}, 'example-source')).toThrow();
expect(() => expectUnacceptedLinkOnlyStatus({
  sourceId: 'example-source', health: 'ok', consecutiveFailures: -1,
}, 'example-source')).toThrow();
expect(() => expectUnacceptedLinkOnlyStatus({
  sourceId: 'example-source', health: 'ok', contentHash: 'b'.repeat(64),
}, 'example-source')).toThrow();
```

- [ ] **Step 2: Run the helper test and verify RED**

Run:

```powershell
pnpm exec vitest run tests/helpers/source-status.test.ts
```

Expected: FAIL because `tests/helpers/source-status.ts` does not exist.

- [ ] **Step 3: Implement the narrow operational-status assertion**

Create `tests/helpers/source-status.ts`:

```ts
import { expect } from 'vitest';
import type { SourceHealth, SourceStatus } from '../../src/lib/types';

const allowedHealth = new Set<SourceHealth>([
  'unchecked', 'ok', 'redirected', 'changed', 'temporary-error', 'unavailable',
]);
const sha256 = /^[a-f0-9]{64}$/u;

export function expectUnacceptedLinkOnlyStatus(value: unknown, sourceId: string): void {
  expect(value).toEqual(expect.objectContaining({ sourceId }));
  const status = value as SourceStatus;
  expect(allowedHealth.has(status.health)).toBe(true);
  expect(status.consecutiveFailures ?? 0).toBeGreaterThanOrEqual(0);
  expect(status).not.toHaveProperty('contentHash');
  if (status.checkedAt) expect(Number.isNaN(Date.parse(status.checkedAt))).toBe(false);
  if (status.lastSuccessfulAt) expect(Number.isNaN(Date.parse(status.lastSuccessfulAt))).toBe(false);
  if (status.observedContentHash) expect(status.observedContentHash).toMatch(sha256);
}
```

This helper deliberately permits operational fields and observed hashes, but it still rejects an automatically invented accepted hash for these link-only sources.

- [ ] **Step 4: Replace the frozen `unchecked` assertions**

Import the helper in `tests/catalog.test.ts` and `tests/pending-china-audit.test.ts`. Replace each exact assertion of:

```ts
{ sourceId, health: 'unchecked', consecutiveFailures: 0 }
```

with:

```ts
expectUnacceptedLinkOnlyStatus(statuses[sourceId], sourceId);
```

Rename the batch test descriptions from “starts every source unchecked” to “keeps every source lifecycle-compatible without an accepted hash”. Do not change any source manifest or protected fact assertion.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
pnpm exec vitest run tests/helpers/source-status.test.ts tests/catalog.test.ts tests/pending-china-audit.test.ts
```

Expected: all lifecycle variants pass and every immutable source/fact baseline remains exact.

- [ ] **Step 6: Commit the lifecycle test boundary**

```powershell
git add tests/helpers/source-status.ts tests/helpers/source-status.test.ts tests/catalog.test.ts tests/pending-china-audit.test.ts
git commit -m "test: allow reviewed source status lifecycle"
```

---

### Task 3: Rebuild the public status join before verification

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/daily-check.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/public-data.test.mjs`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: package script `build:public = node scripts/build-public-data.mjs`.
- Consumes: current `src/data/status.json` and existing `buildPublicData(...)` join.
- Guarantees: daily and CI run `pnpm build:public` after source status changes and before `pnpm test:run`.
- Preserves: the bot commit stages only `src/data/status.json`; generated files are build artifacts, not bot-authored facts.

- [ ] **Step 1: Add the public-date propagation test**

Extend `tests/public-data.test.mjs` with a temporary-output case containing one university, one link-only source, and this status:

```js
const lastSuccessfulAt = '2026-08-10T03:17:00.000Z';
const statuses = {
  'example-china': { sourceId: 'example-china', health: 'ok', lastSuccessfulAt, consecutiveFailures: 0 },
};
```

Call `buildPublicData` with `universities`, an empty ranking dataset, empty institutions/requirements, the source, and `statuses`. Assert:

```js
const [record] = JSON.parse(await readFile(join(outputDir, 'universities.json'), 'utf8'));
expect(record.sources[0].status.lastSuccessfulAt).toBe(lastSuccessfulAt);
```

- [ ] **Step 2: Add failing workflow-order contracts**

In `tests/workflows.test.mjs`, require the daily ordered fragments to be:

```js
[
  'lycheeverse/lychee-action',
  'pnpm check:sources',
  'pnpm build:public',
  'pnpm test:run',
  '- run: pnpm build\n',
  'git commit',
]
```

Add a CI assertion that `pnpm build:public` occurs after the reverse-index consistency check and before `pnpm test:run`. Keep the exact status-only commit-script assertion unchanged.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
pnpm exec vitest run tests/public-data.test.mjs tests/workflows.test.mjs
```

Expected: the public builder propagation test passes against existing code; workflow tests fail because neither workflow regenerates public data before tests and `build:public` is not defined.

- [ ] **Step 4: Add the explicit public-data script and workflow steps**

Add to `package.json`:

```json
"build:public": "node scripts/build-public-data.mjs"
```

In `.github/workflows/daily-check.yml`, insert:

```yaml
      - run: pnpm build:public
```

immediately after `pnpm check:sources` and before `pnpm test:run`.

In `.github/workflows/ci.yml`, insert the same command after the reverse-index diff guard and before `pnpm test:run`. Do not stage generated files in either workflow.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
pnpm exec vitest run tests/public-data.test.mjs tests/workflows.test.mjs
```

Expected: date propagation and both workflow-order contracts pass; the daily status-only commit contract remains byte-for-byte exact.

- [ ] **Step 6: Commit the public-join ordering unit**

```powershell
git add package.json .github/workflows/daily-check.yml .github/workflows/ci.yml tests/public-data.test.mjs tests/workflows.test.mjs
git commit -m "fix: rebuild daily public source status"
```

---

### Task 4: Put changed-page fingerprints in review Issues

**Files:**
- Modify: `scripts/render-anomaly-issue.mjs`
- Modify: `tests/anomaly-issue.test.mjs`
- Modify: `.github/workflows/daily-check.yml`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Extends anomaly input with optional `acceptedContentHash` and `observedContentHash`.
- Validates: every supplied fingerprint is a 64-character lowercase hexadecimal SHA-256; a missing observed fingerprint is rendered explicitly and never crashes a daily review of an already-changed but temporarily unreachable source.
- Produces: deterministic Issue body fields for the accepted fingerprint and current observed fingerprint.

- [ ] **Step 1: Add failing changed-page Issue tests**

In `tests/anomaly-issue.test.mjs`, add:

```js
const changed = {
  ...anomaly,
  reason: 'source-changed',
  acceptedContentHash: 'a'.repeat(64),
  observedContentHash: 'b'.repeat(64),
};

expect(renderAnomalyIssue(changed)).toContain('`' + 'a'.repeat(64) + '`');
expect(renderAnomalyIssue(changed)).toContain('`' + 'b'.repeat(64) + '`');
expect(renderAnomalyIssue({ ...changed, observedContentHash: undefined }))
  .toContain('本次未捕获');
expect(() => renderAnomalyIssue({ ...changed, observedContentHash: 'not-a-hash' }))
  .toThrow(/observedContentHash/u);
```

In `tests/workflows.test.mjs`, require the daily Issue mapper to include both `status.contentHash` and `status.observedContentHash`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
pnpm exec vitest run tests/anomaly-issue.test.mjs tests/workflows.test.mjs
```

Expected: FAIL because the renderer and workflow currently omit the fingerprints.

- [ ] **Step 3: Validate and render fingerprints**

In `scripts/render-anomaly-issue.mjs`, add a `sha256Pattern` and validate only supplied fingerprints:

```js
if (anomaly.observedContentHash !== undefined
  && !sha256Pattern.test(anomaly.observedContentHash)) {
  throw new TypeError('observedContentHash must be a SHA-256 fingerprint');
}
```

Render these two rows in the evidence table, using `未建立` or `未记录` only when a non-change anomaly has no hash:

```md
| 已接受内容指纹 | \`${anomaly.acceptedContentHash ?? '未建立'}\` |
| 本次观察指纹 | ${anomaly.observedContentHash ? `\`${anomaly.observedContentHash}\`` : '本次未捕获'} |
```

Keep the existing retained-trusted-facts sentence and stable Issue marker.

- [ ] **Step 4: Pass fingerprints from the daily audit**

In the daily workflow anomaly mapping, add:

```js
acceptedContentHash: status.contentHash,
observedContentHash: status.observedContentHash,
```

Do not add any acceptance or source synchronization command.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
pnpm exec vitest run tests/anomaly-issue.test.mjs tests/workflows.test.mjs
```

Expected: changed-source Issues contain both review fingerprints; availability Issues remain valid without them.

- [ ] **Step 6: Commit the review evidence unit**

```powershell
git add scripts/render-anomaly-issue.mjs tests/anomaly-issue.test.mjs .github/workflows/daily-check.yml tests/workflows.test.mjs
git commit -m "feat: include source change fingerprints"
```

---

### Task 5: Detect new ranking editions without guessing or writing data

**Files:**
- Create: `scripts/ranking-edition-monitor.mjs`
- Create: `scripts/check-ranking-editions.mjs`
- Create: `tests/ranking-edition-monitor.test.mjs`
- Create: `tests/ranking-edition-runner.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `detectRankingEdition(html: string, provider: 'qs' | 'the'): number | undefined`.
- Uses internally: `extractTitleAndHeadingSignals(html: string): string`, limited to `<title>`, `<h1>`, and `og:title` metadata.
- Produces: `inspectRankingEditions({ releases, fetchImpl, checkedAt }): Promise<{ checkedAt: string, results: RankingEditionResult[] }>`.
- Produces: `runRankingEditionCheck({ root?, rankings?, fetchImpl?, checkedAt? }): Promise<RankingEditionAudit>` and artifact `artifacts/ranking-edition-audit.json`.
- `RankingEditionResult.status` is one of `current`, `new-edition`, `unverified`, or `unavailable`.
- `RankingEditionResult` contains `{ provider, sourceUrl, reviewedEdition, detectedEdition?, status, checkedAt, httpStatus?, notice? }`; `checkedAt` is copied from the deterministic run time so the Issue renderer never invents a date.
- Consumes: the two current official HTTPS `releases` from `src/data/rankings.json`; it never writes that file.

- [ ] **Step 1: Write parser and monitor RED tests**

Create `tests/ranking-edition-monitor.test.mjs`. Use title/H1 fixtures, not live network calls:

```js
expect(detectRankingEdition(
  '<title>QS World University Rankings 2027</title>', 'qs',
)).toBe(2027);
expect(detectRankingEdition(
  '<h1>World University Rankings 2026</h1>', 'the',
)).toBe(2026);
expect(detectRankingEdition(
  '<title>QS World University Rankings 2027</title><h1>QS World University Rankings 2028</h1>', 'qs',
)).toBeUndefined();
```

Use two reviewed releases and a fetch mock returning QS 2028 and THE 2026. Assert QS is `new-edition`, THE is `current`, and the input releases remain deep-equal to a pre-call clone. Add non-OK, thrown-fetch, missing-edition, and detected-older-edition cases; each must return `unavailable` or `unverified` without throwing.

- [ ] **Step 2: Write the runner artifact RED test**

Create `tests/ranking-edition-runner.test.mjs` using a temporary root and injected rankings/fetch/date. Require an atomically written `artifacts/ranking-edition-audit.json`, exact checked time, and no `src/data/rankings.json` write.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
pnpm exec vitest run tests/ranking-edition-monitor.test.mjs tests/ranking-edition-runner.test.mjs
```

Expected: FAIL because the monitor and runner modules do not exist.

- [ ] **Step 4: Implement conservative edition extraction**

Create `scripts/ranking-edition-monitor.mjs`. Extract text only from `<title>`, `<h1>`, and `og:title` metadata. Use this concrete signal extractor:

```js
function cleanSignal(value) {
  return value
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&nbsp;/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function extractTitleAndHeadingSignals(html) {
  const signals = [...html.matchAll(/<(title|h1)\b[^>]*>([\s\S]*?)<\/\1>/giu)]
    .map((match) => match[2]);
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/giu)) {
    if (!/\b(?:property|name)=["']og:title["']/iu.test(tag)) continue;
    const content = tag.match(/\bcontent=["']([^"']+)["']/iu)?.[1];
    if (content) signals.push(content);
  }
  return signals.map(cleanSignal).filter(Boolean).join('\n');
}
```

Match provider-specific names followed by `20xx`, collect distinct editions, and return a value only when exactly one distinct edition is present:

```js
const patterns = {
  qs: /\bQS World University Rankings?\s*[:\-–—]?\s*(20\d{2})\b/giu,
  the: /\b(?:THE\s+)?World University Rankings?\s*[:\-–—]?\s*(20\d{2})\b/giu,
};

export function detectRankingEdition(html, provider) {
  const signals = extractTitleAndHeadingSignals(html);
  const editions = new Set([...signals.matchAll(patterns[provider])].map((match) => Number(match[1])));
  return editions.size === 1 ? [...editions][0] : undefined;
}
```

`inspectRankingEditions` must fetch each release `sourceUrl` with GET, redirect following, and the existing public educational user-agent. Classify exact equality as `current`, greater edition as `new-edition`, missing/ambiguous/older edition as `unverified`, and fetch exceptions/non-OK responses as `unavailable`. Return results instead of throwing for these page-level outcomes.

- [ ] **Step 5: Implement the audit runner**

Create `scripts/check-ranking-editions.mjs`. Read only `src/data/rankings.json`, call the pure monitor, and atomically write `artifacts/ranking-edition-audit.json` using a `.next` file plus `rename`. When executed directly, print one summary line and exit zero for `current`, `unverified`, and `unavailable` results. Throw only for local schema/I/O/programming errors.

Add to `package.json`:

```json
"monitor:ranking-editions": "node scripts/check-ranking-editions.mjs"
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
pnpm exec vitest run tests/ranking-edition-monitor.test.mjs tests/ranking-edition-runner.test.mjs
```

Expected: every deterministic parser, network outcome, immutability, and artifact case passes without accessing the internet.

- [ ] **Step 7: Commit the ranking detector unit**

```powershell
git add scripts/ranking-edition-monitor.mjs scripts/check-ranking-editions.mjs tests/ranking-edition-monitor.test.mjs tests/ranking-edition-runner.test.mjs package.json
git commit -m "feat: detect new ranking editions"
```

---

### Task 6: Upsert weekly ranking review Issues only

**Files:**
- Create: `scripts/render-ranking-edition-issue.mjs`
- Create: `tests/ranking-edition-issue.test.mjs`
- Create: `.github/workflows/ranking-edition-check.yml`
- Modify: `tests/workflows.test.mjs`

**Interfaces:**
- Produces: `rankingEditionIssuePayload(candidate): { key: string, title: string, body: string }`.
- Consumes: `new-edition` results from `artifacts/ranking-edition-audit.json`.
- Produces: one stable open Issue per provider and detected edition, keyed as `ranking-edition:<provider>:<edition>`.
- Does not consume or write ranking records, generated output, branches, commits, Pages artifacts, or deployments.

- [ ] **Step 1: Write the Issue renderer RED test**

Create `tests/ranking-edition-issue.test.mjs` with a QS 2028 candidate. Require:

```js
expect(rankingEditionIssuePayload(candidate)).toMatchObject({
  key: 'ranking-edition:qs:2028',
  title: '[排名待复核] QS 2028',
});
```

Require the body to contain the official HTTPS URL, reviewed edition 2027, detected edition 2028, checked time, and checklist items for UK university identity, exact/tied/band placement, additions, removals, provenance, and tests/build. Reject unknown providers, non-integer editions, `detectedEdition <= reviewedEdition`, and non-HTTPS URLs.

- [ ] **Step 2: Add the weekly-workflow RED contract**

In `tests/workflows.test.mjs`, load `.github/workflows/ranking-edition-check.yml` and assert:

- schedule is exactly weekly (`41 4 * * 1`) plus `workflow_dispatch`;
- job permission is `contents: read` and `issues: write` only;
- it runs `pnpm monitor:ranking-editions` and reads `artifacts/ranking-edition-audit.json`;
- it filters only `status === 'new-edition'` and upserts by the stable marker;
- it contains no `git commit`, `git push`, `rankings.json` write, Pages upload, or deploy action.

Extend `officialWorkflowText` with the new workflow. Update approved action counts to checkout 4, setup-node 4, github-script 2, total official uses 16, and four `node-version: 22` occurrences.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
pnpm exec vitest run tests/ranking-edition-issue.test.mjs tests/workflows.test.mjs
```

Expected: FAIL because neither renderer nor weekly workflow exists.

- [ ] **Step 4: Implement the deterministic review Issue**

Create `scripts/render-ranking-edition-issue.mjs` with strict candidate validation and this stable marker/title scheme:

```js
return {
  key: `ranking-edition:${candidate.provider}:${candidate.detectedEdition}`,
  title: `[排名待复核] ${candidate.provider.toUpperCase()} ${candidate.detectedEdition}`,
  body: renderRankingEditionIssue(candidate),
};
```

The body must explicitly say the monitor did not change ranking data and that publication requires a reviewed PR.

- [ ] **Step 5: Implement the review-only weekly workflow**

Create `.github/workflows/ranking-edition-check.yml` with the approved pinned checkout, setup-node, and github-script SHAs already used by the repository. Use Node 22, frozen pnpm install, then run `pnpm monitor:ranking-editions`. The github-script step must read the audit, import `rankingEditionIssuePayload`, list open Issues, and update or create one Issue for each `new-edition` result. It must not fail when the audit contains only `current`, `unverified`, or `unavailable` results.

Use this workflow shape and keep the full pinned SHAs literal:

```yaml
name: Ranking edition review check
on:
  schedule:
    - cron: '41 4 * * 1'
  workflow_dispatch:
permissions: {}
jobs:
  check:
    permissions:
      contents: read
      issues: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 22
          package-manager-cache: false
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm monitor:ranking-editions
      - name: Create or update ranking edition review Issues
        uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
        with:
          retries: 3
          script: |
            const { readFileSync } = require('node:fs');
            const audit = JSON.parse(readFileSync(
              `${process.env.GITHUB_WORKSPACE}/artifacts/ranking-edition-audit.json`, 'utf8',
            ));
            const candidates = audit.results.filter((result) => result.status === 'new-edition');
            if (candidates.length === 0) return;
            const { rankingEditionIssuePayload } = await import(
              `${process.env.GITHUB_WORKSPACE}/scripts/render-ranking-edition-issue.mjs`
            );
            const openIssues = await github.paginate(github.rest.issues.listForRepo, {
              owner: context.repo.owner, repo: context.repo.repo, state: 'open', per_page: 100,
            });
            for (const candidate of candidates) {
              const payload = rankingEditionIssuePayload(candidate);
              const marker = `<!-- ${payload.key} -->`;
              const existing = openIssues.find((issue) => !issue.pull_request && issue.body?.includes(marker));
              const request = {
                owner: context.repo.owner, repo: context.repo.repo,
                title: payload.title, body: payload.body,
              };
              if (existing) {
                await github.rest.issues.update({ ...request, issue_number: existing.number });
              } else {
                await github.rest.issues.create(request);
              }
            }
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
pnpm exec vitest run tests/ranking-edition-issue.test.mjs tests/workflows.test.mjs
```

Expected: the renderer and weekly review-only workflow contracts pass, including exact action pins and absence of write/deploy commands.

- [ ] **Step 7: Commit the weekly review workflow unit**

```powershell
git add scripts/render-ranking-edition-issue.mjs tests/ranking-edition-issue.test.mjs .github/workflows/ranking-edition-check.yml tests/workflows.test.mjs
git commit -m "feat: open ranking edition review issues"
```

---

### Task 7: Full regression, generated-artifact, and protected-data verification

**Files:**
- Verify: `src/data/institutions.json`
- Verify: `src/data/generated/requirements.json`
- Verify: `src/data/generated/reverse-index.json`
- Verify: `src/data/rankings.json`
- Verify: `src/data/universities.json`
- Verify: `public/generated/**`

**Interfaces:**
- Consumes: all completed task units.
- Produces: a branch whose daily and weekly workflows are fully covered, whose production build succeeds, and whose protected facts are unchanged from implementation base `5c88fdb`.

- [ ] **Step 1: Run all focused monitoring tests together**

```powershell
pnpm exec vitest run tests/check-sources.test.ts tests/check-sources-runner.test.mjs tests/helpers/source-status.test.ts tests/catalog.test.ts tests/pending-china-audit.test.ts tests/public-data.test.mjs tests/anomaly-issue.test.mjs tests/ranking-edition-monitor.test.mjs tests/ranking-edition-runner.test.mjs tests/ranking-edition-issue.test.mjs tests/workflows.test.mjs
```

Expected: all tests pass in one process without network access.

- [ ] **Step 2: Run the complete test suite and production build**

```powershell
pnpm test:run
pnpm build
```

Expected: all Vitest tests pass; Astro reports zero errors; the initial HTML and SEO artifact guards pass; the build still renders 101 unique directory rows.

- [ ] **Step 3: Inspect generated changes before restoring anything**

```powershell
git status --short --untracked-files=all
git diff -- public/generated
```

Expected: `public/generated/universities.json` reflects the current tracked `status.json`; no fact rows, institution identities, list membership, or rankings change. If the build causes Windows-only line-ending or timestamp drift in other generated files, verify that the diff is mechanical before restoring only those known build outputs.

- [ ] **Step 4: Prove protected application facts are unchanged**

```powershell
git diff 5c88fdb..HEAD -- src/data/institutions.json src/data/generated/requirements.json src/data/generated/reverse-index.json src/data/rankings.json src/data/universities.json
git diff --check
```

Expected: the protected-data diff is empty and the whitespace check passes. `src/data/status.json` also remains unchanged locally because tests use temporary data; only the deployed daily workflow will advance dates.

- [ ] **Step 5: Review workflow permissions and mutation scope manually**

Confirm from the final YAML that:

- daily check stages only `src/data/status.json`;
- changed content creates a review Issue and never calls `sync:sources`;
- CI and daily rebuild public output before tests;
- the weekly ranking monitor has no contents write, push, Pages, or ranking-data mutation path.

- [ ] **Step 6: Review the completed commit list**

Run:

```powershell
git log --oneline 5c88fdb..HEAD
git status --short --untracked-files=all
```

Expected: the commit list contains only the six scoped implementation units and the documentation commits; the worktree is clean after verified mechanical build outputs are removed.

- [ ] **Step 7: Stop before publishing**

Report final test counts, build result, protected-data diff, workflow permissions, and commit list. Do not push, open a PR, merge, or deploy until the user explicitly authorizes publication.
