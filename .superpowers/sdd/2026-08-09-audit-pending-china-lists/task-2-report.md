# Task 2 report — review batch 1

## Scope and decisions

Reviewed on 2026-08-09 using only official university pages. No source was recorded for the two blocked cases, and no institution or generated requirement fact was added.

| University | Decision | Official URL and verified anchors |
| --- | --- | --- |
| Loughborough University | `official-list`, reviewed; official dynamic lookup confirmed, link-only until its endpoint and full response contract are guarded. | [China universities entry requirements](https://www.lboro.ac.uk/study/postgraduate/entry-requirements-china/): `Find your institution`; `Search for a University (e.g. Anhui or 安徽)`; `Tier \| First class (70%) \| Mid 2:1 (65%) \| 2:1 (60%)`. |
| University of Strathclyde | `china-requirements`, reviewed; 211/985 versus other-China thresholds, no member roster. | [International entry requirements](https://www.strath.ac.uk/studywithus/internationalstudents/entryrequirements/): `GPA from a four-year undergraduate degree must be:`; `over an average of 70% for 211/985 universities`; `over an average of 75% for the rest of Chinese universities`. |
| University of Surrey | `china-requirements`, reviewed; general China equivalency, no institution list. | [China entry requirements](https://www.surrey.ac.uk/china/entry-requirements): `Students who have completed 4-year undergraduate study in any Chinese University`; the 75% and 70% 2:1/2:2 anchors. |
| University of Sussex | `china-requirements`, reviewed; 211/985 informs offers, no roster. | [China country page](https://www.sussex.ac.uk/study/international-students/information-by-country/china): `A Bachelor’s degree with a minimum overall mark of at least 65%-70%...`; `Sussex uses Project 211/985 to inform offer levels.` |
| University of Aberdeen | `pending`, blocked; dated internal proposal is not current applicant-facing evidence. No source registered. | The 2024 internal recommendation is intentionally not stored as a current rule. |
| University of Leicester | `china-requirements`, reviewed; prestigious/other grouping, no member roster. | [China](https://le.ac.uk/study/international-students/countries/asia/china): `Four-year Bachelors degree from a prestigious university...`; `Other Chinese universities: 70-75% depending on the course.` |
| Swansea University | `china-requirements`, reviewed; Double World Class versus other universities, no roster. | [Country/Region Specific Entry Requirements](https://www.swansea.ac.uk/postgraduate/apply/entry-requirements/country-specific/): `Double World Class Universities`; `All other Universities`; `UK 2.1 or Master’s (Merit)`; `75%`; `80%`. |
| Heriot-Watt University | `china-requirements`, reviewed; ShanghaiRanking bands, no roster. | [Postgraduate programmes](https://www.hw.ac.uk/china/apply-now/postgraduate-programmes): `软科中国大学排名前1-250的大学`; `四年制本科学位平均成绩达到68`; `软科中国大学排名251名以后的大学`; `...达到72`. |
| Brunel University of London | `china-requirements`, reviewed; general China equivalency, no institution list. | [China](https://www.brunel.ac.uk/international/your-country-and-region/China): `As a guideline and depending on the programme you apply for`; `from a recognised Chinese institution:`; 2:1 and 2:2 grade-range anchors. |
| Birkbeck, University of London | `china-requirements`, reviewed; category thresholds, no member roster. | [China](https://www.bbk.ac.uk/international/country-region-information/china): the 211/985/top-national, national, and high-ranking-private degree anchors. |
| City St George's, University of London | `china-requirements`, reviewed, **programme scope only**. | [International Commercial Law LLM](https://www.citystgeorges.ac.uk/prospective-students/courses/postgraduate/international-commercial-law-llm/2026): `### China`; case-by-case guidance; `Depending on the awarding institution...`; `70 to 75%`. |
| University of East Anglia | `pending`, blocked; no current primary China-entry source with two verifiable anchors. No source registered. | Official-domain discovery did not yield a current applicant-facing China page/PDF; third-party results were excluded. |
| Oxford Brookes University | `china-requirements`, reviewed; general China equivalency, no institution list. | [China entry requirements](https://www.brookes.ac.uk/study/international-students/your-country/china/entry-requirements): `Qualifications equivalent to a UK bachelor degree:`; `学士学位 (Bachelor degree)`; `2:1 \| 75%`; `2:2 \| 70%`. |

All 11 registered sources are HTTPS, include exact verification anchors reviewed on 2026-08-09, use `link-only`, and use a zero-record guard. Their new status rows are `health: "unchecked"`, `consecutiveFailures: 0`, with no accepted content hash.

## TDD and verification

- RED: `tests/pending-china-audit.test.ts` was written before data edits. The requested `pnpm exec vitest` entrypoint could not resolve `vitest` in this worktree; the equivalent local `node_modules/.bin/vitest.cmd` run then failed as expected on the still-`unreviewed` batch rows and missing sources (4 test failures).
- The initial four-file GREEN exposed 10 stale hard-coded lifecycle/baseline expectations in `catalog` and `source-coverage`; these were recorded as RED, then updated with exact batch lifecycle expectations and filtered protection for all pre-existing sources/facts.
- The fresh full suite then exposed one stale public-list test: it treated every university-level `official-list` as parser-enabled. The RED was recorded; the test now continues to require nine parser-enabled public lists while explicitly requiring Loughborough's confirmed dynamic lookup to remain `link-only` with zero facts.
- GREEN: focused suite: 184 tests across the four requested files. Fresh full suite: 28 files, 474 tests, all passing.
- `git diff --check` passed. Baseline protection was independently checked: 5,754 pre-existing requirement facts, SHA-256 `f932710580077d2bf84c0fccffc239e4ed9c3cba4fdb807c6a58ad2b1c802f00`; no new requirement fact was created. The diff is limited to the batch data, its statuses, and lifecycle/regression tests.

## Self-review and concerns

- Rechecked the 13 exact catalogue/audit states: 11 reviewed (one `official-list`, ten `china-requirements`), two blocked `pending`; City remains `programme` scope.
- No synchronizer was run; no institutions, requirement facts, public-generated files, dependencies, rankings, categories, or UI were changed.
- Concern: Loughborough's lookup is client-side; do not represent it as a locally stored roster until its API/endpoint contract and complete guarded response are verified.
- Concern: Aberdeen needs a current applicant-facing primary rule; UEA needs a current official China-entry page/PDF with anchors.

## Commit

Pending commit: `data: review first pending China-rule batch`.

## Review fix round 1

- RED: the new feature-start snapshot contract failed because the fixture lacked `reviewedUniversities`, `institutionsCount`, and `institutionsSha256` (two expected failures). The first fixture extraction also copied an incorrect LSTM note, which produced one precise object-diff failure; it was not a production-data drift.
- Correction: `git rev-parse 5974b86` resolved to `5974b86c5b9498927a7163a38a6b7b46aad88461`; `git show 5974b86:src/data/universities.json` and `git diff 5974b86..d82a6ac -- src/data/universities.json` confirmed the feature-start LSTM object. The fixture now contains all 36 exact reviewed university objects from that revision plus the 2,914-record institutions SHA-256 `c9d1d345f5ac3b8296cbe7cab09922449a4487192e045c61b57d34fdd548b8d8`.
- The batch test now carries a per-ID 11-source manifest fixing source ID, university, official URL, kind, scope, institution-rule type, exact approved `requiredText` anchors, and `link-only` zero-record guard. It deep-compares the reviewed-university snapshot and verifies the institutions digest in addition to the pre-existing audit/source/requirements protections.
- GREEN: corrected focused suite: 4 files / 187 tests; fresh full suite: 28 files / 477 tests; `git diff --check` passed. Only the fixture and batch test changed; production data did not change.
- Pending separate commit: `test: lock reviewed China-audit baselines`.
