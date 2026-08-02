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
