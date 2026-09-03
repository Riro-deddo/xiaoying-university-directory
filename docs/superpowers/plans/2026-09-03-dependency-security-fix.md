# Dependency Security Fix Implementation Plan

**Goal:** Remove the five current high-severity dependency alerts without changing the published site, directory data, or daily patrol behavior.

**Architecture:** Keep the current direct dependencies unchanged and use pnpm overrides to select the patched transitive releases. A local dependency-graph test protects the minimum safe versions without requiring network access.

**Tech Stack:** pnpm 10, Vitest 4, Astro 7, Playwright 1.62.

## Constraints

- Do not modify page components, styles, copy, university data, source status, or patrol workflows.
- Keep the fix in a separate pull request from repository hardening.
- Do not depend on a live vulnerability service during normal unit tests.

## Tasks

### Task 1: Add the dependency safety contract

- Create `tests/dependency-security.test.mjs`.
- Read the installed dependency graph with `pnpm list --depth Infinity --json`.
- Assert that every installed `fast-uri` is at least 3.1.6 and every installed `nanoid` is at least 3.3.18.
- Run the focused test and confirm it fails against the current lockfile.

### Task 2: Select patched transitive versions

- Add pnpm workspace overrides for `fast-uri@3.1.6` and `nanoid@3.3.18`.
- Regenerate `pnpm-lock.yaml` with pnpm 10.
- Re-run the focused test and confirm it passes.

### Task 3: Verify behavior and publish for review

- Run `pnpm audit --prod --audit-level high` and require zero high or critical advisories.
- Run the standard generated-data build, all unit tests, production build, and desktop/mobile browser tests.
- Confirm the diff contains no site or university-data changes.
- Open a separate pull request and wait for every GitHub check.
