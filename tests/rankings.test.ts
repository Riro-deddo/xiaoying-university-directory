import { describe, expect, it } from 'vitest';
import {
  joinUniversityRankings,
  joinUniversityStatuses,
  loadRankings,
  loadUniversities,
  validateRankings,
} from '../src/lib/data';
import type {
  RankingDataset,
  RankingRecord,
  University,
} from '../src/lib/types';

const REVIEWED_QS_2027_DIGEST = '8ae0050030d5605a82e84f79ef4a8d63532f688e3329b56fa7fb217ab2f7735b';
const REVIEWED_THE_2026_DIGEST = 'c57fbbfa822556d85ffe6a37819d72ac972ab1bd7fccb5b6db3f679d9f410aef';

function canonicalRankingSnapshot(
  records: readonly RankingRecord[],
  provider: RankingRecord['provider'],
  edition: number,
): string {
  return records
    .filter((record) => record.provider === provider && record.edition === edition)
    .toSorted((left, right) => left.universityId < right.universityId ? -1 : left.universityId > right.universityId ? 1 : 0)
    .map((record) => [
      record.universityId,
      record.placement,
      record.displayRank ?? '',
      record.sortRank ?? '',
    ].join('|'))
    .join('\n');
}

async function rankingSnapshotDigest(
  records: readonly RankingRecord[],
  provider: RankingRecord['provider'],
  edition: number,
): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalRankingSnapshot(records, provider, edition)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

const imperial: University = {
  id: 'imperial-college-london',
  nameZh: '帝国理工学院',
  nameEn: 'Imperial College London',
  aliases: ['Imperial'],
  directoryCategory: 'qs-directory',
  qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true },
  state: 'china-requirements',
  officialDomain: 'https://www.imperial.ac.uk',
  sourceIds: [],
};

const rankings: RankingDataset = {
  releases: [{
    provider: 'qs',
    rankingName: 'QS World University Rankings',
    edition: 2027,
    country: 'United Kingdom',
    sourceUrl: 'https://www.topuniversities.com/world-university-rankings?countries=gb',
    attribution: 'QS World University Rankings 2027',
    verifiedAt: '2026-08-01',
  }],
  records: [{
    universityId: imperial.id,
    provider: 'qs',
    edition: 2027,
    placement: 'tied',
    displayRank: '=2',
    sortRank: 2,
  }],
};

describe('validateRankings', () => {
  it('accepts the official QS UK release and Imperial tied at =2', () => {
    expect(validateRankings(rankings, [imperial])).toEqual(rankings);
  });

  it('rejects duplicate university/provider/edition ranking records', () => {
    expect(() => validateRankings({
      ...rankings,
      records: [...rankings.records, rankings.records[0]],
    }, [imperial])).toThrow(/duplicate ranking record/i);
  });

  it('rejects a record for an unregistered release', () => {
    expect(() => validateRankings({
      ...rankings,
      records: [{ ...rankings.records[0], edition: 2026 }],
    }, [imperial])).toThrow(/unregistered release/i);
  });

  it.each([
    ['missing display rank', { ...rankings.records[0], displayRank: undefined }, /displayRank/],
    ['missing sort rank', { ...rankings.records[0], sortRank: undefined }, /sortRank/],
    ['non-positive sort rank', { ...rankings.records[0], sortRank: 0 }, /sortRank/],
  ])('rejects ranked placement with %s', (_label, record, expectedError) => {
    expect(() => validateRankings({ ...rankings, records: [record] }, [imperial])).toThrow(expectedError);
  });

  it.each(['unranked', 'unverified'] as const)('rejects rank fields for %s placements', (placement) => {
    expect(() => validateRankings({
      ...rankings,
      records: [{ ...rankings.records[0], placement, displayRank: '—', sortRank: 2 }],
    }, [imperial])).toThrow(/must NOT be valid/);
    expect(validateRankings({
      ...rankings,
      records: [{
        universityId: imperial.id,
        provider: 'qs',
        edition: 2027,
        placement,
      }],
    }, [{ ...imperial, qsDirectory: { ...imperial.qsDirectory!, current: false } }])).toBeDefined();
  });
});

describe('joinUniversityRankings', () => {
  it('joins Imperial QS display rank without mutating its input', () => {
    const input = joinUniversityStatuses([imperial], [], {});
    const inputCopy = structuredClone(input);

    const [joined] = joinUniversityRankings(input, rankings);

    expect(joined.rankings.qs?.displayRank).toBe('=2');
    expect(input).toEqual(inputCopy);
  });
});

