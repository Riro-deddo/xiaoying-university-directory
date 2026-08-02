import { describe, expect, it } from 'vitest';
import institutions from '../src/data/institutions.json';
import requirements from '../src/data/generated/requirements.json';
import reverseIndex from '../src/data/generated/reverse-index.json';
import sources from '../src/data/sources.json';
import { deriveEvidence } from '../src/lib/evidence';
import type { OfficialSourceConfig, RequirementFact, SourceStatus } from '../src/lib/types';

const universitySource: OfficialSourceConfig = {
  id: 'public-list', universityId: 'example-university', labelZh: '公开名单', url: 'https://example.test/list',
  kind: 'official-list', scope: 'university', scopeZh: '学校层面', parser: { mode: 'html-list', selector: '.row', defaultTierOfficial: 'A', guard: { minimumRecords: 0, maximumRecords: 10, maximumRemovalRatio: 0 } },
  institutionRule: {
    type: 'grade-threshold',
    summaryZh: '院校决定成绩门槛。',
    listedMeaningZh: '名单内使用门槛 A。',
    unlistedMeaningZh: '名单外认可院校使用门槛 B。',
  },
};
const facultySource: OfficialSourceConfig = {
  ...universitySource, id: 'faculty-list', kind: 'faculty-page', scope: 'faculty', scopeZh: '商学院',
};
const universityFact: RequirementFact = {
  id: 'public-list-example', universityId: 'example-university', sourceId: 'public-list', institutionId: 'example-institution',
  tierOfficial: 'Group A', scoreOfficial: '85%', scope: 'university', scopeZh: '学校层面', cycle: '2026/27',
  extractedAt: '2026-08-01T10:00:00.000Z', contentHash: 'hash',
};
const facultyFact: RequirementFact = { ...universityFact, id: 'faculty-list-example', sourceId: 'faculty-list', scope: 'faculty', scopeZh: '商学院' };
const ok: SourceStatus = { sourceId: 'public-list', health: 'ok', lastSuccessfulAt: '2026-08-01T10:00:00.000Z' };

describe('deriveEvidence', () => {
  it('uses anomaly states ahead of a stale positive fact', () => {
    expect(deriveEvidence({ fact: universityFact, source: universitySource, status: { ...ok, health: 'changed' } }).state).toBe('source-changed');
    expect(deriveEvidence({ fact: universityFact, source: universitySource, status: { ...ok, health: 'unavailable' } }).state).toBe('source-unavailable');
  });

  it('returns positive university-wide evidence with official traceability', () => {
    expect(deriveEvidence({ fact: universityFact, source: universitySource, status: ok })).toMatchObject({
      state: 'official-match', tierOfficial: 'Group A', scoreOfficial: '85%', scopeZh: '学校层面', cycle: '2026/27', sourceId: 'public-list', lastSuccessfulAt: '2026-08-01T10:00:00.000Z',
    });
  });

  it('isolates faculty evidence from university-wide evidence', () => {
    expect(deriveEvidence({ fact: facultyFact, source: facultySource, status: ok })).toMatchObject({ state: 'faculty-match', scopeZh: '商学院' });
  });

  it('labels absence in a healthy public list without making a rejection decision', () => {
    const result = deriveEvidence({ fact: undefined, source: universitySource, status: ok });
    expect(result).toMatchObject({ state: 'not-found-in-public-list', sourceId: 'public-list' });
    expect(result).not.toHaveProperty('eligibility');
  });

  it('returns no-public-list when the available source is not a university-wide official list', () => {
    expect(deriveEvidence({ fact: undefined, source: facultySource, status: ok }).state).toBe('no-public-list');
  });

  it('does not claim a link-only official-list source was checked against a parsed list', () => {
    const linkOnlyPublicSource: OfficialSourceConfig = {
      ...universitySource,
      id: 'link-only-public-list',
      parser: { mode: 'link-only', guard: { minimumRecords: 0, maximumRecords: 1, maximumRemovalRatio: 0 } },
    };

    expect(deriveEvidence({ fact: undefined, source: linkOnlyPublicSource, status: ok })).toMatchObject({
      state: 'no-public-list',
      sourceId: 'link-only-public-list',
    });
  });

  it('carries reviewed rule meaning into positive and negative structured evidence', () => {
    const match = deriveEvidence({ fact: universityFact, source: universitySource, status: ok });
    const miss = deriveEvidence({ source: universitySource, status: ok });

    expect(match.institutionRule).toEqual(universitySource.institutionRule);
    expect(miss.institutionRule).toEqual(universitySource.institutionRule);
  });

  it('keeps link-only rule sources neutral even when an unlisted meaning exists', () => {
    const source: OfficialSourceConfig = {
      ...universitySource,
      parser: { mode: 'link-only', guard: { minimumRecords: 0, maximumRecords: 1, maximumRemovalRatio: 0 } },
    };

    expect(deriveEvidence({ source, status: ok }).state).toBe('no-public-list');
  });
});

describe('reverse index generation', () => {
  it('contains only traceable positive facts', () => {
    const index = reverseIndex as Array<Record<string, unknown>>;
    const sourceIds = new Set(sources.map((source) => source.id));
    const institutionIds = new Set(institutions.map((institution) => institution.id));
    const factPairs = new Set(requirements.map((fact) => `${fact.institutionId}\u0000${fact.universityId}\u0000${fact.sourceId}`));

    expect(index).toHaveLength(requirements.length);
    expect(index.every((entry) =>
      entry.evidenceState === 'official-match' || entry.evidenceState === 'faculty-match',
    )).toBe(true);
    expect(index.every((entry) =>
      institutionIds.has(entry.institutionId as string) &&
      sourceIds.has(entry.sourceId as string) &&
      factPairs.has(`${entry.institutionId}\u0000${entry.universityId}\u0000${entry.sourceId}`) &&
      typeof entry.tierOfficial === 'string' && typeof entry.scopeZh === 'string' && typeof entry.lastSuccessfulAt === 'string',
    )).toBe(true);
  });
});
