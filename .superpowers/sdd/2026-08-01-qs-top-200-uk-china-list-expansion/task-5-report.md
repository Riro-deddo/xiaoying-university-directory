# Task 5 report

Only **Fix round 4 final state (current)** is authoritative. Every earlier section below is retained as a superseded historical record and must not be read as the current count or implementation state.

## Superseded initial attempt — research method and source verification

Processed the frozen 28-member QS cohort in rank order. Used current official university domains returned by web searches for China/international postgraduate entry requirements, including the linked official China pages for UCL, Edinburgh, Birmingham, Sheffield, Southampton, Queen Mary, Bath, Exeter, Liverpool, York, Lancaster, Queen's Belfast, Cardiff and Reading. Sources are recorded as URLs in `src/data/sources.json`; no third-party, agency, cached or ranking sources were used as data sources.

Where the publicly exposed content was a country/qualification guidance page without a safely configured stable list parser, recorded a traceable `link-only` source and a `not-public` state. Manchester is explicitly scoped to the Faculty of Humanities Law source. UCL, Edinburgh, Birmingham, Sheffield and Southampton publicly expose a university-level list or tier structure, but their registry entries remain `link-only`: no names or eligibility facts were inferred or extracted. `institutions.json` is deliberately unchanged and no requirements facts were created.

## Superseded initial attempt — RED / GREEN evidence

RED 1: after adding catalog coverage tests, `node node_modules/vitest/vitest.mjs run tests/catalog.test.ts` failed as expected: cohort equality showed only 3 existing records versus 28, and a record had zero sources.

RED 2: after adding the source-report test, `node node_modules/vitest/vitest.mjs run tests/source-coverage.test.mjs` failed as expected because `scripts/report-source-coverage.mjs` did not yet exist. A follow-up CLI-exit test then failed as expected with status 0 before data-root support was added.

GREEN: `node node_modules/vitest/vitest.mjs run tests/catalog.test.ts tests/source-coverage.test.mjs tests/data.test.ts` passed: 3 files, 27 tests. The prescribed `pnpm vitest` form does not resolve the workspace binary in this environment even with the runtime Node directory prepended to `PATH`; direct invocation uses the same locked Vitest package.

## Superseded initial attempt — verification and self-check

- `node node_modules/vitest/vitest.mjs run tests/catalog.test.ts tests/source-coverage.test.mjs tests/data.test.ts` — passed (3 files, 27 tests).
- `node scripts/report-source-coverage.mjs` — passed: cohort 28; full public lists 5; faculty-only 1; no-public-list 22; parser-enabled 0; link-only 28.
- `pnpm test:run` — passed (12 files, 87 tests).
- `pnpm build` — passed (0 Astro errors, warnings or hints; static build complete).
- `git diff --check` — passed.

The report validates exact cohort membership, no pending records, every record's registered official-domain source, duplicate source IDs, unregistered source domains, and nonzero CLI status for a missing university/source registry failure.

## Superseded initial attempt — unresolved concerns

## Superseded fix round 1

- Oxford now uses the current official Graduate Admissions international-qualifications page, which has a dedicated China graduate section; the verified URL retains `source=applicationguide`.
- The KCL international-entry URL redirects to a legacy 2025 page and was removed. The replacement is KCL's current 2026/27 China Scholarship Council doctoral admissions guide, recorded with exact CSC doctoral scope and cycle.
- Birmingham's China page names groups but not their roster, so it is now `not-public` with link-only China-requirements metadata.
- Direct inspection found Sheffield's one 1.88 MB five-column HTML roster; UCL renders a two-column institution table; Edinburgh links an official PDF. No parser was registered because sync requires every emitted exact official name to already be registered in `institutions.json`; partial registration would deterministically reject an update. Southampton delegates tiers to a dynamic/filterable list. No names, aliases, grades or eligibility facts were inferred.
- Coverage now validates every source for cohort ownership, reciprocal university reference and registered official domain. CLI tests prove nonzero exits for missing university/source, duplicate IDs, untrusted domains and orphan sources.
- Runtime workaround: prepend `C:\\Users\\ROG\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin` to `PATH`; focused files use `node node_modules\\vitest\\vitest.mjs …` because `pnpm vitest` does not resolve the workspace binary here, while `pnpm test:run` runs the full suite.

