# Task 6 report: complete masters course coverage and public join

Date: 2026-08-11
Base: `076c662937418d899452520f4d582d6d6742d8b3`

## Outcome

- Added `UniversityDirectoryRecord = UniversityWithStatus & { mastersCourse: MastersCourseDirectoryWithStatus }` while preserving structural compatibility for existing `UniversityWithStatus` consumers.
- Added a strict, non-mutating `joinMastersCourseDirectories()` that rejects missing, extra, and duplicate `universityId` mappings and joins status only from `statuses[directory.id]`.
- Extended `loadUniversities()` after the existing source-status and ranking joins so all 101 university rows contain exactly one matching masters course entry.
- Extended the public builder and its CLI input to embed `mastersCourse` in `public/generated/universities.json`; no standalone course-entry or ranking dataset is emitted.
- Kept `masters-*` records separate from existing China-rule `sources` and their status/statistics semantics.

## TDD evidence

The requested `pnpm exec vitest` launcher could not resolve the installed local Vitest binary in this Windows environment (`'vitest' is not recognized`). The same checked-in local executable was run directly after adding the bundled Node runtime to `PATH`.

- Baseline: 38 files / 695 tests passed at the specified Base.
- RED: focused Task 6 tests failed 7 checks and passed 144. The failures were the missing runtime join export, absent `loadUniversities().mastersCourse`, absent builder join, and stale public generated rows.
- Intermediate GREEN: after the minimal implementation, 150 / 151 focused tests passed; the sole remaining failure was the intentionally not-yet-regenerated `public/generated/universities.json`.
- GREEN after `build:public`: 3 files / 151 focused tests passed.
- Review-fix mutation RED: after temporarily removing the public builder's strict mapping checks, all 3 new builder rejection tests failed for the expected missing/extra/duplicate regressions; the strict implementation was then restored.
- Final focused GREEN: 3 files / 154 tests passed.
- Fresh full suite: 38 files / 710 tests passed.
- TypeScript: `node_modules/.bin/tsc.CMD --noEmit` exited 0.
- Production build: `pnpm build` exited 0; Astro reported 0 errors, the static build completed, and the initial-HTML and SEO guards passed. The pre-existing `scripts/sync-sources.mjs` async-conversion hint remained informational.

## Coverage and join audit

- Production masters registry: 101 records and 101 unique `universityId` values, exactly equal to the validated 101-university ID set.
- Runtime loader: 101 university records; every `mastersCourse.universityId` equals its enclosing university ID.
- Representative entries are pinned for Imperial, Oxford, Manchester, Greenwich, and the Royal College of Art.
- Unit tests reject missing, extra, and duplicate directory `universityId` inputs and verify that neither join input is mutated.
- A distinct China-source status and masters-course status fixture proves the course entry reads only `statuses[directory.id]` while the existing `sources` array retains its own status.
- Public tests deep-compare every generated `mastersCourse`, and separately preserve each university's original source count, source ID order, source objects, and source statuses.
- Public builder tests independently reject missing, extra, and duplicate directory mappings, protecting its separate JavaScript join implementation.

## Review

- Independent read-only review found no Critical issues and one Important test gap: the public builder's own missing/extra/duplicate branches lacked direct tests.
- The gap was fixed with three parameterized builder tests and verified with a mutation RED as described above.
- No unresolved Critical, Important, or Minor findings remain.

## Generated-data and scope audit

- `public/generated/universities.json` contains 101 masters entries, 101 unique masters IDs, and 101 matching university IDs.
- Removing `mastersCourse` from each new public row produces a deep-equal serialization of the Base public university rows; existing `sources` are also row-by-row deep-equal.
- No `public/generated/masters-course-directories.json` or standalone ranking dataset was created.
- `build:public` and `pnpm build` mechanical changes to institutions, lists, and reverse-index outputs were restored. Only `public/generated/universities.json` remains changed under `public/generated`.
- `src/data/universities.json`, institutions, requirements, rankings, sources, status facts, and UI files are unchanged from Base.
- `git diff --check` passed.

## Files

- `src/lib/types.ts`
- `src/lib/data.ts`
- `scripts/build-public-data.mjs`
- `public/generated/universities.json`
- `tests/masters-course-directories.test.ts`
- `tests/data.test.ts`
- `tests/public-data.test.mjs`
- `.superpowers/sdd/2026-08-11-official-masters-course-entry/task-6-report.md`
