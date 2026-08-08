# Ranking data provenance

## QS World University Rankings 2027

- UK-filtered source: https://www.topuniversities.com/world-university-rankings?countries=gb
- Published: 2026-06-18
- Verified: 2026-08-08
- Stored fields: institution identity, displayed placement, sortable lower bound, edition, attribution, verification date
- Access rule: use the public table or an official export obtained through its normal permitted route; do not bypass registration or access controls

## Times Higher Education World University Rankings 2026

- UK table: https://www.timeshighereducation.com/student/best-universities/best-universities-UK
- Full ranking: https://www.timeshighereducation.com/world-university-rankings/latest/world-ranking
- Attribution: Times Higher Education World University Rankings 2026
- Verified: 2026-08-08
- Stored fields: institution identity, displayed placement or official band, sortable lower bound, edition, attribution, verification date

## Annual refresh

Rankings are maintained as reviewed, versioned manual snapshots and are updated only when a new edition is released. Each annual update is reviewed as one data change and never runs in the daily university-source workflow. Daily source reviews are isolated from ranking data and must not rewrite an annual ranking snapshot.

## Reviewed snapshot digests

- QS World University Rankings 2027: `8ae0050030d5605a82e84f79ef4a8d63532f688e3329b56fa7fb217ab2f7735b`
- Times Higher Education World University Rankings 2026: `c57fbbfa822556d85ffe6a37819d72ac972ab1bd7fccb5b6db3f679d9f410aef`

For each provider and edition, the canonical snapshot contains one line per directory university in binary ascending `universityId` order. Each line is `universityId|placement|displayRank|sortRank`; missing `displayRank` and `sortRank` are empty fields, so Queen Margaret University's THE state is `queen-margaret-university-edinburgh|unranked||`. Lines are joined with LF, with no trailing LF, encoded as UTF-8, and hashed with SHA-256 to lowercase hexadecimal.

These digests lock the independently reviewed annual mappings without copying the official tables into the repository. They may change only as part of the next official-edition review (or a documented correction rechecked against the official source); the reviewer must regenerate the canonical sequences, inspect the diff, and update the ranking facts, digest tests, and these documented values together.
