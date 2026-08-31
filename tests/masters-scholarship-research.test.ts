import { describe, expect, it } from 'vitest';
import batch1ResearchMarkdown from '../docs/research/masters-scholarship-entry-batch-1.md?raw';
import batch2ResearchMarkdown from '../docs/research/masters-scholarship-entry-batch-2.md?raw';
import batch3ResearchMarkdown from '../docs/research/masters-scholarship-entry-batch-3.md?raw';
import batch4ResearchMarkdown from '../docs/research/masters-scholarship-entry-batch-4.md?raw';
import approvedAnchorsJson from './fixtures/masters-scholarship-anchor-approvals.json';
import { parseMastersScholarshipResearch } from './helpers/masters-scholarship-research';

const approvedAnchors: Record<string, readonly string[]> = approvedAnchorsJson;

describe('masters scholarship reviewed anchor approvals', () => {
  it('locks exactly two independently approved page-identity anchors for every research row', () => {
    const researchRows = [
      batch1ResearchMarkdown,
      batch2ResearchMarkdown,
      batch3ResearchMarkdown,
      batch4ResearchMarkdown,
    ].flatMap(parseMastersScholarshipResearch);
    const evidenceIds = researchRows.map((row) => row.evidenceId);

    expect(researchRows).toHaveLength(107);
    expect(Object.keys(approvedAnchors).sort()).toEqual([...evidenceIds].sort());
    for (const row of researchRows) {
      expect(approvedAnchors[row.evidenceId], `unapproved anchors for ${row.evidenceId}`)
        .toEqual(row.requiredText);
    }
    expect(approvedAnchors['evidence-institute-of-cancer-research-london-no-public-entry'])
      .toEqual(['Tuition fees', 'Taught course students']);
  });
});
