# GitHub Actions Node.js 24 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade every GitHub-authored Action in the three project workflows to its approved Node.js 24-compatible release without changing project runtime, data, triggers, permissions, or deployment safety.

**Architecture:** Add one workflow regression test that inventories every `actions/*` use and requires the approved full SHA, version comment, and occurrence count. Then replace only the Action pins in the three workflow YAML files. Publish from the current remote `main`, require PR CI without Node.js 20 annotations, and validate the real `repository_dispatch` CI-to-Pages chain after merge.

**Tech Stack:** GitHub Actions YAML, Vitest, Astro, pnpm, GitHub CLI, GitHub Contents/Pull Request APIs

## Global Constraints

- Keep project `node-version: 22` unchanged.
- Pin every Action to a full 40-character commit SHA; do not use moving major tags.
- Upgrade `actions/checkout` to v7.0.1 at `3d3c42e5aac5ba805825da76410c181273ba90b1`.
- Upgrade `actions/setup-node` to v7.0.0 at `820762786026740c76f36085b0efc47a31fe5020`.
- Upgrade `actions/github-script` to v9.0.0 at `3a2844b7e9c422d3c10d287c895573f7108da1b3`.
- Upgrade `actions/configure-pages` to v6.0.0 at `45bfe0192ca1faeb007ade9deae92b16b8254a0d`.
- Upgrade `actions/upload-pages-artifact` to v5.0.0 at `fc324d3547104276b827a68afc52ff2a11cc49c9`.
- Upgrade `actions/deploy-pages` to v5.0.0 at `cd2ce8fcbc39b97be8ca5fce6e763baed58fa128`.
- Keep `lycheeverse/lychee-action`, schedules, events, permissions, job conditions, step order, inputs, data files, lockfile, and application code unchanged.

---

### Task 1: Add exact Action-pin regression coverage

**Files:**
- Modify: `tests/workflows.test.mjs`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: UTF-8 text from `.github/workflows/ci.yml`, `.github/workflows/daily-check.yml`, and `.github/workflows/deploy.yml`.
- Produces: A Vitest assertion that all ten `actions/*` occurrences use the six approved SHA/version pairs and that project Node.js remains 22.

- [ ] **Step 1: Add the failing pin-inventory test**

Add this block before `describe('guarded daily source workflow', ...)`:

