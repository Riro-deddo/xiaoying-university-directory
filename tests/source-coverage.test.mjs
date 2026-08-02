import { describe, expect, it } from 'vitest';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import cohort from '../src/data/qs-2027-top-200-uk.json';
import universities from '../src/data/universities.json';
import sources from '../src/data/sources.json';
import audit from '../src/data/china-rule-audit.json';
import { evaluateCoverage } from '../scripts/report-source-coverage.mjs';

describe('source coverage report', () => {
  it('covers the fixed 28 QS universities and LBS with one reviewed audit row each', () => {
    expect(audit).toHaveLength(29);
    expect(new Set(audit.map((row) => row.universityId)).size).toBe(29);
    expect(audit.filter((row) => row.directoryCategory === 'qs-top-200')).toHaveLength(28);
    expect(audit.filter((row) => row.directoryCategory === 'specialist').map((row) => row.universityId))
      .toEqual(['london-business-school']);
  });

  it('rejects an audit row whose reviewed state or directory category differs from the catalog', () => {
    const alteredAudit = audit.map((row) => row.universityId === 'university-college-london'
      ? { ...row, expectedState: 'not-public' }
      : row);
    const result = evaluateCoverage({ cohort, universities, sources, audit: alteredAudit });

    expect(result.failures).toContain('audit state mismatch: university-college-london');
  });

  it('rejects an unapproved specialist even when it has an official linked source', () => {
    const lbs = universities.find((item) => item.id === 'london-business-school');
    const lbsSource = sources.find((item) => item.id === 'lbs-mim-entry');
    const result = evaluateCoverage({
      cohort,
      universities: [...universities, { ...lbs, id: 'unapproved-specialist', sourceIds: ['unapproved-specialist-source'] }],
      sources: [...sources, { ...lbsSource, id: 'unapproved-specialist-source', universityId: 'unapproved-specialist' }],
      audit,
    });

    expect(result.failures).toContain('directory scope must equal the QS cohort plus London Business School');
  });

  it.each([
    ['missing university', { universities: universities.slice(1) }],
    ['missing source', { sources: sources.slice(1) }],
    ['duplicate source ID', { sources: [...sources, sources[0]] }],
    ['unregistered source domain', { sources: [{ ...sources[0], url: 'https://untrusted.example/china' }, ...sources.slice(1)] }],
    ['orphan source', { sources: [...sources, { ...sources[0], id: 'orphan-source', universityId: 'not-in-cohort' }] }],
    ['unreferenced source', { sources: [...sources, { ...sources[0], id: 'unreferenced-source' }] }],
  ])('reports %s as an integrity failure', (_label, override) => {
    const result = evaluateCoverage({ cohort, universities, sources, audit, ...override });
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it.each([
    ['missing university', { universities: universities.slice(1) }],
    ['missing source', { sources: sources.slice(1) }],
    ['duplicate source ID', { sources: [...sources, sources[0]] }],
    ['unregistered source domain', { sources: [{ ...sources[0], url: 'https://untrusted.example/china' }, ...sources.slice(1)] }],
    ['orphan source', { sources: [...sources, { ...sources[0], id: 'orphan-source', universityId: 'not-in-cohort' }] }],
  ])('exits nonzero when a data-root contains %s', async (_label, override) => {
    const root = await mkdtemp(join(tmpdir(), 'source-coverage-'));
    const dataRoot = join(root, 'data');
    await cp(resolve('src/data'), dataRoot, { recursive: true });
    await Promise.all(Object.entries(override).map(([name, value]) => writeFile(join(dataRoot, `${name}.json`), `${JSON.stringify(value)}\n`)));
    const result = spawnSync(process.execPath, ['scripts/report-source-coverage.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, SOURCE_COVERAGE_DATA_ROOT: dataRoot },
      encoding: 'utf8',
    });
    await rm(root, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Coverage failure');
  });

  it.each([
    ['missing audit row', audit.slice(1), 'audit rows must cover every directory university exactly once'],
    ['duplicate audit row', [...audit, audit[0]], 'duplicate audit row: imperial-college-london'],
  ])('reports %s as an integrity failure', (_label, alteredAudit, expectedFailure) => {
    const result = evaluateCoverage({ cohort, universities, sources, audit: alteredAudit });
    expect(result.failures).toContain(expectedFailure);
  });

  it('reports reviewed scope and state counts from the audit matrix', () => {
    expect(evaluateCoverage({ cohort, universities, sources, audit }).counts).toMatchObject({
      qsUniversities: 28,
      specialistUniversities: 1,
      fullPublicLists: 9,
      ruleOnlyUniversities: 16,
      noPublicListRecords: 4,
    });
  });
});
