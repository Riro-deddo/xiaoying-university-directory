import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadMastersScholarshipEntries } from '../src/lib/data';
import { parseMastersScholarshipResearch } from './helpers/masters-scholarship-research';

const batch1UniversityIds = [
  'imperial-college-london', 'university-of-oxford', 'university-of-cambridge',
  'university-college-london', 'university-of-edinburgh', 'kings-college-london',
  'university-of-manchester', 'university-of-bristol',
  'london-school-of-economics-and-political-science', 'university-of-warwick',
  'university-of-birmingham', 'university-of-leeds', 'university-of-glasgow',
  'university-of-sheffield', 'durham-university', 'university-of-nottingham',
  'queen-mary-university-of-london', 'university-of-southampton',
  'university-of-st-andrews', 'university-of-bath', 'university-of-exeter',
  'university-of-liverpool', 'newcastle-university', 'university-of-york',
  'lancaster-university', 'queens-university-belfast',
] as const;

const researchMarkdown = readFileSync(
  new URL('../docs/research/masters-scholarship-entry-batch-1.md', import.meta.url),
  'utf8',
);

describe('masters scholarship entry batch 1', () => {
  it('matches every reviewed row to the production registry', () => {
    const researchRows = parseMastersScholarshipResearch(researchMarkdown);
    const registry = loadMastersScholarshipEntries();
    const groupsByUniversity = new Map(registry.map((group) => [group.universityId, group]));
    expect(new Set(researchRows.map((row) => row.universityId)))
      .toEqual(new Set(batch1UniversityIds));
    expect(new Set(researchRows.map((row) => row.evidenceId)).size).toBe(researchRows.length);

    for (const universityId of batch1UniversityIds) {
      const group = groupsByUniversity.get(universityId);
      expect(group, `missing production scholarship group for ${universityId}`).toBeDefined();
      expect(group?.entryState).toBe('available');
      expect(group?.reviewedAt).toBe('2026-08-31');
      expect(group?.links.length).toBeGreaterThanOrEqual(1);
      expect(group?.links.length).toBeLessThanOrEqual(3);

      const evidenceIds = researchRows
        .filter((row) => row.universityId === universityId)
        .map((row) => row.evidenceId);
      expect(new Set(group?.links.map((link) => link.id))).toEqual(new Set(evidenceIds));
    }

    for (const row of researchRows) {
      expect(row.kind).not.toBe('no-public-entry');
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
