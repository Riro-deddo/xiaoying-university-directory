import universitiesJson from '../../src/data/universities.json';
import {
  assertMastersScholarshipUniversityOwnedUrl,
  validateUniversities,
} from '../../src/lib/data';
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

const universitiesById = new Map(
  validateUniversities(universitiesJson).map((university) => [university.id, university]),
);

function assertNonemptyResearchField(value: string, field: string, lineNumber: number): void {
  if (value.trim().length === 0) {
    throw new Error(`Malformed scholarship research row ${lineNumber}: ${field} must be nonempty`);
  }
}

function assertIsoDate(value: string, lineNumber: number): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)
    || Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`Malformed scholarship research row ${lineNumber}: reviewedAt must be an ISO date`);
  }
}

function validateMastersScholarshipResearchRow(
  row: MastersScholarshipResearchRow,
  lineNumber: number,
): void {
  const university = universitiesById.get(row.universityId);
  if (!university) {
    throw new Error(`Malformed scholarship research row ${lineNumber}: unknown university ID`);
  }

  assertMastersScholarshipUniversityOwnedUrl(row.officialUrl, university, `/${lineNumber}/officialUrl`);
  assertMastersScholarshipUniversityOwnedUrl(row.finalUrl, university, `/${lineNumber}/finalUrl`);
  assertNonemptyResearchField(row.pageTitle, 'page title', lineNumber);
  assertNonemptyResearchField(row.decisionNote, 'decision note', lineNumber);
  assertNonemptyResearchField(row.requiredText[0], 'first identity anchor', lineNumber);
  assertNonemptyResearchField(row.requiredText[1], 'second identity anchor', lineNumber);
  if (row.requiredText[0].trim() === row.requiredText[1].trim()) {
    throw new Error(`Malformed scholarship research row ${lineNumber}: identity anchors must be distinct`);
  }
  assertIsoDate(row.reviewedAt, lineNumber);

  const requiredIdPrefix = row.kind === 'no-public-entry'
    ? `evidence-${row.universityId}-`
    : `scholarships-${row.universityId}-`;
  if (!row.evidenceId.startsWith(requiredIdPrefix)
    || row.evidenceId.length === requiredIdPrefix.length) {
    throw new Error(`Malformed scholarship research row ${lineNumber}: evidence ID must use ${requiredIdPrefix}`);
  }
}

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
      const row: MastersScholarshipResearchRow = {
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
      };
      validateMastersScholarshipResearchRow(row, lineIndex + 1);
      return [row];
    });
}
