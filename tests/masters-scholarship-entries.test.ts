import { describe, expect, it } from 'vitest';
import universitiesJson from '../src/data/universities.json';
import batch2ResearchMarkdown from '../docs/research/masters-scholarship-entry-batch-2.md?raw';
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
  it('loads the completed independent production registry', () => {
    const loaded = loadMastersScholarshipEntries();

    expect(loaded).toHaveLength(101);
    expect(loaded.filter((entry) => entry.entryState === 'available')).toHaveLength(100);
    expect(loaded.filter((entry) => entry.entryState === 'no-public-entry')).toHaveLength(1);
    expect(loaded.flatMap((entry) => entry.links)).toHaveLength(106);
    expect(loaded[0]?.universityId).toBe('imperial-college-london');
    expect(loaded.at(-1)?.universityId).toBe('canterbury-christ-church-university');
  });

  it('covers the exact validated 101-university catalog once with explicit lifecycle state', () => {
    const catalog = validateUniversities(universitiesJson);
    const loaded = loadMastersScholarshipEntries();
    const linkIds = loaded.flatMap((entry) => entry.links.map((link) => link.id));

    expect(loaded).toHaveLength(101);
    expect(new Set(loaded.map((entry) => entry.universityId)))
      .toEqual(new Set(catalog.map((university) => university.id)));
    expect(new Set(linkIds).size).toBe(linkIds.length);
    const normalizedUrls = loaded.flatMap((entry) => entry.links.map((link) => new URL(link.url).href));
    expect(new Set(normalizedUrls).size).toBe(normalizedUrls.length);

    for (const entry of loaded) {
      expect(entry.reviewedAt).toBe('2026-08-31');
      if (entry.entryState === 'available') {
        expect(entry.links.length).toBeGreaterThanOrEqual(1);
        expect(entry.links.length).toBeLessThanOrEqual(3);
      } else {
        expect(entry.entryState).toBe('no-public-entry');
        expect(entry.links).toEqual([]);
      }
    }
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

  it('rejects distinct link IDs with the same normalized URL across university groups', () => {
    const secondUniversity: University = {
      ...universities[0],
      id: 'imperial-business-school',
      nameZh: '帝国理工商学院',
      nameEn: 'Imperial Business School',
    };
    const duplicateUrlEntry: MastersScholarshipEntry = {
      ...valid[0],
      universityId: secondUniversity.id,
      entryState: 'available',
      links: [{
        ...valid[0].links[0],
        id: `scholarships-${secondUniversity.id}-directory`,
        universityId: secondUniversity.id,
        url: 'https://www.imperial.ac.uk:443/study/fees-and-funding/postgraduate/',
      }],
    };

    expect(() => validateMastersScholarshipEntries(
      [...valid, duplicateUrlEntry],
      [...universities, secondUniversity],
    )).toThrow(/duplicate.*url/i);
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

  const completeResearchMarkdown = (overrides: Record<string, string> = {}) => {
    const values = {
      universityId: 'imperial-college-london',
      evidenceId: 'scholarships-imperial-college-london-directory',
      officialUrl: 'https://www.imperial.ac.uk/study/fees-and-funding/postgraduate/',
      finalUrl: 'https://www.imperial.ac.uk/study/fees-and-funding/postgraduate/',
      kind: 'masters-directory',
      requiresFiltering: 'false',
      pageTitle: 'Postgraduate fees and funding',
      requiredTextFirst: 'Postgraduate',
      requiredTextSecond: 'Scholarships',
      reviewedAt: '2026-08-31',
      decisionNote: 'Official postgraduate scholarship directory',
      ...overrides,
    };
    return [
      header,
      separator,
      `| ${Object.values(values).join(' | ')} |`,
    ].join('\n');
  };

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

  it('accepts the reviewed University of Greenwich scholarship alias in research evidence', () => {
    expect(() => parseMastersScholarshipResearch(completeResearchMarkdown({
      universityId: 'university-of-greenwich',
      evidenceId: 'scholarships-university-of-greenwich-postgraduate-funding',
      officialUrl: 'https://www.gre.ac.uk/finance/funding-your-studies/scholarships-and-bursaries',
      finalUrl: 'https://www.gre.ac.uk/finance/funding-your-studies/scholarships-and-bursaries',
      kind: 'postgraduate-funding',
      requiresFiltering: 'true',
    }))).not.toThrow();
  });

  it.each([
    'https://www.gre.ac.uk.evil.test/finance/funding-your-studies/scholarships-and-bursaries',
    'https://www.notgre.ac.uk/finance/funding-your-studies/scholarships-and-bursaries',
  ])('rejects University of Greenwich scholarship alias lookalike research URL %s', (url) => {
    expect(() => parseMastersScholarshipResearch(completeResearchMarkdown({
      universityId: 'university-of-greenwich',
      evidenceId: 'scholarships-university-of-greenwich-postgraduate-funding',
      officialUrl: url,
      finalUrl: url,
      kind: 'postgraduate-funding',
      requiresFiltering: 'true',
    }))).toThrow(/official domain/i);
  });

  it.each([
    ['unknown university', { universityId: 'unknown-university', evidenceId: 'scholarships-unknown-university-directory' }],
    ['third-party official URL', { officialUrl: 'https://scholarships.example.test/postgraduate/' }],
    ['non-HTTPS final URL', { finalUrl: 'http://www.imperial.ac.uk/study/fees-and-funding/postgraduate/' }],
    ['empty page title', { pageTitle: '' }],
    ['empty decision note', { decisionNote: '' }],
    ['empty identity anchor', { requiredTextFirst: '' }],
    ['duplicate identity anchors', { requiredTextSecond: 'Postgraduate' }],
    ['non-ISO review date', { reviewedAt: '31-08-2026' }],
    ['bad available evidence ID', { evidenceId: 'evidence-imperial-college-london-directory' }],
    ['empty available evidence ID suffix', { evidenceId: 'scholarships-imperial-college-london-' }],
    ['empty negative evidence ID suffix', {
      evidenceId: 'evidence-imperial-college-london-',
      kind: 'no-public-entry',
    }],
  ])('rejects research evidence with %s', (_label, overrides) => {
    expect(() => parseMastersScholarshipResearch(completeResearchMarkdown(overrides)))
      .toThrow(/university|official domain|https|title|decision|anchor|date|id/i);
  });

  it('fully validates the ICR official negative evidence row', () => {
    const row = parseMastersScholarshipResearch(batch2ResearchMarkdown)
      .find((candidate) => candidate.universityId === 'institute-of-cancer-research-london');

    expect(row).toEqual({
      universityId: 'institute-of-cancer-research-london',
      evidenceId: 'evidence-institute-of-cancer-research-london-no-public-entry',
      officialUrl: 'https://www.icr.ac.uk/study-and-careers/student-life-and-support/fees-costs-support',
      finalUrl: 'https://www.icr.ac.uk/study-and-careers/student-life-and-support/fees-costs-support',
      kind: 'no-public-entry',
      requiresFiltering: false,
      pageTitle: 'Tuition fees',
      requiredText: ['Tuition fees', 'Taught course students'],
      reviewedAt: '2026-08-31',
      decisionNote: expect.stringContaining('no public master'),
    });
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
