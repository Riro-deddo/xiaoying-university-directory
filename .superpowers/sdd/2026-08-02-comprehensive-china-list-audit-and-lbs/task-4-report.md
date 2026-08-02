# Task 4 report — grouped and bilingual HTML extraction

## Changed files

- `scripts/extractors/html.mjs`
- `src/lib/types.ts`
- `src/data/sources.schema.json`
- `tests/extract-html.test.mjs`
- `tests/data.test.ts`
- `tests/fixtures/sources/html-grouped-lists.html`
- `tests/fixtures/sources/html-bilingual-table.html`

## Red-green evidence

- **Red:** the new fixture and schema tests failed before implementation: 9 failures across two files. The failures showed missing `html-grouped-items` support, unimplemented registered parser fields, unhandled `<br>` boundaries, missing bilingual fields, and absent parser-structure errors.
- **Green:** `tests/extract-html.test.mjs` and `tests/data.test.ts` passed after the registered-selector implementation and schema/type additions: 2 files, 33 tests.

## Verification

- Focused: `tests/extract-html.test.mjs` and `tests/data.test.ts` — 2 files, 33 tests passed.
- Full: `pnpm test:run` — 19 files, 197 tests passed.
- Astro: `astro check` — 0 errors, 0 warnings, 0 hints.

## Commit

`7755488f8fb53c6e6b614b81465cb5fa4a148357` (`feat: extract grouped official institution lists`)

## Concerns

No production source registry entries or generated facts were changed. This task adds generic registered extraction only; PDF extraction, institution reconciliation, source registration/sync, and UI work remain for later tasks.

## Fix Round 1 — configured table-column bounds

- **Review finding:** a missing configured `institutionColumn`, `institutionColumns` member, `tierColumn`, or singular `scoreColumn` could be silently omitted during table extraction.
- **Red:** four new literal cases failed before the fix because each resolved instead of raising `PARSER_STRUCTURE`.
- **Fix:** validate every explicitly configured table column before extracting a row. Nested matched rows are excluded when an enclosing matched row owns them, preserving the existing nested-table column regression coverage.
- **Green:** focused extractor/data run — 2 files, 37 tests passed; full suite — 19 files, 201 tests passed; Astro check — 0 errors, 0 warnings, 0 hints.
- **Generated data:** verification regenerated timestamp-only reverse-index data; it was restored and excluded from this change.

## Fix Round 2 — indexed nested-table rows

- **Review finding:** `tableIndex` selected all descendant rows, including rows from nested tables, while the non-indexed path discarded nested matched rows.
- **Red:** the indexed nested-table regression raised `PARSER_STRUCTURE` on the nested row before the fix.
- **Fix:** apply one shared outermost-row filter to both indexed and non-indexed table selection.
- **Green:** focused extractor/data run — 2 files, 38 tests passed; full suite — 19 files, 202 tests passed; Astro check — 0 errors, 0 warnings, 0 hints.
- **Generated data:** the timestamp-only reverse-index update was restored and excluded.