No deterministic list parser was enabled and no institution/fact was populated. This is intentionally conservative, but the five public-list links should be manually revisited before Task 6 if automated matching is needed. Some universities supply country requirements through dynamic pages or linked material, so the registered link is evidence metadata only and does not determine an applicant's eligibility.

## Superseded fix round 2

- KCL's closed K-CSC scholarship was removed. The source is now the current ordinary postgraduate-taught application guide (`https://www.kcl.ac.uk/study/postgraduate-taught/how-to-apply`), explicitly labelled as general international application evidence rather than a China list; KCL remains `not-public`.
- Direct official downloads populated exact-name institution records and generated traceable facts: UCL China table URL above, 84 cells/rows; Edinburgh Priority List PDF `https://www.ed.ac.uk/sites/default/files/atoms/files/priority_list_of_chinese_universities.pdf`, 81 parser-reproducible rows; Sheffield ranking-list URL above, 2,897 rows captured from the full rendered response. The merged registry contains 2,917 conservative records and generated requirements contains 3,063 facts.
- UCL uses `html-table` with direct `table tbody > tr` and dual institution columns, guard 84–92. Edinburgh uses `pdf-text` with its exact official-name pattern, guard 81–91. Both directly re-ran against current downloads before verification.
- Sheffield's subsequent direct response returned only the four public summary-band rows (77,903 bytes) rather than the earlier 1.88 MB full roster. Its parser is therefore deliberately link-only rather than an unsafe non-reproducible configuration; captured facts remain traceable to the exact official URL and content hash.

Final verified JSON counts after conservative duplicate-name consolidation: 2,910 institutions and 3,051 requirements.

## Superseded fix round 3

The historical Sheffield roster capture has been removed: its current response exposes only four summary bands, so Sheffield is `not-public`, `china-requirements`, and link-only with zero facts. UCL and Edinburgh are the only parser-enabled sources. Their regenerated exact English-name records intentionally omit `nameZh` where no Chinese official name is supplied; the institution contract now permits that rather than inventing a translation or placeholder. Final data: 128 institutions, 165 facts (UCL 84; Edinburgh 81; Sheffield 0). Edinburgh facts use SHA-256 `d89ccc58ecedaf9685656b4304ae4c79adbb32f6699cba9dc3fa947c70f573d2` from the 204,706-byte official PDF. Parser guard ranges are UCL 84–92 and Edinburgh 81–89.

## Fix round 4 final state (current)

### Root cause and resolution

Round 3 regenerated JSON through a lossy Windows text path. That converted all 165 Chinese fact scopes and the Edinburgh en dash to question marks. It then made `InstitutionRecord.nameZh` optional in TypeScript and JSON Schema to accommodate 128 records without Chinese names, breaking the canonical institution-search contract.

Round 4 restores `nameZh` as a required, nonblank string and writes both JSON datasets as UTF-8 through Node's explicit `utf8` file path. Every fact now copies `scope`, `scopeZh`, `defaultTierOfficial`, and optional cycle directly from its registered source. UCL's tier is exactly `Applicants from the list of universities below`; Edinburgh's is exactly `Priority List of Chinese universities – October 2024`. No user-facing catalog, source, institution, or requirement string contains `?` or U+FFFD corruption.

### Chinese-name provenance and canonicalization

Entry-requirement facts remain supported exclusively by the registered UCL and Edinburgh university-owned sources. Chinese display/search names were researched separately and do not create eligibility evidence.

The primary Chinese-name authority was the Ministry of Education's current 2025 `全国普通高等学校名单`, read from the Ministry's official registry endpoint (`https://www.moe.gov.cn/qggxmd/`) linked by the Ministry's 27 June 2025 notice (`https://hudong.moe.gov.cn/jyb_xxgk/s5743/s5744/A03/202506/t20250627_1195683.html`). Exact Chinese candidates were checked against all 2,952 registry entries. This verified 123 of the 128 source-row mappings before cross-source deduplication; composite UCL rows for the Beijing/Wuhan geosciences, Xuzhou/Beijing mining, and Beijing/East China petroleum institutions join the Ministry's exact component names with `/` and do not translate them.

The five mappings outside that civil-university registry were checked on primary institution-owned pages:

