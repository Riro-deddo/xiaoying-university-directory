import { describe, expect, it } from 'vitest';
import { loadMastersScholarshipEntries } from '../src/lib/data';
import researchMarkdown from '../docs/research/masters-scholarship-entry-batch-3.md?raw';
import { parseMastersScholarshipResearch } from './helpers/masters-scholarship-research';

const batch3UniversityIds = [
  'university-of-essex', 'university-of-dundee', 'soas-university-of-london',
  'royal-holloway-university-of-london', 'university-of-bradford',
  'university-of-huddersfield', 'northumbria-university', 'university-of-stirling',
  'bangor-university', 'university-of-hull', 'coventry-university',
  'ulster-university', 'manchester-metropolitan-university',
  'nottingham-trent-university', 'university-of-portsmouth',
  'kingston-university-london', 'university-of-plymouth',
  'goldsmiths-university-of-london', 'university-of-the-west-of-england',
  'university-of-greenwich', 'aberystwyth-university', 'bournemouth-university',
  'edinburgh-napier-university', 'keele-university', 'de-montfort-university',
] as const;

describe('masters scholarship entry batch 3', () => {
  it('uses generic postgraduate page text for the DMU home-category identity anchors', () => {
    const dmuGroup = loadMastersScholarshipEntries()
      .find((group) => group.universityId === 'de-montfort-university');
    const dmuHomeCategory = dmuGroup?.links
      .find((link) => link.id === 'scholarships-de-montfort-university-home-category');

    expect(dmuHomeCategory?.requiredText).not.toContain('Postgraduate Alumni Scholarship');
    expect(dmuHomeCategory?.requiredText).toEqual([
      'Postgraduate scholarships and bursaries',
      'funding of postgraduate course',
    ]);
  });

  it('matches every reviewed row to the production registry', () => {
    const researchRows = parseMastersScholarshipResearch(researchMarkdown);
    const registry = loadMastersScholarshipEntries();
    const groupsByUniversity = new Map(registry.map((group) => [group.universityId, group]));
    expect(groupsByUniversity.size).toBe(registry.length);
    expect(new Set(researchRows.map((row) => row.universityId)))
      .toEqual(new Set(batch3UniversityIds));
    expect(new Set(researchRows.map((row) => row.evidenceId)).size).toBe(researchRows.length);

    for (const universityId of batch3UniversityIds) {
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
