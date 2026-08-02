# Task 6 verification — public China lists

Completed 2026-08-02.

All nine confirmed public China-list sources synchronised with zero retained anomalies:

| Source | Facts |
| --- | ---: |
| Cambridge | 118 |
| Warwick | 361 |
| Bristol | 303 |
| Glasgow | 865 |
| Nottingham | 168 |
| Sheffield | 2,888 |
| Southampton | 885 |
| UCL | 84 |
| Edinburgh | 81 |

Reviewed reconciliation preserves each source's raw institution spelling in its fact. Canonical identity is Chinese-first; English lookup remains deterministic and rejects ambiguous records. Reviewed aliases cover historical names, typos, abbreviations, and scoped colleges/campuses. Historical duplicate records for Guangzhou Medical, Shanghai Ocean, and Shanghai University of Sport were migrated to their current canonical records.

Verification completed:

- Focused sync/catalog/requirements tests: 74 passing.
- Full suite: 227 passing across 19 files.
- Astro check and static build: 0 errors (one existing TypeScript hint).
- Source coverage: 28 QS universities, 1 specialist university, 9 public lists, 16 rule-only, and 4 no-public-list records.

## Follow-up sync integrity fix — 2026-08-02

- Institution candidates are now deep-cloned and compared by content, so alias-only reconciliations persist atomically and rejected sources cannot leak aliases into later accepted updates.
- Glasgow PDF rows reconstruct English continuations and apply Chinese-anchored reviewed names when its text layer repeats an English name for multiple institutions. The affected Hunan, Anshan, Harbin, and Hubei records now use their correct English names.
- Glasgow score delimiters use `；`; generated score facts contain no mojibake. Only the reviewed Taizhou University and Wuyi University English-name collisions remain.
- Final verification: 232 tests passing across 19 files; Astro check/build 0 errors (one existing hint); source coverage unchanged; guarded synchronisation completed with zero retained anomalies.

## Follow-up registry migration — 2026-08-02

- Glasgow repairs now inspect every exact Chinese-name registry match after reconstructing PDF facts, including rows whose corrected English name is unique.
- Historic parser fragments and carried names are removed instead of preserved as aliases. Canonical records now use the repaired Glasgow English names for Hunan Institute of Technology, Anshan Normal University, Harbin University, Hubei Engineering University, and Chaohu University.
- Remaining reviewed English-name conflicts: `Taizhou University` and `Wuyi University` only. There are no one-word English registry entries or other cross-Chinese normalized-English conflicts among Glasgow-linked records.
- Final verification: guarded sync accepted all 31 registered sources with zero anomalies; 234 tests passing across 19 files; Astro check/build 0 errors (one existing hint); source coverage unchanged.

## Full registry identity reconciliation — 2026-08-02

- Reviewed A/B migrations plus the Naval/Second Military Medical University identity merge rewrote every requirement reference to its canonical ID. Registry size changed from 2,931 to 2,914 with zero orphan records or missing fact references.
- Reviewed C/D/E policies disambiguate Nanchang, both Beijing Normal Zhuhai identities, China University of Geosciences (Wuhan), and the two distinct Gannan institutions while preserving source-official fact text and Southampton Tier B/Tier C evidence.
- Stable row discriminators retain reviewed historical/current Chinese rows and different tier/score evidence, while alternate English spellings for the same Chinese row and rule deduplicate. The current output contains 5,754 facts, including Southampton's official Tier B and Tier C rows for 珠海科技学院.
- Full normalized registry collisions are now exactly `Taizhou University` and `Wuyi University`, the two reviewed ambiguities. Malformed leading-parenthesis, incomplete-English, and concatenated-Chinese registry names are absent.
- Verification: 250 tests passing across 21 files; Astro check/build 0 errors (one existing hint); source coverage unchanged; guarded sync accepted all 31 sources with an empty anomaly report.
