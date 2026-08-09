# Task 6 report — final China-rule batch

Reviewed 2026-08-09 against current first-party pages in the in-app browser.

## Per-school current first-party evidence

| University | Final state / review status | Current official URL(s) and direct-browser evidence | Scope and rationale |
| --- | --- | --- | --- |
| London Metropolitan University | `pending` / `blocked` | Deployment `https://www-dev-web-01.londonmet.ac.uk/international/applying/entry-requirements-by-country/china/` returned `ERR_NAME_NOT_RESOLVED`; canonical `https://www.londonmet.ac.uk/international/applying/countries/students-from-china/` rendered a `China entry requirements / Academic entry requirements` `#` anchor only. | University country page; source-free because no current threshold or roster rendered. |
| Robert Gordon University | `china-requirements` / `reviewed` | `https://www.rgu.ac.uk/study/international-students/your-country-or-territory/china`; `A four-year Bachelor’s Degree from a recognised "211" or "985" university`; `70% is required from all other recognised universities in China`; `Applications are considered on an individual basis`. | University China guidance; no university-owned member roster. |
| Sheffield Hallam University | `china-requirements` / `reviewed` | Canonical `https://www.shu.ac.uk/study-here/international/entry-requirements/entry-requirements-for-china`; `This page outlines the qualifications we accept from China`; `Four year Bachelor Degree from a recognised university`; `usual minimum average of 60 per cent`; `Masters degree from a recognised University`. | University China guidance; canonical production page directly verified, no roster. |
| University of East London | `pending` / `blocked` | `https://www.uel.ac.uk/international/regions/east-asia`; `https://www.uel.ac.uk/international/guidance-your-region/entry-requirements`; no China threshold or deterministic roster. | Regional/general guidance; source-free, not an inferred private list. |
| University of Lancashire | `china-requirements` / `reviewed` | `https://www.lancashire.ac.uk/international-students/country/china`; `Entry Requirements`; `Our entry requirements can change depending on the course and the year you apply`; `The information below is just a guide`. | University country guidance; browser overcame research fetch 403 and showed qualification requirements but no roster. |
| University of Roehampton | `pending` / `blocked` | `https://www.roehampton.ac.uk/student-support/international-students/countries/china/` is promotional; its official `https://www.roehampton.ac.uk/international/entry-requirements/` link has no `China`, `Chinese`, `70%`, or `Project 211` rule. | Country/general guidance; source-free. |
| University of Salford | `pending` / `blocked` | `https://www.salford.ac.uk/international/your-country-or-region/salford-and-china`; promotional/partnership/alumni content and navigation only; no China thresholds. | University China page; source-free. |
| University of Wolverhampton | `pending` / `blocked` | `https://isc.wlv.ac.uk/wp-content/uploads/2025/02/Academic-Entry-Requirements_Pre-Masters-Programme_UoWISC.pdf` returned `404 Not Found`. | The cited source was Pre-Master’s programme/pathway scope, never university-wide direct entry; no source registered. |
| Queen Margaret University Edinburgh | `pending` / `blocked` | `https://www.qmu.ac.uk/study-here/international-students/information-for-your-country/china`; promotion and entry-requirements navigation, not China threshold/roster text. | University country page; source-free. |
| University of Northampton | `pending` / `blocked` | `https://www.northampton.ac.uk/international/your-country/east-asia-and-south-east-asia/`; includes `CHINA, HONG KONG, INDONESIA, JAPAN, MALAYSIA, THAILAND AND VIETNAM`, but renders English-language/promotional guidance only. | Regional page; source-free. |
| University of Derby | `china-requirements` / `reviewed` | `https://www.derby.ac.uk/undergraduate/apply/entry-requirements/international/`; `Mainland China`; `First year entry - 高考 - National College Entrance Examination (Gaokao)`; `Requirement: 50%`; `Requirement: 70% and above`. | International qualifications table; qualification thresholds only, no roster. |
| University of South Wales | `pending` / `blocked` | `https://www.southwales.ac.uk/international/your-country/china/`; promotional and `SCHOLARSHIPS AND ENTRY REQUIREMENTS` is self-referential; no China rule. | University country page; source-free. |
| Canterbury Christ Church University | `china-requirements` / `reviewed` | `https://www.canterbury.ac.uk/study-here/international/find-your-country/china`; `Entry requirements`; `National High School Graduation Certificate with a minimum average grade of 70%`; 211 thresholds at `70%` and `65%`. | University China page; direct browser verified qualifications; 211 has no member roster. |

## Verification

- RED: `vitest run tests/pending-china-audit.test.ts` failed with three missing-batch assertions before production data changed.
- GREEN/focused: `vitest run tests/pending-china-audit.test.ts tests/data.test.ts tests/catalog.test.ts tests/source-coverage.test.mjs` — 212 passed.
- Final totals: 90 reviewed, 11 blocked, 0 unreviewed; 72 `china-requirements`, 10 `official-list`, 8 `not-public`.
- Fix round RED: the new real-directory `evaluateCoverage` and CLI tests failed because the report script compared the 93-current-QS directory to the legacy 28-item discovery cohort.
- Fix round GREEN: source coverage derives the 93 current QS IDs from QS 2027 ranking records and unions the approved eight specialists; focused coverage and audit tests passed, and `node scripts/report-source-coverage.mjs` exits 0.
- Final-review RED: omitting `rankings` still silently restored the 28-item cohort, while contradictory blocked/reviewed lifecycle mutations either passed or produced only generic pending/source noise.
- Final-review GREEN: `evaluateCoverage` now requires current ranking metadata, enforces blocked/pending and reviewed/non-pending lifecycles bidirectionally, and returns exact de-duplicated mutation failures. Focused coverage/audit was 66/66; full tests were 28 files / 512 tests; the direct CLI still reports cohort 28 separately from QS 93 and exits 0.

## Concerns

Six research-era China sources no longer expose their cited academic material and the Wolverhampton PDF is 404. They remain blocked instead of relying on cached search/report text. No institution or generated requirement records were added.
