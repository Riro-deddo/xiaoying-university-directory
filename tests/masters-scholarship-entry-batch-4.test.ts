import { describe, expect, it } from 'vitest';
import { loadMastersScholarshipEntries } from '../src/lib/data';
import researchMarkdown from '../docs/research/masters-scholarship-entry-batch-4.md?raw';
import { parseMastersScholarshipResearch } from './helpers/masters-scholarship-research';

const batch4UniversityIds = [
  'liverpool-john-moores-university', 'university-of-hertfordshire',
  'university-of-lincoln', 'university-of-the-arts-london',
  'university-of-westminster', 'london-south-bank-university',
  'middlesex-university', 'university-of-brighton', 'anglia-ruskin-university',
  'birmingham-city-university', 'glasgow-caledonian-university',
  'leeds-beckett-university', 'london-metropolitan-university',
  'robert-gordon-university', 'sheffield-hallam-university',
  'university-of-east-london', 'university-of-lancashire',
  'university-of-roehampton', 'university-of-salford',
  'university-of-wolverhampton', 'queen-margaret-university-edinburgh',
  'university-of-northampton', 'university-of-derby',
  'university-of-south-wales', 'canterbury-christ-church-university',
] as const;

const mixedCategoryLinkIds = [
  'scholarships-university-of-brighton-home-category',
  'scholarships-university-of-brighton-international-category',
  'scholarships-university-of-roehampton-home-category',
  'scholarships-university-of-roehampton-international-category',
] as const;

describe('masters scholarship entry batch 4', () => {
  it('marks the mixed Brighton and Roehampton category pages as requiring filtering', () => {
    const linksById = new Map(loadMastersScholarshipEntries()
      .flatMap((group) => group.links)
      .map((link) => [link.id, link]));

    for (const linkId of mixedCategoryLinkIds) {
      const link = linksById.get(linkId);
      expect(link, `missing mixed category link ${linkId}`).toBeDefined();
      expect(link?.kind).toBe('category');
      expect(link?.requiresFiltering).toBe(true);
      expect(link?.scopeZh).toContain('请筛选');
    }
  });

  it('matches every reviewed row bidirectionally to the production registry', () => {
    const researchRows = parseMastersScholarshipResearch(researchMarkdown);
    const registry = loadMastersScholarshipEntries();
    const groupsByUniversity = new Map(registry.map((group) => [group.universityId, group]));

    expect(groupsByUniversity.size).toBe(registry.length);
    expect(new Set(researchRows.map((row) => row.universityId)))
      .toEqual(new Set(batch4UniversityIds));
    expect(new Set(researchRows.map((row) => row.evidenceId)).size).toBe(researchRows.length);

    for (const universityId of batch4UniversityIds) {
      const group = groupsByUniversity.get(universityId);
      expect(group, `missing production scholarship group for ${universityId}`).toBeDefined();
      expect(group?.reviewedAt).toBe('2026-08-31');

      const rows = researchRows.filter((row) => row.universityId === universityId);
      const negativeEvidence = rows.filter((row) => row.kind === 'no-public-entry');
      if (negativeEvidence.length > 0) {
        expect(negativeEvidence).toHaveLength(1);
        expect(group?.entryState).toBe('no-public-entry');
        expect(group?.links).toEqual([]);
        continue;
      }

      expect(group?.entryState).toBe('available');
      expect(group?.links.length).toBeGreaterThanOrEqual(1);
      expect(group?.links.length).toBeLessThanOrEqual(3);
      expect(new Set(group?.links.map((link) => link.id)))
        .toEqual(new Set(rows.map((row) => row.evidenceId)));
    }

    for (const row of researchRows) {
      if (row.kind === 'no-public-entry') continue;
      const link = groupsByUniversity.get(row.universityId)?.links
        .find((candidate) => candidate.id === row.evidenceId);
      expect(link, `missing production scholarship link ${row.evidenceId}`).toBeDefined();
      expect(link).toMatchObject({
        universityId: row.universityId,
        url: row.finalUrl,
        kind: row.kind,
        requiresFiltering: row.requiresFiltering,
        pageTitle: row.pageTitle,
        requiredText: row.requiredText,
        reviewedAt: row.reviewedAt,
      });
    }
  });
});
