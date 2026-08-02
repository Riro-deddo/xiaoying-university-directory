# Task 7 reconciliation evidence

Completed 2026-08-02 without modifying or staging the concurrent Task 7 page, public-asset, presentation, package, or initial-HTML work.

## Registry result

- Before: 2,931 institution records and 22 normalized search collision keys.
- After: 2,914 institution records and two reviewed collision keys.
- Remaining collisions:
  - `taizhou university`: `cn-c2388dc8089d8ecb` (台州学院), `cn-79d6215ce67db635` (泰州学院).
  - `wuyi university`: `cn-606aa744bd4add70` (五邑大学), `cn-0f4e2477ec1b1de6` (武夷学院).
- Missing fact references: 0. Orphan registry records: 0. Malformed reviewed registry names: 0.

## Source evidence preservation

Identity merging initially exposed nine distinct same-source rows that previously relied on separate institution IDs. They are not exact duplicates and are retained with stable row discriminators:

- Sheffield: Gannan University of Science and Technology / 赣南科技学院; Qingdao Film Academy / 青岛电影学院; Qingdao University of Technology, Qindao College / 青岛理工大学琴岛学院; Sichuan University Jincheng College / 四川大学锦城学院.
- Southampton: Jiaxing University / 嘉兴大学; Fuyang Normal University / 阜阳师范大学; Guangdong Polytechnic Normal University / 广东技术师范大学; Ningxia Normal University / 宁夏师范大学; Yili Normal University / 伊犁师范大学.

Requirements and reverse-index counts are 5,754. Exact provider duplicates still deduplicate; distinct official Chinese, tier, or score rows remain separate. The additional fact preserves Southampton's current official Tier B/Tier C conflict for 珠海科技学院 instead of silently choosing one tier.

Gannan evidence remains intentionally distinct:

- Glasgow: 赣南科技学院, `Gannan University of Science and Technology`, band E.
- Southampton: 赣南科技学院, `College of Applied Science, Jiangxi University of Science and Technology`, Tier C.
- Southampton: 赣南科技大学, `Gannan University of Science and Technology`, Tier B.

## Verification

- Focused reconciliation/catalog/requirements/reverse-index tests: 86 passing.
- Full suite: 250 passing across 21 files.
- Astro check and static build: 0 errors, one existing non-blocking hint.
- Coverage: 28 QS universities, 1 specialist university, 9 public lists, 16 rule-only, 4 no-public-list records.
