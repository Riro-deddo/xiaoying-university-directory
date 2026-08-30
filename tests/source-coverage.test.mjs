import { describe, expect, it } from 'vitest';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import cohort from '../src/data/qs-2027-top-200-uk.json';
import rankings from '../src/data/rankings.json';
import universities from '../src/data/universities.json';
import sources from '../src/data/sources.json';
import audit from '../src/data/china-rule-audit.json';
import baseline from './fixtures/pending-china-audit-baseline.json';
import { evaluateCoverage } from '../scripts/report-source-coverage.mjs';

const batchReviewedIds = new Set([
  'loughborough-university', 'university-of-strathclyde', 'university-of-surrey', 'university-of-sussex',
  'university-of-leicester', 'swansea-university', 'heriot-watt-university', 'brunel-university-of-london',
  'birkbeck-university-of-london', 'city-st-georges-university-of-london', 'oxford-brookes-university',
  'university-of-kent', 'aston-university', 'university-of-essex', 'university-of-dundee',
  'soas-university-of-london', 'royal-holloway-university-of-london', 'university-of-bradford',
  'university-of-huddersfield', 'northumbria-university', 'university-of-stirling', 'bangor-university',
  'university-of-hull', 'coventry-university',
  'ulster-university', 'manchester-metropolitan-university', 'nottingham-trent-university',
  'university-of-portsmouth', 'kingston-university-london', 'university-of-plymouth',
  'goldsmiths-university-of-london', 'university-of-the-west-of-england', 'university-of-greenwich',
  'aberystwyth-university', 'bournemouth-university', 'edinburgh-napier-university', 'keele-university',
  'de-montfort-university', 'liverpool-john-moores-university', 'university-of-hertfordshire',
  'university-of-lincoln', 'university-of-westminster', 'london-south-bank-university',
  'middlesex-university', 'university-of-brighton', 'anglia-ruskin-university',
  'birmingham-city-university', 'glasgow-caledonian-university', 'leeds-beckett-university',
  'robert-gordon-university', 'sheffield-hallam-university', 'university-of-lancashire',
  'university-of-derby', 'canterbury-christ-church-university',
  'university-of-aberdeen', 'university-of-east-anglia', 'london-metropolitan-university',
  'university-of-roehampton', 'university-of-salford', 'university-of-wolverhampton',
  'queen-margaret-university-edinburgh', 'university-of-northampton', 'university-of-south-wales',
]);