describe('complete UK ranking directory', () => {
  const universities = loadUniversities();
  const rankingData = loadRankings();

  it('contains the 93-school QS 2027 UK directory plus LBS', () => {
    expect(universities.filter((item) => item.directoryCategory === 'qs-directory')).toHaveLength(93);
    expect(universities).toHaveLength(94);
  });

  it('makes the 93 ranked QS records and current main directory the same set', () => {
    const qsDirectoryIds = universities
      .filter((item) => item.directoryCategory === 'qs-directory' && item.qsDirectory?.current)
      .map((item) => item.id)
      .sort();
    const qsSnapshotIds = rankingData.records
      .filter((item) => item.provider === 'qs'
        && item.edition === 2027
        && item.placement !== 'unranked'
        && item.placement !== 'unverified')
      .map((item) => item.universityId)
      .sort();

    expect(qsSnapshotIds).toHaveLength(93);
    expect(qsDirectoryIds).toEqual(qsSnapshotIds);
  });

  it('gives every QS-directory university exactly one THE 2026 state', () => {
    const qsDirectoryIds = universities
      .filter((item) => item.directoryCategory === 'qs-directory')
      .map((item) => item.id)
      .sort();
    const theRecords = rankingData.records.filter((item) => item.provider === 'the' && item.edition === 2026);

    expect(theRecords).toHaveLength(93);
    expect(theRecords.map((item) => item.universityId).sort()).toEqual(qsDirectoryIds);
    expect(qsDirectoryIds.every((id) => universities.find((item) => item.id === id)?.rankings.the?.edition === 2026)).toBe(true);
  });

  it('keeps LBS outside both overall ranking snapshots', () => {
    const lbs = universities.find((item) => item.id === 'london-business-school');

    expect(lbs?.rankings).toEqual({});
    expect(lbs?.specialistRanking).toMatchObject({ edition: 2026, displayRank: '9' });
    expect(rankingData.records.some((item) => item.universityId === 'london-business-school')).toBe(false);
  });

  it('preserves official tied and band display strings for identity-sensitive matches', () => {
    const byUniversityAndProvider = new Map(rankingData.records.map((record) => [
      `${record.universityId}:${record.provider}`,
      record,
    ]));

    expect(byUniversityAndProvider.get('kings-college-london:qs')).toMatchObject({ placement: 'exact', displayRank: '37', sortRank: 37 });
    expect(byUniversityAndProvider.get('university-of-st-andrews:the')).toMatchObject({ placement: 'tied', displayRank: '=162', sortRank: 162 });
    expect(byUniversityAndProvider.get('queens-university-belfast:the')).toMatchObject({ placement: 'tied', displayRank: '=198', sortRank: 198 });
    expect(byUniversityAndProvider.get('soas-university-of-london:the')).toMatchObject({ placement: 'band', displayRank: '401–500', sortRank: 401 });
    expect(byUniversityAndProvider.get('northumbria-university:the')).toMatchObject({ placement: 'band', displayRank: '401–500', sortRank: 401 });
    expect(byUniversityAndProvider.get('city-st-georges-university-of-london:the')).toMatchObject({ placement: 'band', displayRank: '301–350', sortRank: 301 });
  });

  it('locks the reviewed annual QS 2027 snapshot digest until the next official edition review', async () => {
    expect(await rankingSnapshotDigest(rankingData.records, 'qs', 2027)).toBe(REVIEWED_QS_2027_DIGEST);
  });

  it('locks the reviewed annual THE 2026 snapshot digest including QMU unranked empty fields', async () => {
    expect(canonicalRankingSnapshot(rankingData.records, 'the', 2026)).toContain(
      'queen-margaret-university-edinburgh|unranked||',
    );
    expect(await rankingSnapshotDigest(rankingData.records, 'the', 2026)).toBe(REVIEWED_THE_2026_DIGEST);
  });

  it('changes the digest when an un-sampled university receives another schema-valid rank', async () => {
    const changedRecords = rankingData.records.map((record) => record.universityId === 'canterbury-christ-church-university'
      && record.provider === 'qs'
      && record.edition === 2027
      ? { ...record, displayRank: '1402+', sortRank: 1402 }
      : record);

    expect(await rankingSnapshotDigest(changedRecords, 'qs', 2027))
      .not.toBe(await rankingSnapshotDigest(rankingData.records, 'qs', 2027));
  });
});
