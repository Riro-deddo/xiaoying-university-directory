# Institution Search Identity Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce full-registry normalized search collisions from 22 keys to the two reviewed Taizhou University and Wuyi University ambiguities without losing official-source evidence.

**Architecture:** Add one deterministic reviewed registry migration at the synchronizer boundary. It rewrites duplicate institution references, merges approved historical identities, applies reviewed canonical-name disambiguation, and corrects six parser-artifact facts before normal reconciliation; generated data is then refreshed through the existing atomic guarded sync.

**Tech Stack:** Node.js ESM, Vitest, JSON data registry, Astro.

## Global Constraints

- Do not modify or stage Task 7 page, public-asset, presentation, search, or initial-HTML work.
- Preserve raw official fact names for C, D, and E decisions.
- Taizhou University and Wuyi University are the only permitted normalized registry collisions.
- Use exactly one guarded official-source sync after tests prove the migration behavior.

---

### Task 1: Specify registry migration behavior

**Files:**
- Test: `tests/sync-sources.test.mjs`
- Test: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: `syncRegisteredSources(options)` and current JSON registry.
- Produces: failing assertions for reference rewrites, canonical names, collision inventory, fact preservation, and migration idempotence.

- [x] **Step 1: Write failing tests** for representative A/B merges, reviewed C/D/E names, exact remaining collision keys, preserved Gannan tiers, and repeat-sync idempotence.
- [x] **Step 2: Run focused tests** and confirm failures arise from the current 22 collision keys and orphan duplicate IDs.

### Task 2: Implement deterministic reviewed reconciliation

**Files:**
- Modify: `scripts/sync-sources.mjs`

**Interfaces:**
- Consumes: institutions and requirements loaded at the sync boundary.
- Produces: migrated institutions and references before source extraction, plus corrected B-category parser facts.

- [x] **Step 1: Implement the minimal migration** using literal reviewed ID redirects, merge policies, canonical overrides, alias removals, and parser corrections.
- [x] **Step 2: Run focused tests** until all migration and idempotence assertions pass.

### Task 3: Persist and verify generated data

**Files:**
- Modify: `src/data/institutions.json`
- Modify: `src/data/generated/requirements.json`
- Modify: `src/data/generated/reverse-index.json`
- Modify: `src/data/status.json`
- Modify: `docs/superpowers/task-6-report.md`
- Modify: `.superpowers/sdd/2026-08-02-comprehensive-china-list-audit-and-lbs/task-7-report.md`

**Interfaces:**
- Consumes: guarded synchronizer output.
- Produces: collision-free registry except the two reviewed ambiguity keys and evidence report.

- [x] **Step 1: Run one guarded sync and rebuild the reverse index.**
- [x] **Step 2: Run focused tests, full tests, Astro check/build, and source coverage.**
- [x] **Step 3: Record before/after registry counts, merged references, preserved Gannan tiers, and remaining collision keys.**
- [x] **Step 4: Stage only scoped files and commit `fix: reconcile institution search identities`.**