- Shanghai Jiao Tong University's official history records `Shanghai Second Medical College/University (1952-2005)` and its 2005 integration; the Chinese graduate guide records `上海第二医科大学` (`https://global.sjtu.edu.cn/en/about-us/our-history/history2`, `https://www.gs.sjtu.edu.cn/storage/gs/web/yzbcn/article/2025/09/d5bb0bc6ba934595254cc4c20b4a9bed.pdf`).
- The Chinese Academy of Sciences' Chinese and English official profiles establish `中国科学院` / `Chinese Academy of Sciences` (`https://www.cas.cn/`, `https://english.cas.cn/about_us/introduction/`).
- National University of Defense Technology's official site uses `国防科技大学` (`https://www.nudt.edu.cn/`).
- UIC's official site records the 2025 current name `北师香港浸会大学` and the former `北京师范大学-香港浸会大学联合国际学院`; the older exact English source name remains the canonical record's `nameEn` (`https://www.uic.edu.cn/info/1075/114209.htm`, `https://fhss.uic.edu.cn/comm/info/1144/1488.htm`).
- Naval Medical University's official history records current `海军军医大学` and former/current external-use `第二军医大学` (`https://www.smmu.edu.cn/2019/0422/c423a4396/page.htm`).

Jingdezhen Ceramic University's official history independently verifies that `Jingdezhen Ceramic Institute` was renamed `景德镇陶瓷大学` / `Jingdezhen Ceramic University` in 2016; `景德镇陶瓷学院` is retained as a verified historical alias (`https://www.jcu.edu.cn/english/about.htm`, `https://www.jcu.edu.cn/about/xxzc.htm`). No Chinese name was machine-translated or guessed.

The 128 exact UCL/Edinburgh source spellings contain 10 cross-source variants of the same institution. These are now 118 canonical records, satisfying the global raw-name uniqueness contract. Each UCL spelling remains `nameEn`; the corresponding Edinburgh spelling is a verified alias. Both sources' facts reference the same canonical ID. Three further Chinese historical aliases cover UIC, Naval Medical University, and Jingdezhen Ceramic University.

### Final counts and accepted decisions

- Canonical institutions: 118 (from 128 exact source spellings; 10 cross-source duplicates consolidated).
- Requirement facts: 165 — UCL 84, Edinburgh 81, Sheffield 0.
- Nonempty, non-empty-SHA content hashes: 165/165.
- UCL current re-extraction: 84 rows, zero unregistered names, SHA-256 `de49d96e46d1dfcff3822403bb2dc56ce04711bc513267f97cf018b4f5b80788`.
- Edinburgh current re-extraction: 81 rows, zero unregistered names, 204,706 bytes, SHA-256 `d89ccc58ecedaf9685656b4304ae4c79adbb32f6699cba9dc3fa947c70f573d2`.
- Sheffield remains `not-public`, link-only, with zero facts; Birmingham remains not-public; KCL remains on its current general postgraduate-taught guide.
- Coverage: 28 cohort universities; 3 official-list records; 1 faculty-only record; 24 no-public-list records; 2 parser-enabled sources; 26 link-only sources.

### Round 4 RED / GREEN evidence

RED: `node node_modules/vitest/vitest.mjs run tests/catalog.test.ts tests/requirements.test.ts` failed with 3 expected failures: user-facing corruption was detected, fact `scopeZh` differed from its registered source, and missing `nameZh` was accepted. A second RED run of `tests/catalog.test.ts` also failed the explicit 118-record canonicalization/alias contract against the 128 pre-fix records.

GREEN and verification:

- Focused contract GREEN: `node node_modules/vitest/vitest.mjs run tests/catalog.test.ts tests/requirements.test.ts` — 2 files, 20 tests passed.
- Focused catalog/data/requirements/extractor/sync/coverage suite — 7 files, 73 tests passed.
- `node scripts/report-source-coverage.mjs` — passed with the exact coverage counts above.
- `pnpm test:run` — 12 files, 99 tests passed.
- `pnpm build` — 0 errors, 0 warnings, 0 hints; 2 static pages built.
- `git diff --check` — passed.

### Current concerns

No unresolved integrity concern remains. Four official English list strings are historical while their institutions have current Chinese names (Shanghai Second Medical University, UIC/BNBU, Second Military/Naval Medical University, and Jingdezhen Ceramic Institute/University); the exact list strings and verified historical Chinese aliases are preserved so future extraction remains deterministic and Chinese search remains accurate.
