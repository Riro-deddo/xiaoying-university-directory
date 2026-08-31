import { describe, expect, it } from 'vitest';
import {
  loadMastersScholarshipEntries,
  validateMastersScholarshipEntries,
  validateUniversities,
} from '../src/lib/data';
import type { MastersScholarshipEntry, University } from '../src/lib/types';
import { parseMastersScholarshipResearch } from './helpers/masters-scholarship-research';

const universities: University[] = validateUniversities([{
  id: 'imperial-college-london',
  nameZh: '帝国理工学院',
  nameEn: 'Imperial College London',
  aliases: ['Imperial'],
  directoryCategory: 'qs-directory',
  qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true },
  state: 'china-requirements',
  officialDomain: 'https://www.imperial.ac.uk',
  sourceIds: [],
}]);

const valid: MastersScholarshipEntry[] = [{
  universityId: 'imperial-college-london',
  entryState: 'available',
  reviewedAt: '2026-08-31',
  links: [{
    id: 'scholarships-imperial-college-london-directory',
    universityId: 'imperial-college-london',
    labelZh: '查看硕士奖学金官网',
    scopeZh: '硕士奖学金官方目录',
    kind: 'masters-directory',
    requiresFiltering: false,
    url: 'https://www.imperial.ac.uk/study/fees-and-funding/postgraduate/',
    pageTitle: 'Postgraduate fees and funding',
    reviewedAt: '2026-08-31',
    requiredText: ['Postgraduate', 'Scholarships'],
    monitorMode: 'page-identity',
  }],
}];

const greenwichUniversities: University[] = validateUniversities([{
  id: 'university-of-greenwich',
  nameZh: '格林威治大学',
  nameEn: 'University of Greenwich',
  aliases: ['Greenwich'],
  directoryCategory: 'qs-directory',
  qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true },
  state: 'china-requirements',
  officialDomain: 'https://www.greenwich.ac.uk',
  sourceIds: [],
}]);

const greenwichAliasEntry: MastersScholarshipEntry[] = [{
  universityId: 'university-of-greenwich',
  entryState: 'available',
  reviewedAt: '2026-08-31',
  links: [{
    ...valid[0].links[0],
    id: 'scholarships-university-of-greenwich-postgraduate-funding',
    universityId: 'university-of-greenwich',
    kind: 'postgraduate-funding',
    requiresFiltering: true,
    url: 'https://www.gre.ac.uk/finance/funding-your-studies/scholarships-and-bursaries',
  }],
}];

describe('masters scholarship entry registry', () => {
  it('loads the independent production registry after the third reviewed batch', () => {
    const loaded = loadMastersScholarshipEntries();

    expect(loaded).toHaveLength(76);
    expect(loaded.filter((entry) => entry.entryState === 'available')).toHaveLength(75);
    expect(loaded.filter((entry) => entry.entryState === 'no-public-entry')).toHaveLength(1);
    expect(loaded.flatMap((entry) => entry.links)).toHaveLength(79);
    expect(loaded[0]?.universityId).toBe('imperial-college-london');
    expect(loaded.at(-1)?.universityId).toBe('de-montfort-university');
  });

  it('accepts a complete official scholarship entry', () => {
    expect(validateMastersScholarshipEntries(valid, universities)).toEqual(valid);
  });

  it('accepts the directly verified University of Greenwich scholarship alias', () => {
    expect(validateMastersScholarshipEntries(greenwichAliasEntry, greenwichUniversities))
      .toEqual(greenwichAliasEntry);
  });

  it.each([
    'https://www.gre.ac.uk.evil.test/finance/funding-your-studies/scholarships-and-bursaries',
    'https://www.notgre.ac.uk/finance/funding-your-studies/scholarships-and-bursaries',
  ])('rejects University of Greenwich scholarship alias lookalike %s', (url) => {
    expect(() => validateMastersScholarshipEntries([{
      ...greenwichAliasEntry[0],
      links: [{ ...greenwichAliasEntry[0].links[0], url }],
    }], greenwichUniversities)).toThrow(/official domain/i);
  });

  it('accepts a reviewed no-public-entry group with no action links', () => {
    const unavailable: MastersScholarshipEntry[] = [{
      universityId: 'imperial-college-london',
      entryState: 'no-public-entry',
      reviewedAt: '2026-08-31',
      links: [],
    }];

    expect(validateMastersScholarshipEntries(unavailable, universities)).toEqual(unavailable);
  });

  it('rejects duplicate university groups', () => {
    expect(() => validateMastersScholarshipEntries([...valid, ...valid], universities))
      .toThrow(/duplicate university/i);
  });

  it('rejects an available entry with zero links', () => {
    expect(() => validateMastersScholarshipEntries([{ ...valid[0], links: [] }], universities))
      .toThrow(/schema/i);
  });

  it('rejects an available entry with four links', () => {
    const links = Array.from({ length: 4 }, (_, index) => ({
      ...valid[0].links[0],
      id: `scholarships-imperial-college-london-${index}`,
    }));
    expect(() => validateMastersScholarshipEntries([{ ...valid[0], links }], universities))
      .toThrow(/schema/i);
  });

  it('rejects a no-public-entry group with an action link', () => {
    expect(() => validateMastersScholarshipEntries([{
      ...valid[0],
      entryState: 'no-public-entry',
    }], universities)).toThrow(/schema/i);
  });

  it('rejects duplicate link IDs across the registry', () => {
    expect(() => validateMastersScholarshipEntries([{
      ...valid[0],
      links: [...valid[0].links, { ...valid[0].links[0] }],
    }], universities)).toThrow(/duplicate/i);
  });

  it('rejects a link assigned to another university', () => {
    expect(() => validateMastersScholarshipEntries([{
      ...valid[0],
      links: [{ ...valid[0].links[0], universityId: 'another-university' }],
    }], universities)).toThrow(/match/i);
  });

  it('rejects a link ID without the university-specific scholarship prefix', () => {
    expect(() => validateMastersScholarshipEntries([{
      ...valid[0],
      links: [{ ...valid[0].links[0], id: 'scholarships-imperial-directory' }],
    }], universities)).toThrow(/prefix/i);
  });

  it.each([
    ['non-HTTPS URLs', { url: 'http://www.imperial.ac.uk/postgraduate/' }],
    ['official-domain lookalikes', { url: 'https://www.imperial.ac.uk.evil.test/postgraduate/' }],
    ['duplicate required text', { requiredText: ['Postgraduate', 'Postgraduate'] }],
    ['unknown kinds', { kind: 'bursary' }],
    ['unfiltered postgraduate funding', { kind: 'postgraduate-funding', requiresFiltering: false }],
  ])('rejects %s', (_label, change) => {
    expect(() => validateMastersScholarshipEntries([{
      ...valid[0],
      links: [{ ...valid[0].links[0], ...change }],
    }], universities)).toThrow(/schema|official domain/i);
  });
});

