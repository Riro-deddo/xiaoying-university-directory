# Task 3 report — corrected reviewed China institution rules

## Changed files

- `src/data/sources.json`
- `src/data/universities.json`
- `src/data/status.json`
- `tests/catalog.test.ts`
- `tests/page-content.test.mjs`

## TDD evidence

- Red: `vitest run tests/catalog.test.ts tests/page-content.test.mjs` produced 8 expected semantic failures: missing public-list states, no reviewed verification metadata, absent Manchester central and Computer Science sources, and the stale Exeter summary.
- Green: the same focused suite passed with 34 tests after the minimum semantic/data changes.

## Verification

- Focused semantic + coverage: 54 tests passed across 3 files.
- Full suite: 186 tests passed across 19 files.
- `pnpm check:sources`: completed successfully and checked 31 official sources.
- Astro check: 0 errors, 0 warnings, 0 hints across 41 files (with telemetry disabled because the sandbox disallows Astro's user-profile configuration directory).
- `git diff --check`: passed.

## Result

- The catalog now contains the binding 9 `official-list`, 16 `china-requirements`, and 4 `not-public` university states; no university is `faculty-only`.
- All 31 registered sources now have a dated manual verification record and exact scope. The seven newly registered public lists remain `link-only`; existing UCL and Edinburgh structured sources remain unchanged.
- Manchester has separate central, Computer Science, and Law link-only sources, all with `institutionRule.type: "none"`; none claims a public roster.
- Exeter records the current 2026 uniform 75%/70% rule and cancellation of the domestic-ranking condition. Leeds' historical faculty PDFs are not current sources.
- The LBS MiM source and its 2026-08-02 review date were preserved.

## Concerns

The live source check recorded 25 `ok` responses, five `unavailable` 403 responses (Oxford, Durham, QMUL, QUB, Cardiff), and one temporary Bristol server error. These are external-server health results; all local schema and semantic checks passed. The derived reverse-index timestamp refresh was deliberately regenerated back to the baseline and is not included in this task's diff.

## Commit

`0f75e0ddb515246566ab70950309fbe3318d3153` — `fix: correct reviewed China institution rules`

## Fix round 1 — KCL evidence correction

- Red: the new KCL regression failed because `kcl-china` used the generic postgraduate application guide and only verified `postgraduate` / `application`.
- Green: `kcl-china` now uses KCL's China-specific international requirements page, verifies the China, prestigious-university, other-recognised-university, and Project 211/Double First Class text, and remains `none` because KCL does not publish a complete KCL-owned university roster.
- Focused suite: 55 tests passed across 3 files. Full suite: 187 tests passed across 19 files. `pnpm check:sources` checked 31 sources. Astro check reported 0 errors, 0 warnings, and 0 hints.
- The live KCL source check completed successfully. The generated reverse-index timestamp refresh was regenerated back to the baseline and remains out of the fix-round commit.
