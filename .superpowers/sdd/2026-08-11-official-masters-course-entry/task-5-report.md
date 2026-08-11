# Task 5 report: official masters course entry batch 4

Date: 2026-08-11
Base: `645bfafae179e0320b8431ab17a09c4421bdbba7`

## Outcome

- Added 25 reviewed official HTTPS masters/postgraduate course entries in the fixed Batch 4 university order.
- Added a 25-row research ledger with official URL, final URL, exact page title, at least two page-identity anchors, review date, and decision note.
- Added an exact Batch 4 contract test covering every URL, page title, required-text set, reviewed date, production/research/test parity, and deep equality of the previous 76 records.
- The production registry now contains 101 records, 101 unique record IDs, and 101 unique university IDs.

## Evidence decisions

- University of Lancashire: direct requests to the canonical site were blocked with HTTP 403. The directly opened official legacy route `https://www.uclan.ac.uk/courses/a-z` issued an official redirect to `https://www.lancashire.ac.uk/courses/a-z` and rendered the canonical combined A-Z page. The page exposes both `Postgraduate taught A-Z` and `Postgraduate research A-Z`; no canonical-domain conflict was found.
- Robert Gordon University: browser DOM verification confirmed `https://www.rgu.ac.uk/study/course-search` as the unified official course search. The same selector exposes `Postgraduate` and `Graduate School` filters and links the full A-Z list; all three identity anchors are pinned.
- Canterbury Christ Church University: browser DOM verification confirmed `https://www.canterbury.ac.uk/study-here/explore-postgraduate` as the combined postgraduate gateway. It connects the complete postgraduate course search with `Research subject areas` and explicitly describes postgraduate research degrees; three identity anchors are pinned.
- No third-party aggregator, cached page, PDF, search-result snippet, homepage, or individual course page was admitted to production.

## TDD evidence

The requested `pnpm exec vitest` launcher could not resolve the already-installed local Vitest binary in this Windows environment (`'vitest' is not recognized`). The same checked-in local executable was run directly after adding the bundled Node runtime to `PATH`.

- RED: `node_modules/.bin/vitest.CMD run tests/masters-course-directory-batch-4.test.ts` failed with 27 expected missing-production failures and 1 passing test. The first failure was the fixed Batch 4 presence contract (`expected false to be true`); all 25 exact-record checks received `undefined`; the previous-76 deep-freeze test passed.
- GREEN: the same focused Batch 4 command passed 1 file / 28 tests after appending only the 25 reviewed production records.
- Review round 1 RED: after changing only the RGU and CCCU exact expectations, the focused test failed exactly 3 checks: the two stale production records and research parity. The other 25 tests passed, covering the previous 76 and the other 23 Batch 4 records.
- Review round 1 GREEN: after synchronising research and production, the focused Batch 4 test passed 1 file / 28 tests.
- Fresh focused run: Batch 4, masters-course-directory validation, and data validation passed 3 files / 159 tests.
- Fresh full run: 38 files / 695 tests passed.
- TypeScript: `node_modules/.bin/tsc.CMD --noEmit` exited 0.

## Freeze and parity audit

- Node UTF-8 JSON comparison against Base confirmed `first76DeepEqual: true`.
- Registry audit confirmed 101 records, 101 unique `id` values, and 101 unique `universityId` values.
- Research table contains exactly 25 rows in the brief's fixed order.
- Batch 4 tests confirm exact research-test-production parity.
- Review-round comparison confirmed only `robert-gordon-university` and `canterbury-christ-church-university` changed; the other 99 production records are deeply equal to the preceding commit.
- `src/data/universities.json`, `src/data/sources.json`, and `src/data/rankings.json` are unchanged from Base.
- `git diff --check` passed.

## Files

- `src/data/masters-course-directories.json`
- `docs/research/masters-course-directory-batch-4.md`
- `tests/masters-course-directory-batch-4.test.ts`
- `.superpowers/sdd/2026-08-11-official-masters-course-entry/task-5-report.md`