describe('masters scholarship research evidence table parser', () => {
  const header = '| universityId | evidenceId | official URL | final URL | kind | requiresFiltering | page title | requiredText 1 | requiredText 2 | reviewedAt | decision note |';
  const separator = '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const row = '| imperial-college-london | scholarships-imperial-college-london-directory | https://www.imperial.ac.uk/study/fees-and-funding/postgraduate/ | https://www.imperial.ac.uk/study/fees-and-funding/postgraduate/ | masters-directory | false | Postgraduate fees and funding | Postgraduate | Scholarships | 2026-08-31 | Official directory &#124; postgraduate funding |';
  const negativeRow = '| imperial-college-london | evidence-imperial-college-london-no-public-entry | https://www.imperial.ac.uk/study/fees-and-funding/ | https://www.imperial.ac.uk/study/fees-and-funding/ | no-public-entry | false | Fees and funding | Taught course students | Funding assistance | 2026-08-31 | No public masters scholarship entry found |';

  it('parses a complete official scholarship research row', () => {
    expect(parseMastersScholarshipResearch([header, separator, row].join('\n'))).toEqual([{
      universityId: 'imperial-college-london',
      evidenceId: 'scholarships-imperial-college-london-directory',
      officialUrl: 'https://www.imperial.ac.uk/study/fees-and-funding/postgraduate/',
      finalUrl: 'https://www.imperial.ac.uk/study/fees-and-funding/postgraduate/',
      kind: 'masters-directory',
      requiresFiltering: false,
      pageTitle: 'Postgraduate fees and funding',
      requiredText: ['Postgraduate', 'Scholarships'],
      reviewedAt: '2026-08-31',
      decisionNote: 'Official directory | postgraduate funding',
    }]);
  });

  it('parses official negative evidence without turning it into an action link', () => {
    expect(parseMastersScholarshipResearch([header, separator, negativeRow].join('\n'))).toEqual([{
      universityId: 'imperial-college-london',
      evidenceId: 'evidence-imperial-college-london-no-public-entry',
      officialUrl: 'https://www.imperial.ac.uk/study/fees-and-funding/',
      finalUrl: 'https://www.imperial.ac.uk/study/fees-and-funding/',
      kind: 'no-public-entry',
      requiresFiltering: false,
      pageTitle: 'Fees and funding',
      requiredText: ['Taught course students', 'Funding assistance'],
      reviewedAt: '2026-08-31',
      decisionNote: 'No public masters scholarship entry found',
    }]);
  });

  it.each([
    ['wrong cell count', '| imperial-college-london | scholarships-imperial-college-london-directory |'],
    ['invalid boolean', row.replace(' | false | ', ' | no | ')],
    ['unknown kind', row.replace(' | masters-directory | ', ' | bursary | ')],
    ['non-evidence ID for a negative finding', negativeRow.replace('evidence-imperial-college-london-', 'scholarships-imperial-college-london-')],
  ])('rejects a row with %s', (_label, malformedRow) => {
    expect(() => parseMastersScholarshipResearch([header, separator, malformedRow].join('\n')))
      .toThrow(/malformed|boolean|kind/i);
  });
});
