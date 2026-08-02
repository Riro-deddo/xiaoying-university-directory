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
