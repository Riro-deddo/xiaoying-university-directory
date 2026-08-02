# Task 7 report — dual-direction search interface

## RED / GREEN evidence

- RED: added tests for institution exact Chinese/English/alias lookup, fuzzy chooser behaviour, QS ordering and source-state precedence, evidence copy, and page contracts. The first focused run failed because `createInstitutionEvidenceSearch`, `evidenceStateCopy`, and dual-search page markup were absent.
- GREEN: `pnpm test:run -- tests/search.test.ts tests/presentation.test.ts tests/page-content.test.mjs` passed with 16 test files and 124 tests.

## Commands and results

- `pnpm test:run` — passed: 16 files, 124 tests.
- `pnpm build` — passed: Astro check reported 0 errors, 0 warnings, and generated both static pages.
- `git diff --check` — passed with no whitespace errors.

## UI self-check

- Added two visible `aria-pressed` mode tabs and updates label, placeholder, help text, result count, and result template on switching.
- UK search and state filters remain in their original directory presentation.
- Chinese exact selection produces QS-sorted evidence cards for every available UK university; fuzzy results require an explicit canonical chooser selection.
- Evidence cards include neutral distinct state descriptions, scope, official tier/score/cycle when present, last successful check copy, and an official source or university website link.
- Keyboard focus rules cover tabs, search, chooser buttons, and evidence links. Cards stack fields below 760px and the page keeps its 320px minimum viewport guard.

## Concerns

- Browser visual and interaction QA remains with the controller, as assigned. The source status dataset currently has no persisted health checks, so source freshness fields fall back to the data supplied by Task 6 when available.
