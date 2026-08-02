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

`pending`

## Concerns

No production source registry entries or generated facts were changed. This task adds generic registered extraction only; PDF extraction, institution reconciliation, source registration/sync, and UI work remain for later tasks.
