# Task 5 report

## Research method and source verification

Processed the frozen 28-member QS cohort in rank order. Used current official university domains returned by web searches for China/international postgraduate entry requirements, including the linked official China pages for UCL, Edinburgh, Birmingham, Sheffield, Southampton, Queen Mary, Bath, Exeter, Liverpool, York, Lancaster, Queen's Belfast, Cardiff and Reading. Sources are recorded as URLs in `src/data/sources.json`; no third-party, agency, cached or ranking sources were used as data sources.

Where the publicly exposed content was a country/qualification guidance page without a safely configured stable list parser, recorded a traceable `link-only` source and a `not-public` state. Manchester is explicitly scoped to the Faculty of Humanities Law source. UCL, Edinburgh, Birmingham, Sheffield and Southampton publicly expose a university-level list or tier structure, but their registry entries remain `link-only`: no names or eligibility facts were inferred or extracted. `institutions.json` is deliberately unchanged and no requirements facts were created.

## RED / GREEN evidence

RED 1: after adding catalog coverage tests, `node node_modules/vitest/vitest.mjs run tests/catalog.test.ts` failed as expected: cohort equality showed only 3 existing records versus 28, and a record had zero sources.

RED 2: after adding the source-report test, `node node_modules/vitest/vitest.mjs run tests/source-coverage.test.mjs` failed as expected because `scripts/report-source-coverage.mjs` did not yet exist. A follow-up CLI-exit test then failed as expected with status 0 before data-root support was added.

GREEN: `node node_modules/vitest/vitest.mjs run tests/catalog.test.ts tests/source-coverage.test.mjs tests/data.test.ts` passed: 3 files, 27 tests. The prescribed `pnpm vitest` form does not resolve the workspace binary in this environment even with the runtime Node directory prepended to `PATH`; direct invocation uses the same locked Vitest package.

## Verification and self-check

- `node node_modules/vitest/vitest.mjs run tests/catalog.test.ts tests/source-coverage.test.mjs tests/data.test.ts` — passed (3 files, 27 tests).
- `node scripts/report-source-coverage.mjs` — passed: cohort 28; full public lists 5; faculty-only 1; no-public-list 22; parser-enabled 0; link-only 28.
- `pnpm test:run` — passed (12 files, 87 tests).
- `pnpm build` — passed (0 Astro errors, warnings or hints; static build complete).
- `git diff --check` — passed.

The report validates exact cohort membership, no pending records, every record's registered official-domain source, duplicate source IDs, unregistered source domains, and nonzero CLI status for a missing university/source registry failure.

## Unresolved concerns

## Fix round 1 evidence

- Oxford now uses the current official Graduate Admissions international-qualifications page, which has a dedicated China graduate section; the verified URL retains `source=applicationguide`.
- The KCL international-entry URL redirects to a legacy 2025 page and was removed. The replacement is KCL's current 2026/27 China Scholarship Council doctoral admissions guide, recorded with exact CSC doctoral scope and cycle.
- Birmingham's China page names groups but not their roster, so it is now `not-public` with link-only China-requirements metadata.
- Direct inspection found Sheffield's one 1.88 MB five-column HTML roster; UCL renders a two-column institution table; Edinburgh links an official PDF. No parser was registered because sync requires every emitted exact official name to already be registered in `institutions.json`; partial registration would deterministically reject an update. Southampton delegates tiers to a dynamic/filterable list. No names, aliases, grades or eligibility facts were inferred.
- Coverage now validates every source for cohort ownership, reciprocal university reference and registered official domain. CLI tests prove nonzero exits for missing university/source, duplicate IDs, untrusted domains and orphan sources.
- Runtime workaround: prepend `C:\\Users\\ROG\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin` to `PATH`; focused files use `node node_modules\\vitest\\vitest.mjs …` because `pnpm vitest` does not resolve the workspace binary here, while `pnpm test:run` runs the full suite.

No deterministic list parser was enabled and no institution/fact was populated. This is intentionally conservative, but the five public-list links should be manually revisited before Task 6 if automated matching is needed. Some universities supply country requirements through dynamic pages or linked material, so the registered link is evidence metadata only and does not determine an applicant's eligibility.

## Fix round 2 evidence

- KCL's closed K-CSC scholarship was removed. The source is now the current ordinary postgraduate-taught application guide (`https://www.kcl.ac.uk/study/postgraduate-taught/how-to-apply`), explicitly labelled as general international application evidence rather than a China list; KCL remains `not-public`.
- Direct official downloads populated exact-name institution records and generated traceable facts: UCL China table URL above, 84 cells/rows; Edinburgh Priority List PDF `https://www.ed.ac.uk/sites/default/files/atoms/files/priority_list_of_chinese_universities.pdf`, 81 parser-reproducible rows; Sheffield ranking-list URL above, 2,897 rows captured from the full rendered response. The merged registry contains 2,917 conservative records and generated requirements contains 3,063 facts.
- UCL uses `html-table` with direct `table tbody > tr` and dual institution columns, guard 84–92. Edinburgh uses `pdf-text` with its exact official-name pattern, guard 81–91. Both directly re-ran against current downloads before verification.
- Sheffield's subsequent direct response returned only the four public summary-band rows (77,903 bytes) rather than the earlier 1.88 MB full roster. Its parser is therefore deliberately link-only rather than an unsafe non-reproducible configuration; captured facts remain traceable to the exact official URL and content hash.