```js
const officialWorkflowText = [ciWorkflow, dailyWorkflow, deployWorkflow].join('\n');

const approvedOfficialActionPins = [
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1', 'v7.0.1', 3],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020', 'v7.0.0', 3],
  ['actions/github-script', '3a2844b7e9c422d3c10d287c895573f7108da1b3', 'v9.0.0', 1],
  ['actions/configure-pages', '45bfe0192ca1faeb007ade9deae92b16b8254a0d', 'v6.0.0', 1],
  ['actions/upload-pages-artifact', 'fc324d3547104276b827a68afc52ff2a11cc49c9', 'v5.0.0', 1],
  ['actions/deploy-pages', 'cd2ce8fcbc39b97be8ca5fce6e763baed58fa128', 'v5.0.0', 1],
];

describe('official GitHub Action pins', () => {
  it('uses only the approved Node 24-compatible official releases', () => {
    const officialUses = [...officialWorkflowText.matchAll(/uses:\s+(actions\/[^@\s]+)@([0-9a-f]{40})\s+#\s+(\S+)/g)];

    expect(officialUses).toHaveLength(10);
    for (const [name, sha, version, count] of approvedOfficialActionPins) {
      const matches = officialUses.filter((match) => match[1] === name && match[2] === sha && match[3] === version);
      expect(matches, `${name}@${sha} # ${version}`).toHaveLength(count);
    }
    expect(officialWorkflowText.match(/node-version:\s*22/g)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the targeted test and verify the old pins fail**

Run:

```powershell
pnpm exec vitest run tests/workflows.test.mjs
```

Expected: FAIL in `official GitHub Action pins > uses only the approved Node 24-compatible official releases` because the workflows still contain the previous SHAs.

- [ ] **Step 3: Commit the failing regression test**

```powershell
git add tests/workflows.test.mjs
git commit -m "test: require Node 24 GitHub Action pins"
```

---

### Task 2: Upgrade all official Action pins

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/daily-check.yml`
- Modify: `.github/workflows/deploy.yml`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: The six approved Action SHA/version pairs from Task 1.
- Produces: Three workflow files containing ten approved `actions/*` uses while preserving every non-Action line.

- [ ] **Step 1: Replace the CI Action pins**

In `.github/workflows/ci.yml`, make only these substitutions:

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
```

- [ ] **Step 2: Replace the daily workflow Action pins**

In `.github/workflows/daily-check.yml`, replace checkout and setup-node with:

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
```

Keep the anomaly-Issue step's name, inputs, and script unchanged and replace only its nested `uses` line:

```yaml
uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
```

- [ ] **Step 3: Replace the Pages workflow Action pins**

In `.github/workflows/deploy.yml`, replace the direct uses with:

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
- uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6.0.0
- uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
```

Keep `id: deployment` and replace its nested line with:

```yaml
uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5.0.0
```

- [ ] **Step 4: Run the targeted test and verify it passes**

Run `pnpm exec vitest run tests/workflows.test.mjs`.

Expected: PASS with 10 tests in `tests/workflows.test.mjs`.

- [ ] **Step 5: Verify the full local suite and static build**

Run:

```powershell
pnpm test:run
pnpm build
```

Expected: all tests pass; Astro reports 0 errors, 0 warnings, and 0 hints; the static build completes.

- [ ] **Step 6: Review the diff and commit the workflow upgrade**

Run:

```powershell
git diff --check
git diff -- .github/workflows/ci.yml .github/workflows/daily-check.yml .github/workflows/deploy.yml tests/workflows.test.mjs
git add .github/workflows/ci.yml .github/workflows/daily-check.yml .github/workflows/deploy.yml
git commit -m "chore: upgrade GitHub Actions to Node 24"
```

Expected: only the ten official Action pins and version comments differ in the workflow files; the test remains in its separate commit.

---

### Task 3: Publish the current remote diff through a PR

**Files:**
- Remote modify: `.github/workflows/ci.yml`
- Remote modify: `.github/workflows/daily-check.yml`
- Remote modify: `.github/workflows/deploy.yml`
- Remote modify: `tests/workflows.test.mjs`
- Remote create: `docs/superpowers/specs/2026-08-03-github-actions-node24-upgrade-design.md`
- Remote create: `docs/superpowers/plans/2026-08-03-github-actions-node24-upgrade.md`

**Interfaces:**
- Consumes: The current remote `main` SHA and the verified contents from Tasks 1 and 2.
- Produces: A ready PR based on unchanged remote `main`, limited to the workflows, regression test, design, and plan.

- [ ] **Step 1: Confirm GitHub authentication and the remote base**

Run `gh auth status` and `gh api repos/Riro-deddo/xiaoying-university-directory/git/ref/heads/main --jq .object.sha`.

Expected: authenticated as `Riro-deddo` with `repo` and `workflow` scopes; record the returned SHA.

- [ ] **Step 2: Create a remote branch from the exact current `main`**

Create `agent/upgrade-github-actions-node24` through the GitHub branch API with `main` as `base_ref`. If it exists, inspect it and use a fresh suffix rather than moving an unknown branch.

- [ ] **Step 3: Publish only the six approved files**

Fetch each existing target file on the branch to obtain its blob SHA, then replace it with the verified complete content. Create the design and plan files from their complete local content. Do not modify data or application files.

- [ ] **Step 4: Verify the remote branch diff before opening the PR**

Compare `main...agent/upgrade-github-actions-node24` and require exactly these paths:

```text
.github/workflows/ci.yml
.github/workflows/daily-check.yml
.github/workflows/deploy.yml
tests/workflows.test.mjs
docs/superpowers/specs/2026-08-03-github-actions-node24-upgrade-design.md
docs/superpowers/plans/2026-08-03-github-actions-node24-upgrade.md
```

Fetch the workflows from the branch and confirm all ten official uses match the approved inventory.

- [ ] **Step 5: Open the PR and wait for CI**

Create a draft PR titled `Upgrade GitHub Actions to Node.js 24`, summarize preserved behavior, mark it ready, then resolve and watch it:

```powershell
$prNumber = gh pr view --repo Riro-deddo/xiaoying-university-directory --head agent/upgrade-github-actions-node24 --json number --jq .number
gh pr checks $prNumber --repo Riro-deddo/xiaoying-university-directory --watch --interval 10
```

Expected: every GitHub Actions check passes.

- [ ] **Step 6: Inspect CI annotations and logs for the original warning**

Resolve the PR's CI run ID, then inspect it:

```powershell
$ciRunId = gh run list --repo Riro-deddo/xiaoying-university-directory --workflow ci.yml --branch agent/upgrade-github-actions-node24 --limit 1 --json databaseId --jq '.[0].databaseId'
gh run view $ciRunId --repo Riro-deddo/xiaoying-university-directory --log
gh run view $ciRunId --repo Riro-deddo/xiaoying-university-directory --json jobs
```

Search the returned log and annotations for `Node.js 20`, `deprecated`, and `forced to run on Node.js 24`.

Expected: none of those Node.js 20 runtime warnings appears. Report unrelated warnings separately.

---

### Task 4: Merge and validate the production automation chain

**Files:**
- No additional file changes.

**Interfaces:**
- Consumes: A mergeable PR with successful CI and no Node.js 20 Action-runtime warning.
- Produces: A merged `main` verified by repository-dispatch CI, automatic Pages deployment, and a browser-loaded production page.

- [ ] **Step 1: Merge the PR with the verified head SHA**

Squash-merge only if the PR head SHA still matches the checked revision. Record the new `main` SHA and verify PR state `MERGED`.

- [ ] **Step 2: Trigger the same CI event used by the daily updater**

Run:

```powershell
$mergedMainSha = gh api repos/Riro-deddo/xiaoying-university-directory/git/ref/heads/main --jq .object.sha
gh api --method POST repos/Riro-deddo/xiaoying-university-directory/dispatches -f event_type=guarded-source-update -f "client_payload[sha]=$mergedMainSha"
```

Expected: a new `CI` run with event `repository_dispatch`, title `guarded-source-update`, and head SHA equal to `$mergedMainSha`.

- [ ] **Step 3: Wait for repository-dispatch CI and inspect warnings**

Resolve and watch the newest matching run:

```powershell
$ciRunId = gh run list --repo Riro-deddo/xiaoying-university-directory --workflow ci.yml --event repository_dispatch --limit 1 --json databaseId,headSha --jq '.[0].databaseId'
gh run watch $ciRunId --repo Riro-deddo/xiaoying-university-directory --exit-status --interval 10
```

Expected: `verify` succeeds and its annotations/logs contain no Node.js 20 Action-runtime warning.

- [ ] **Step 4: Confirm automatic Pages creation and completion**

List `deploy.yml` runs after CI completion, select the newest `workflow_run` whose head SHA equals `$mergedMainSha`, and watch it:

```powershell
$pagesRunId = gh run list --repo Riro-deddo/xiaoying-university-directory --workflow deploy.yml --limit 10 --json databaseId,headSha,event,createdAt --jq ".[] | select(.headSha == \"$mergedMainSha\" and .event == \"workflow_run\") | .databaseId" | Select-Object -First 1
gh run watch $pagesRunId --repo Riro-deddo/xiaoying-university-directory --exit-status --interval 10
```

Expected: Pages `deploy` succeeds and its annotations/logs contain no Node.js 20 Action-runtime warning.

- [ ] **Step 5: Verify the production page in the browser**

Derive the cache-busting URL and open it:

```powershell
$mergedMainShortSha = $mergedMainSha.Substring(0, 7)
$productionUrl = "https://riro-deddo.github.io/xiaoying-university-directory/?v=$mergedMainShortSha"
```

Expected: title `小英高校百科｜英国大学中国院校规则导航`, heading `英国大学中国院校规则，一页查清`, and ready state `complete`.

- [ ] **Step 6: Report final evidence**

Provide links to the merged PR, repository-dispatch CI run, automatic Pages run, and production page. State the exact warning search result and any unrelated residual warning.
