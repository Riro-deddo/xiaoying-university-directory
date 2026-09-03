# Repository Hardening Round 1 Specification

## Objective

Strengthen repository governance, dependency maintenance, GitHub Actions safety, and rendered-page regression coverage without changing the university directory UI, published content, or daily source-review behavior.

## In scope

- Add weekly, grouped Dependabot version updates for pnpm and GitHub Actions without automatic merging.
- Add a dedicated workflow-quality check using actionlint and zizmor with immutable versions.
- Add Playwright Test coverage for the existing desktop and mobile layouts, core UK-university search, Chinese-institution search, and automated accessibility checks.
- Upload Playwright diagnostics only as private workflow artifacts when a CI run fails.
- Enable GitHub-native dependency alerts/security updates, CodeQL default setup, secret scanning, push protection, and repository-wide full-SHA enforcement where the account supports them.
- Add a minimal repository ruleset that blocks branch deletion and non-fast-forward pushes while preserving the daily workflow's normal `status.json` push.

## Out of scope

- No redesign, copy change, ranking change, data update, or source-parser change.
- No daily-check matrix sharding in this round.
- No requirement that all changes arrive through pull requests until the daily status writer has an explicit safe bypass or a pull-request-based write path.
- No automatic Dependabot merge.
- No public Lighthouse, Playwright, or coverage uploads.
- No license choice on the user's behalf.

## Acceptance criteria

- Existing Vitest and Astro build checks remain green.
- A desktop Chromium project and a mobile WebKit project exercise the production build.
- The tests catch horizontal overflow and narrow-column text collapse on a representative long-name university row.
- The tests exercise both search modes against real generated data.
- axe reports no automatically detectable serious or critical accessibility violations in the tested page states.
- Every third-party GitHub Action is pinned to a full commit SHA, and actionlint/zizmor accept the workflows at the agreed threshold.
- The daily workflow remains functionally unchanged and can still make a normal fast-forward push to `main`.