describe('source coverage report', () => {
  it('covers the real complete directory from authoritative current ranking metadata', () => {
    expect(evaluateCoverage({ cohort, rankings, universities, sources, audit }).failures).toEqual([]);
  });

  it('requires authoritative current ranking metadata instead of falling back to the legacy discovery cohort', () => {
    expect(() => evaluateCoverage({ cohort, universities, sources, audit }))
      .toThrow('rankings are required for source coverage');
  });

  it('exits successfully for the real complete directory data root', () => {
    const result = spawnSync(process.execPath, ['scripts/report-source-coverage.mjs'], {
      cwd: process.cwd(), encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim().split(/\r?\n/u)).toEqual([
      'Cohort universities: 28',
      'QS universities: 93',
      'Specialist universities: 8',
      'Full public lists: 11',
      'Rule-only universities: 80',
      'No-public-list records: 8',
      'Parser-enabled sources: 13',
      'Link-only sources: 92',
    ]);
  });
  it('covers 93 QS universities and eight approved specialists with one audit row each', () => {
    expect(audit).toHaveLength(101);
    expect(new Set(audit.map((row) => row.universityId)).size).toBe(101);
    expect(audit.filter((row) => row.directoryCategory === 'qs-directory')).toHaveLength(93);
    expect(audit.filter((row) => row.directoryCategory === 'specialist').map((row) => row.universityId).sort())
      .toEqual([
        'cranfield-university',
        'institute-of-cancer-research-london',
        'liverpool-school-of-tropical-medicine',
        'london-business-school',
        'london-school-of-hygiene-and-tropical-medicine',
        'royal-college-of-art',
        'royal-college-of-music',
        'royal-veterinary-college',
      ]);
  });

  it('preserves the feature-start baseline while recording the first four reviewed batches', () => {
    expect(baseline.pendingUniversityIds).toHaveLength(65);
    expect(universities.filter((university) => university.state === 'pending').map((university) => university.id))
      .toEqual(baseline.pendingUniversityIds.filter((id) => !batchReviewedIds.has(id)));
    expect(baseline.nonTargetAuditRows).toHaveLength(36);
    const preservedBaselineSources = baseline.sourceConfigs.filter((source) => source.id !== 'leeds-china');
    const preExistingSourceIds = new Set(preservedBaselineSources.map((source) => source.id));
    expect(sources.filter((source) => preExistingSourceIds.has(source.id))).toEqual(preservedBaselineSources);
    expect(baseline.reviewedRequirementCount).toBe(5754);
    expect(baseline.requirementsSha256).toBe('f932710580077d2bf84c0fccffc239e4ed9c3cba4fdb807c6a58ad2b1c802f00');
  });

  it('marks every audit row with the required review lifecycle status', () => {
    expect(audit.filter((row) => row.reviewStatus === 'reviewed')).toHaveLength(99);
    expect(audit.filter((row) => row.reviewStatus === 'blocked')).toHaveLength(2);
    expect(audit.filter((row) => row.reviewStatus === 'unreviewed')).toHaveLength(0);
    expect(audit.filter((row) => row.universityId !== 'university-of-leeds'
      && baseline.nonTargetAuditRows.some((baselineRow) => baselineRow.universityId === row.universityId))
      .map((row) => row.universityId)).toEqual(baseline.nonTargetAuditRows
      .filter((row) => row.universityId !== 'university-of-leeds')
      .map((row) => row.universityId));
    expect(audit.filter((row) => row.reviewStatus === 'unreviewed').map((row) => row.universityId)).toEqual([]);
  });

  it('rejects an audit lifecycle status outside the supported enum', () => {
    const alteredAudit = audit.map((row) => ({ ...row, reviewStatus: row.universityId === 'loughborough-university' ? 'skipped' : row.reviewStatus }));
    const result = evaluateCoverage({ cohort, rankings, universities, sources, audit: alteredAudit });

    expect(result.failures).toEqual([
      expect.stringMatching(/^China rule audit data validation failed:/u),
    ]);
  });

  it('accepts the completed audit with no unreviewed targets', () => {
    const result = evaluateCoverage({ cohort, rankings, universities, sources, audit });

    expect(result.failures).toEqual([]);
  });

  it('accepts official sibling subdomains after normalizing a www root domain', () => {
    const result = evaluateCoverage({ cohort, rankings, universities, sources, audit });

    expect(result.failures).toEqual([]);
  });

  it('accepts Greenwich\'s explicitly reviewed first-party gre.ac.uk China page without changing the catalog domain', () => {
    const result = evaluateCoverage({ cohort, rankings, universities, sources, audit });

    expect(result.failures).toEqual([]);
  });

  it.each([
    'https://gre.ac.uk.evil.test/international/countries/china',
    'https://evil.gre.ac.uk/international/countries/china',
  ])('rejects a Greenwich lookalike alias: %s', (url) => {
    const result = evaluateCoverage({
      cohort,
      rankings,
      universities,
      sources: sources.map((source) => source.id === 'greenwich-china-requirements' ? { ...source, url } : source),
      audit,
    });

    expect(result.failures).toEqual(['unregistered source domain: greenwich-china-requirements']);
  });

  it('does not permit Greenwich\'s first-party alias to be reused by another university', () => {
    const result = evaluateCoverage({
      cohort,
      rankings,
      universities,
      sources: sources.map((source) => source.id === 'greenwich-china-requirements'
        ? { ...source, universityId: 'university-of-the-west-of-england' }
        : source),
      audit,
    });

    expect(result.failures).toEqual([
      'source belongs to another university: greenwich-china-requirements',
      'unreferenced source: greenwich-china-requirements',
      'unregistered source domain: greenwich-china-requirements',
    ]);
  });

  it.each([
    'https://hud.ac.uk.evil.test/how-to-apply/entry-requirements',
    'https://evil-hud.ac.uk/how-to-apply/entry-requirements',
  ])('rejects a lookalike sibling domain: %s', (url) => {
    const result = evaluateCoverage({
      cohort,
      rankings,
      universities,
      sources: sources.map((source) => source.id === 'huddersfield-china-requirements' ? { ...source, url } : source),
      audit,
    });

    expect(result.failures).toEqual(['unregistered source domain: huddersfield-china-requirements']);
  });

  it('allows a blocked pending target with a finding to remain source-free', () => {
    const university = universities.find((item) => item.id === 'university-of-the-arts-london');
    const auditRow = audit.find((row) => row.universityId === university.id);

    expect(university).toMatchObject({ state: 'pending', sourceIds: [] });
    expect(auditRow).toMatchObject({ expectedState: 'pending', reviewStatus: 'blocked' });
    expect(auditRow.finding).not.toBe('');
    expect(sources.some((source) => source.universityId === university.id)).toBe(false);
    expect(evaluateCoverage({ cohort, rankings, universities, sources, audit }).failures).toEqual([]);
  });

  it('rejects a blocked lifecycle on an official-list catalog record', () => {
    const alteredAudit = audit.map((row) => row.universityId === 'loughborough-university'
      ? { ...row, reviewStatus: 'blocked' }
      : row);

    expect(evaluateCoverage({ cohort, rankings, universities, sources, audit: alteredAudit }).failures)
      .toEqual(['blocked audit row must remain pending: loughborough-university']);
  });

  it('requires every non-pending audit row to be reviewed', () => {
    const alteredAudit = audit.map((row) => row.universityId === 'loughborough-university'
      ? { ...row, reviewStatus: 'unreviewed' }
      : row);

    expect(evaluateCoverage({ cohort, rankings, universities, sources, audit: alteredAudit }).failures)
      .toEqual(['non-pending audit row must be reviewed: loughborough-university']);
  });

  it('rejects a reviewed lifecycle on a pending catalog record', () => {
    const alteredAudit = audit.map((row) => row.universityId === 'university-of-the-arts-london'
      ? { ...row, reviewStatus: 'reviewed' }
      : row);

    expect(evaluateCoverage({ cohort, rankings, universities, sources, audit: alteredAudit }).failures)
      .toEqual(['reviewed audit row cannot remain pending: university-of-the-arts-london']);
  });

  it('rejects an audit row whose reviewed state or directory category differs from the catalog', () => {
    const alteredAudit = audit.map((row) => row.universityId === 'university-college-london'
      ? { ...row, expectedState: 'not-public' }
      : row);
    const result = evaluateCoverage({ cohort, rankings, universities, sources, audit: alteredAudit });

    expect(result.failures).toEqual(['audit state mismatch: university-college-london']);
  });

  it('rejects an audit row whose reviewed directory category differs from the catalog', () => {
    const alteredAudit = audit.map((row) => row.universityId === 'university-college-london'
      ? { ...row, directoryCategory: 'specialist' }
      : row);
    const result = evaluateCoverage({ cohort, rankings, universities, sources, audit: alteredAudit });

    expect(result.failures).toEqual(['audit directory category mismatch: university-college-london']);
  });

  it('rejects an unapproved specialist even when it has an official linked source', () => {
    const lbs = universities.find((item) => item.id === 'london-business-school');
    const lbsSource = sources.find((item) => item.id === 'lbs-mim-entry');
    const result = evaluateCoverage({
      cohort,
      rankings,
      universities: [...universities, { ...lbs, id: 'unapproved-specialist', sourceIds: ['unapproved-specialist-source'] }],
      sources: [...sources, { ...lbsSource, id: 'unapproved-specialist-source', universityId: 'unapproved-specialist' }],
      audit,
    });

    expect(result.failures).toEqual(['directory scope must equal the QS cohort plus the approved specialist institutions']);
  });

  it.each([
    ['missing university', { universities: universities.slice(1) }, [
      'directory scope must equal the QS cohort plus the approved specialist institutions',
      'audit university is unregistered: imperial-college-london',
      'source university is unregistered: imperial-china',
    ]],
    ['missing source', { sources: sources.slice(1) }, ['unregistered source: imperial-college-london/imperial-china']],
    ['duplicate source ID', { sources: [...sources, sources[0]] }, ['duplicate source IDs']],
    ['unregistered source domain', { sources: [{ ...sources[0], url: 'https://untrusted.example/china' }, ...sources.slice(1)] }, [
      'unregistered source domain: imperial-china',
    ]],
    ['orphan source', { sources: [...sources, { ...sources[0], id: 'orphan-source', universityId: 'not-in-cohort' }] }, [
      'source university is unregistered: orphan-source',
    ]],
    ['unreferenced source', { sources: [...sources, { ...sources[0], id: 'unreferenced-source' }] }, [
      'unreferenced source: unreferenced-source',
    ]],
  ])('reports %s as an integrity failure', (_label, override, expectedFailures) => {
    const result = evaluateCoverage({ cohort, rankings, universities, sources, audit, ...override });
    expect(result.failures).toEqual(expectedFailures);
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
    ['an empty finding', (rows) => rows.map((row) => row.universityId === 'university-of-exeter'
      ? { ...row, finding: '' }
      : row)],
    ['an invalid review date', (rows) => rows.map((row) => row.universityId === 'university-of-exeter'
      ? { ...row, reviewDate: '2026/08/02' }
      : row)],
  ])('exits nonzero when a data-root contains %s in the audit matrix', async (_label, mutateAudit) => {
    const root = await mkdtemp(join(tmpdir(), 'source-coverage-audit-'));
    const dataRoot = join(root, 'data');
    const auditMatchingCurrentCatalog = audit.map((row) => ({
      ...row,
      expectedState: universities.find((university) => university.id === row.universityId).state,
    }));
    await cp(resolve('src/data'), dataRoot, { recursive: true });
    await writeFile(join(dataRoot, 'china-rule-audit.json'), `${JSON.stringify(mutateAudit(auditMatchingCurrentCatalog))}\n`);
    const result = spawnSync(process.execPath, ['scripts/report-source-coverage.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, SOURCE_COVERAGE_DATA_ROOT: dataRoot },
      encoding: 'utf8',
    });
    await rm(root, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('China rule audit data validation failed');
  });

  it.each([
    ['missing audit row', audit.slice(1), 'audit rows must cover every directory university exactly once'],
    ['duplicate audit row', [...audit, audit[0]], 'duplicate audit row: imperial-college-london'],
  ])('reports %s as an integrity failure', (_label, alteredAudit, expectedFailure) => {
    const result = evaluateCoverage({ cohort, rankings, universities, sources, audit: alteredAudit });
    const expectedFailures = _label === 'duplicate audit row'
      ? [expectedFailure, 'audit rows must cover every directory university exactly once']
      : [expectedFailure];
    expect(result.failures).toEqual(expectedFailures);
  });

  it('reports reviewed scope and state counts from the audit matrix', () => {
    expect(evaluateCoverage({ cohort, rankings, universities, sources, audit }).counts).toMatchObject({
      qsUniversities: 93,
      specialistUniversities: 8,
      fullPublicLists: 11,
      ruleOnlyUniversities: 80,
      noPublicListRecords: 8,
    });
  });
});
