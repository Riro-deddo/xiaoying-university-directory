import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadMastersScholarshipEntries } from '../src/lib/data';
import { parseMastersScholarshipResearch } from './helpers/masters-scholarship-research';

const batch2UniversityIds = [
  'cardiff-university', 'university-of-reading', 'cranfield-university',
  'london-business-school', 'london-school-of-hygiene-and-tropical-medicine',
  'royal-college-of-art', 'royal-veterinary-college', 'royal-college-of-music',
  'institute-of-cancer-research-london', 'liverpool-school-of-tropical-medicine',
  'loughborough-university', 'university-of-strathclyde', 'university-of-surrey',
  'university-of-sussex', 'university-of-aberdeen', 'university-of-leicester',
  'swansea-university', 'heriot-watt-university', 'brunel-university-of-london',
  'birkbeck-university-of-london', 'city-st-georges-university-of-london',
  'university-of-east-anglia', 'oxford-brookes-university', 'university-of-kent',
  'aston-university',
] as const;

const researchMarkdown = readFileSync(
  new URL('../docs/research/masters-scholarship-entry-batch-2.md', import.meta.url),
  'utf8',
);

describe('masters scholarship entry batch 2', () => {
  it('matches every reviewed row to the production registry and completes 51 groups', () => {
    const researchRows = parseMastersScholarshipResearch(researchMarkdown);
    const registry = loadMastersScholarshipEntries();
    const groupsByUniversity = new Map(registry.map((group) => [group.universityId, group]));
    const linksById = new Map(registry.flatMap((group) => group.links.map((link) => [link.id, link] as const)));

    expect(registry).toHaveLength(51);
    expect(new Set(researchRows.map((row) => row.universityId)))
      .toEqual(new Set(batch2UniversityIds));
    expect(new Set(researchRows.map((row) => row.linkId)).size).toBe(researchRows.length);
    expect(new Set(linksById).size).toBe(registry.flatMap((group) => group.links).length);

    for (const universityId of batch2UniversityIds) {
      const group = groupsByUniversity.get(universityId);
      expect(group, `missing production scholarship group for ${universityId}`).toBeDefined();
      expect(group?.links.length).toBeGreaterThanOrEqual(1);
      expect(group?.links.length).toBeLessThanOrEqual(3);
    }

    for (const row of researchRows) {
      const link = linksById.get(row.linkId);
      expect(link, `missing production scholarship link ${row.linkId}`).toBeDefined();
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
