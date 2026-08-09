# Task 3 report — review batch 2

## Decisions and official evidence

All 13 assigned QS-directory universities are `china-requirements` / `reviewed` on 2026-08-09. The 14 registered sources comprise 13 university-scoped sources and one Dundee programme-scoped source; all are first-party HTTPS, `link-only`, `institutionRule.type: "none"`, and zero-record guarded. No institution or requirement fact was created.

| University | Official evidence and verified anchors | Decision / caveat |
| --- | --- | --- |
| University of Kent | [China](https://www.kent.ac.uk/international/countries/china): `For courses that require a UK 2.2`; `65% or 70%/GPA of 2.6`; `depending on the institution where the degree was completed` | Institution-dependent grades, no roster. |
| Aston University | [China](https://www.aston.ac.uk/international/aston-in-your-country/north-east-asia/china): `The specific percentage requirement will vary`; `2:1 China full-time Bachelor's degree`; `Project 211/985 universities` | Course/institution-dependent grades, no Aston roster. |
| University of Essex | [China](https://www.essex.ac.uk/international/country-specific-information/china): `75% overall average from Gaokao`; ARWU band 1 and band 2 anchors | ARWU bands are not an Essex roster. |
| University of Dundee | [China gateway](https://www.dundee.ac.uk/countries/china): China and qualification selector anchors; separate programme-scoped [International Business and Management MSc page](https://www.dundee.ac.uk/postgraduate/international-business-management/entry-requirements/all): Tier 1/Tier 2 Double First anchors | The gateway and MSc example are separate link-only sources; programme evidence is not generalized to the university. Neither is a roster. |
| SOAS | [China information](https://www.soas.ac.uk/international/information-region/information-prospective-students-china): C9/Double First; `73% to 75%`; non-C9 anchor | Category grades, no roster. |
| Royal Holloway | [China](https://www.royalholloway.ac.uk/studying-here/international-students/find-your-country/china/): `recognised university in China`; programme-dependent and 65–75% anchors | No public institution list. |
| University of Bradford | [China](https://www.bradford.ac.uk/international/country/china/): guidance-only; Bachelor Degree; `85% | 80% | 65%` | Qualification equivalency, not a roster. |
| University of Huddersfield | [London entry requirements](https://london.hud.ac.uk/how-to-apply/entry-requirements): country-specific; China Bachelor 65%; Huikao 80% anchors | Official London-campus evidence only. |
| Northumbria University | [International Guide PDF](https://www.northumbria.ac.uk/-/media/corporate-website/documents/agent-zone/publication-359527china-approved.ashx): entry/scholarship, postgraduate 2:2, 70%, 75% anchors | Directly fetched from the university domain as `application/pdf`; runtime PDF extraction confirmed all anchors. No roster. |
| University of Stirling | [International entry requirements](https://www.stir.ac.uk/international/international-students/international-entry-requirements/): China; 211/985 65%; other universities 70% anchors | External categories, no Stirling roster. |
| Bangor University | [China](https://www.bangor.ac.uk/international/countries/china): postgraduate; 65%; 211; 70% anchors | Category thresholds, no roster. |
| University of Hull | [Joining from China](https://www.hull.ac.uk/study/international-students/your-country/china): degree-type guide; course variance; current course page anchors | Sparse gateway only; no percentages were invented. |
| Coventry University | [International entry requirements](https://www.coventry.ac.uk/international-students-hub/entry-requirements/?country=China&region=ea): China; 4-year 70%; grading-system/transcript anchor | `country=China&region=ea` is material; no roster. |

## TDD and verification

- RED: the requested `pnpm exec vitest` command could not resolve `vitest` in this worktree. With the same bundled Node runtime, local Vitest reported four expected failures: the batch remained pending, source IDs were empty, no source metadata was registered, and caveats were absent.
- First GREEN attempt exposed a source-object field-order defect and stale first-batch count expectations. The source objects were corrected and the existing count assertions were updated semantically for this second batch while retaining their baseline digests.
- Domain-ownership RED: after restoring Huddersfield's canonical `https://www.hud.ac.uk`, the catalog rejected its official `london.hud.ac.uk` source and the coverage test reported `unregistered source domain: huddersfield-china-requirements`.
- Domain-ownership GREEN: both catalog and coverage code normalize only a leading `www.` before accepting the base host or its subdomains. Existing `untrusted.example` rejection coverage remains in place.
- Focused GREEN: 4 files / 195 tests passed. Fresh full suite: 28 files / 485 tests passed.
- Review-fix RED: the Dundee gateway still contained the MSc-only Tier anchors and the separate programme source had no unchecked status row. The new source-contract test failed precisely on those two conditions.
- Review-fix GREEN: Dundee now has a university-scoped selector source with only its own two anchors and a second, programme-scoped MSc source with the Tier anchors; both are `none` / link-only / zero-record sources. Status tests pin every Batch 2 source to `unchecked`, zero failures, and no hash fields. Coverage tests also reject `hud.ac.uk.evil.test` and `evil-hud.ac.uk`.

## Diff protection and review

- `git diff --check` passed.
- No changes were made to `institutions.json`, generated requirements, public output, rankings, categories, or UI. The focused tests retain the feature-start reviewed-university/source/requirements/institution digest protections, and the second-batch test verifies zero requirements and the unchanged institution digest.
- Self-review confirmed the exact 13 IDs, states, one same-university source each, `none` rule type, link-only zero-record guard, required anchors, status rows (`unchecked`, zero failures), and special Dundee/Huddersfield/Northumbria/Hull/Coventry caveats.

## Commit and concerns

- Commit: current `HEAD` — `data: review second pending China-rule batch`.
- Concern: all pages use link-only evidence; neither broad labels (211/985, C9, Double First, ARWU, recognised) nor their absence are institution-level admission records. Re-audit if a university publishes a deterministic roster.
