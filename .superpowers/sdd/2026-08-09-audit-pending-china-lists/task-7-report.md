# Task 7 report — global integrity and generated outputs

## Outcome

The public directory is now mechanically joined to the audited catalog. It
contains 101 unique rows: 93 QS-directory and 8 specialist records. Its states
are 72 `china-requirements`, 10 `official-list`, 8 `not-public`, and 11
`pending`; the audit has 90 reviewed, 11 blocked, and 0 unreviewed rows. The
fixed feature-start cohort remains exactly 65 rows (54 reviewed / 11 blocked).

## TDD and regeneration evidence

- Pre-regeneration final integrity suite was GREEN: 5 files / 110 tests.
- A direct current-catalog/public join then identified 58 stale public rows:
  public state counts were 19 `china-requirements`, 9 `official-list`, 8
  `not-public`, and 65 `pending`.
- RED: added a full 101-row public join contract plus representative-row
  contracts for Loughborough, Kent, UAL, CCCU, and London Met. The focused run
  failed as intended: public Loughborough was `pending` while the audited
  catalog was `official-list` (and its current note/source metadata was absent).
- Regeneration used only `pnpm build:index` and `pnpm build`. The repository
  builders reported 5,754 reverse-index rows, 9 public list files, and 2,914
  institutions.
- The first build RED exposed two existing test-only `node:crypto` imports
  without a declared or installed `@types/node`: Astro check reported two
  `ts(2591)` errors. `package.json` has no `@types/node`, the lockfile contains
  only optional peer declarations, `pnpm why @types/node` was empty, and
  `node_modules/@types/node` was absent. No dependency, lockfile, tsconfig, or
  type shim was changed. The two tests now use the browser-compatible global
  Web Crypto SHA-256 API and remain async, preserving the exact fixture digest
  semantics.
- GREEN focused: 5 files / 112 tests. Final full run: 28 files / 508 tests.

## Generated diff classification

Kept `public/generated/universities.json` only. It updates 57 rows with current
catalog state, note, source, status, and ranking joins:

- 1 `pending` → `official-list` (Loughborough).
- 53 `pending` → `china-requirements` rows.
- 3 `pending` → `pending` rows whose reviewed/blocked notes changed (Aberdeen,
  UEA, and UAL).

Restored all non-causal generated drift after each build:

- `public/generated/institutions.json` and all nine `public/generated/lists/*`
  files: line-ending-only drift.
- `public/generated/reverse-index.json`: only stale legacy
  `lastSuccessfulAt` timestamps were rewritten to `2026-08-08`.
- `src/data/institutions.json`, `src/data/generated/requirements.json`, and
  `src/data/generated/reverse-index.json`: no generated diff to retain.

## Protected facts

All protected files match feature base `5974b86` exactly (current/base blob ID):

- `src/data/institutions.json`: `38c17f53cfd2fc82759e37f436ad028825b1d23a`
- `src/data/generated/requirements.json`: `19a3544d4cc20533fd1ca647b4850cff8877bb69`
- `src/data/generated/reverse-index.json`: `a84cc7f0c15b62085247d76ccdf40263ad6ce799`
- `public/generated/institutions.json`: `38c17f53cfd2fc82759e37f436ad028825b1d23a`
- `public/generated/reverse-index.json`: `4e742e23da2c26417b566c2c6ed6e44538d37e74`

The existing audited baseline assertions also confirm the feature-start
institutions digest, reviewed-university/source objects, and 5,754 protected
requirement facts.

## Final verification and self-review

- `node scripts/report-source-coverage.mjs` exited 0: 93 QS, 8 specialist,
  10 full public lists, 72 rule-only, 8 no-public-list, 9 parser-enabled, and
  84 link-only sources.
- Final-review coverage hardening requires explicit current ranking metadata,
  validates audit lifecycle against catalog state in both directions, and uses
  exact de-duplicated mutation failures. RED exposed the 28-item fallback and
  three lifecycle contradictions; GREEN focused was 2 files / 66 tests and the
  final full run was 28 files / 512 tests. The CLI continues to print the
  legacy discovery cohort (`28`) separately from current QS coverage (`93`).
- `pnpm build` exited 0. Astro reported 0 errors and 0 warnings (one existing
  `sync-sources.mjs` async-conversion hint); the initial HTML guard passed with
  9 list panels and 101 unique QS-sorted rows.
- `git diff --check` passed.
- Self-review confirms no hand-authored catalog/audit/source/status facts,
  rankings, UI, institutions, requirements, public list files, or reverse-index
  facts were changed. The public regression test covers every catalog row and
  the five representative reviewed/blocked cases.

## Concern

No data-integrity concern remains. The unchanged `sync-sources.mjs` hint is
outside this task's scope.
