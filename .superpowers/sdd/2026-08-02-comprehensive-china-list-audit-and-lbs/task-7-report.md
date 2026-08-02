# Task 7 report — lightweight reviewed-state presentation and lazy public data

## Result

- Adds the reviewed scope copy: `28 所 QS 2027 世界前 200 英国大学 + 1 所专业院校`.
- Gives LBS the rank-safe `专业院校` label in both directory and reverse-search cards.
- Shows rule summaries before official links, including Manchester's three scoped sources and Exeter's current 2026 uniform-rule summary.
- Moves nine public lists into independently cacheable static JSON assets. Panels render only metadata and a base-safe URL initially, then fetch rows on first open; failed requests keep official links and expose a retry.
- Loads the reverse index only after the user switches to Chinese-institution mode. A failed request remains retryable.
- Keeps the two reviewed English-name collisions (`Taizhou University`, `Wuyi University`) as explicit choices; exact Chinese names remain singular matches.

## Red / green evidence

- Red: `vitest run tests/presentation.test.ts tests/page-content.test.mjs tests/official-list-display.test.ts tests/public-data.test.mjs` failed as expected before implementation: missing `directoryRankCopy`, missing scope/rule copy, and missing `build-public-data.mjs`.
- Green focused run: 47 tests passed across presentation, page content, public-data, official-list display, and institution search.

## Fresh verification

- Full suite: 241 tests passed in 20 files.
- `astro check`: 0 errors, 0 warnings (one pre-existing hint in `scripts/sync-sources.mjs`).
- `pnpm run build`: passed twice, including a GitHub Pages base-path build using `Riro-deddo/xiaoying-university-directory`.
- Base-path assertions confirmed both list and reverse-index URLs begin with `/xiaoying-university-directory/` in that build.

## Public artifacts

- 9 list files, 1,431,701 bytes total.
- Reverse index: 5,753 entries, 2,733,847 bytes.
- Built index page: 492,621 bytes, nine list-panel metadata attributes, zero inline `institutionOfficial` facts, and zero inline reverse-index `evidenceState` entries.

## Commit

`feat: present complete China rule coverage` (hash recorded in the Task 7 handoff after this report is committed).

## Remaining concern

The rendered desktop/mobile interaction loop is intentionally left for Task 8. The implementation has automated load/retry safeguards and build inspection, but Task 8 must still exercise real browser interactions.

## Review fix round

- Re-generated the lazy registry from the reconciled 2,915-record source into `public/generated/institutions.json` (480,470 bytes), with 5,753 reverse-index entries (2,733,892 bytes). Chinese-institution mode fetches both resources together and initializes search only after both succeed.
- Added a post-build initial-HTML guard that rejects inline registry/reverse-index data, including the first and last registry names. The GitHub Pages-path build produces a 101,670-byte initial page and retains only nine list-panel metadata URLs.
- Reverse-search copy now reuses the full `28 所 QS 2027 世界前 200 英国大学 + 1 所专业院校` scope. Fold titles now say `条规则记录`, avoiding a false unique-institution count.
- Parenthesized official abbreviations now resolve as exact search aliases, so UIBE and SUSTech each return one canonical Chinese institution and its complete 29-school evidence set. The normalized-collision inventory is locked to only the reviewed Taizhou and Wuyi English-name pairs; canonical Chinese names remain singular.
- The retryable initialization unit is covered with a failed first request followed by a successful retry. Focused and full verification: 254/254; local and GitHub Pages-path builds pass with Astro check (one pre-existing hint in `scripts/sync-sources.mjs`).
