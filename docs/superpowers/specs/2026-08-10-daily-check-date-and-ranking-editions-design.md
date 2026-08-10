# Daily Check Date and Ranking Edition Monitoring Design

## Goal

Keep the existing daily official-source review system, but make every successful daily request update the user-visible `最近成功检查` date and deploy that date without being blocked by tests that incorrectly treat operational status as immutable.

Add a separate, review-gated monitor for new QS and THE annual editions. The monitor may notify maintainers, but it must never overwrite ranking data automatically.

## User-facing contract

- The existing directory layout and source rows do not change.
- A source that responds successfully today displays today as `最近成功检查` after the daily deployment.
- A source that fails today retains its previous successful date and may display its existing health warning; a failed request must never be presented as a success.
- Daily checks may update operational metadata such as the successful-check date and health state, but they do not directly overwrite university lists, grade requirements, Chinese summaries, institution identities, rankings, or accepted source facts. When official application content changes, the source enters review; confirmed changes are then published through the reviewed synchronization path.
- QS and THE remain on the currently reviewed editions until a separate reviewed ranking update is merged.

## Current failure

The scheduled workflow ran on 2026-08-09 and 2026-08-10. Link checking and source review completed, but `pnpm test:run` failed and skipped the build, status commit, and Pages deployment.

Two contracts conflict with daily operation:

1. Batch tests require newly registered source statuses to remain exactly `unchecked`, although the checker is expected to add successful request metadata or failure counters.
2. The public directory snapshot test compares mutable status metadata before the build has regenerated `public/generated/universities.json`.

In addition, `scripts/check-sources.mjs` currently excludes `lastSuccessfulAt` from its semantic-change comparison. An unchanged successful page therefore keeps an old tracked success date even when the workflow itself completes.

## Daily-check design

### Status persistence

`lastSuccessfulAt` becomes a persisted operational change. A successful request updates it even when the source body hash is unchanged. The full attempt may continue to record `checkedAt`, validators, final URL, observed hash, health, and failure counters according to the existing source-checker rules.

The accepted `contentHash` remains protected. A daily observation may update `observedContentHash`, but only the existing reviewed synchronization path may promote an observation to the accepted baseline or change extracted facts.

### Official-page change flow

1. If the official page is successfully reached and its reviewed content is unchanged, update `lastSuccessfulAt` and deploy the new date.
2. If the page is reached successfully but the observed content differs from the accepted baseline, update `lastSuccessfulAt`, keep the last accepted university list, requirement, and Chinese summary visible, mark the source as changed, and create or update its review Issue.
3. The review record must identify the source URL and detection time. It records the observed fingerprint when a response body is available; if a previously changed source is temporarily unreachable, it explicitly records that no new fingerprint was captured instead of failing the daily workflow.
4. After the change is confirmed, the existing reviewed synchronization path may update the accepted hash, extracted facts, Chinese summary, and content-review date. The next normal build publishes those confirmed changes.
5. A detected content change is a review event, not a workflow failure; it must not block other successful sources from receiving their new successful-check date.

### Test boundary

Tests must distinguish immutable facts from mutable operational state:

- Continue exact assertions for source ID, official URL, university ownership, scope, parser guard, audit decision, institutions, generated requirements, rankings, and approved content hashes.
- Replace assertions that a live status object must forever equal `{ health: 'unchecked', consecutiveFailures: 0 }` with lifecycle assertions: matching source ID, an allowed health value, a valid non-negative failure count, and no invented accepted hash for link-only sources.
- Preserve the strict joined-public-data contract. Before tests run in CI and in the daily workflow, regenerate public data from the current `status.json` so the tracked operational state and the test input describe the same build.

### Workflow order

The daily workflow remains the existing system and still runs once per day:

1. Install dependencies.
2. Run non-blocking link reachability checks.
3. Run the official-source checker and write the daily audit plus updated operational status.
4. Regenerate public data from that status.
5. Run the full test suite.
6. Run the production build.
7. Create or update source-anomaly Issues when existing thresholds are reached.
8. Commit only `src/data/status.json` when it changed.
9. Deploy the verified artifact to GitHub Pages.

CI also regenerates public data before running tests. This keeps the exact public join test meaningful after a status-only bot commit without expanding the bot's commit permission to generated facts.

External 403, 404, 429, timeout, and 5xx responses continue through the existing consecutive-failure policy and do not by themselves fail the workflow. Unexpected checker exceptions, schema failures, test failures, and build failures remain blocking.

## QS/THE annual-edition monitor

Use a separate lightweight scheduled workflow, running weekly because release dates differ by provider and year.

- Read only the official QS World University Rankings page and official THE World University Rankings page or methodology edition marker.
- Compare the detected edition with the reviewed editions in ranking provenance.
- If no newer edition exists, exit successfully without a commit or deployment.
- If a newer edition exists, create or update one GitHub Issue keyed by provider and edition. Include the official URL and a checklist for UK university identity, exact/tied/band placement, additions, removals, and provenance.
- If an official page is temporarily unavailable or its edition cannot be parsed, emit a notice and exit successfully; do not guess an edition.
- Never scrape and commit the full ranking table, edit `rankings.json`, or deploy a new ranking automatically.

A reviewed ranking update remains a normal pull request that changes the ranking snapshot, provenance, tests, and generated directory output together.

## Testing

The implementation must demonstrate:

1. An unchanged successful source advances `lastSuccessfulAt` and causes a tracked status change.
2. A failed source retains its previous successful date.
3. Daily-compatible status objects pass catalog and batch integrity tests without weakening fact protection.
4. Regenerating public data after a status update places the new successful date in the university source record.
5. The workflow order regenerates public data before tests and still commits only `src/data/status.json`.
6. A simulated newer QS or THE edition creates one review candidate; current, malformed, and temporarily unavailable responses do not modify ranking data or fail the monitor.
7. The full test suite and production build pass, and protected institution, requirement, ranking, and accepted-fact datasets remain unchanged by the daily-check fix.

## Non-goals

- No visual redesign.
- No global audit banner.
- No change from `最近成功检查` to `最近检查`.
- No automatic acceptance of changed university rules.
- No automatic annual ranking overwrite.
- No paid API or always-on personal computer.
