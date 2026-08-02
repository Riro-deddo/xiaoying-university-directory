# Task 5 report — PDF extraction and guarded bilingual institution registration

## Commit

`c6dbd97 feat: reconcile bilingual official institutions`

## Changed files

- `scripts/extractors/pdf.mjs`
- `scripts/extractors/normalize.mjs`
- `scripts/sync-sources.mjs`
- `src/data/requirements.schema.json`
- `tests/extract-pdf.test.mjs`
- `tests/sync-sources.test.mjs`
- `tests/requirements.test.ts`

## Red-green evidence

- Red: the focused suite initially reported 6 expected failures: missing bilingual PDF row capture, missing persisted Chinese spelling support, absent reconciliation/export behavior, and missing guarded registration/order handling.
- Green: focused suite passed with 3 files and 40 tests.

## Verification

- Full suite: 19 files, 208 tests passed.
- Astro check: 41 files checked; 0 errors, 0 warnings, 0 hints.
- `git diff --check` passed before the feature commit.

## Result

PDF rows now support Chinese-name and labelled multi-score captures. Reconciliation matches normalized Chinese names, then English names, then aliases; bilingual unknowns receive deterministic `cn-<16 lowercase hex>` IDs. Provider sources (Sheffield, Glasgow, Nottingham, Southampton) run before English-only sources. Institution additions remain candidates until all source guards and requirement-schema validation accept the update; English-only unknown rows produce a retained-trusted-data anomaly.

## Concerns

- No live source configuration or fetching was added, per Task 5 scope; that remains Task 6.
- Generated `reverse-index.json` timestamp-only churn was restored and excluded from the feature commit.

## Fix round 1

Commit: `e317cef fix: harden bilingual institution transaction`

- Added coupled persistence that stages both files, promotes the institution registry first, and restores that registry if requirements promotion fails. The injected-failure regression verifies both trusted files and candidate files remain unchanged after rollback.
- Reconciliation now checks aliases against both the English and Chinese raw source names after exact-name matching.
- Candidate registries now require institution-schema validity, globally unique IDs/raw names, and requirement-to-institution referential integrity before acceptance.
- Added `institutionNameZh?: string` to `RequirementFact`.
- Red evidence: 4 new regression failures before the fix (Chinese alias matching, two invalid registry candidates, and coupled-promotion rollback).
- Green verification: focused 3 files / 44 tests; full 19 files / 212 tests; Astro check 41 files with 0 errors, 0 warnings, 0 hints.
- Restored and excluded generated `reverse-index.json` timestamp-only churn again.
