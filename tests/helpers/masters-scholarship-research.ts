import type { MastersScholarshipEntryKind } from '../../src/lib/types';

export type MastersScholarshipResearchKind =
  | MastersScholarshipEntryKind
  | 'no-public-entry';

export interface MastersScholarshipResearchRow {
  universityId: string;
  evidenceId: string;
  officialUrl: string;
  finalUrl: string;
  kind: MastersScholarshipResearchKind;
  requiresFiltering: boolean;
  pageTitle: string;
  requiredText: [string, string];
  reviewedAt: string;
  decisionNote: string;
}

const scholarshipEntryKinds = new Set<MastersScholarshipResearchKind>([
  'masters-directory',
  'masters-search',
  'postgraduate-funding',
  'category',
  'no-public-entry',
]);

export function parseMastersScholarshipResearch(markdown: string): MastersScholarshipResearchRow[] {
  return markdown
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('| '))
    .flatMap((line, lineIndex) => {
      const cells = line
        .slice(2)
        .split(' | ')
        .map((cell, index, values) => (index === values.length - 1 ? cell.replace(/ \|$/u, '') : cell))
        .map((cell) => cell.replaceAll('&#124;', '|'));

      if (
        cells[0] === 'universityId'
        || cells[0] === 'University ID'
        || cells.every((cell) => /^:?-{3,}:?$/u.test(cell))
      ) {
        return [];
      }
      if (cells.length !== 11) {
        throw new Error(`Malformed scholarship research row ${lineIndex + 1}: expected 11 cells`);
      }

      const [
        universityId,
        evidenceId,
        officialUrl,
        finalUrl,
        kind,
        requiresFiltering,
        pageTitle,
        requiredTextFirst,
        requiredTextSecond,
        reviewedAt,
        decisionNote,
      ] = cells;
      if (requiresFiltering !== 'true' && requiresFiltering !== 'false') {
        throw new Error(`Malformed scholarship research row ${lineIndex + 1}: requiresFiltering must be true or false`);
      }
      if (!scholarshipEntryKinds.has(kind as MastersScholarshipResearchKind)) {
        throw new Error(`Malformed scholarship research row ${lineIndex + 1}: unknown kind`);
      }
      if (
        kind === 'no-public-entry'
        && !evidenceId.startsWith(`evidence-${universityId}-`)
      ) {
        throw new Error(
          `Malformed scholarship research row ${lineIndex + 1}: no-public-entry requires a university-specific evidence ID`,
        );
      }

      return [{
        universityId,
        evidenceId,
        officialUrl,
        finalUrl,
        kind: kind as MastersScholarshipResearchKind,
        requiresFiltering: requiresFiltering === 'true',
        pageTitle,
        requiredText: [requiredTextFirst, requiredTextSecond],
        reviewedAt,
        decisionNote,
      }];
    });
}
