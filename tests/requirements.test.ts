import { describe, expect, it } from 'vitest';
import institutions from '../src/data/institutions.json';
import requirements from '../src/data/generated/requirements.json';
import sources from '../src/data/sources.json';
import universities from '../src/data/universities.json';
import {
  DataValidationError,
  loadInstitutions,
  loadRequirements,
  validateRequirementData,
} from '../src/lib/data';
import type { InstitutionRecord, OfficialSourceConfig, RequirementFact, University } from '../src/lib/types';

const institutionRecords = institutions as InstitutionRecord[];
const requirementRecords = requirements as RequirementFact[];
const sourceRecords = sources as OfficialSourceConfig[];
const universityRecords = universities as University[];

const validInstitution: InstitutionRecord = {
  id: 'peking-university',
  nameZh: '北京大学',
  nameEn: 'Peking University',
  aliases: ['Beida'],
};

const validRequirement: RequirementFact = {
  id: 'ucl-peking-university-2026',
  universityId: 'university-college-london',
  sourceId: 'ucl-china-requirements',
  institutionId: 'peking-university',
  tierOfficial: 'Group A',
  scope: 'university',
  scopeZh: '大学层级',
  extractedAt: '2026-08-01T12:00:00.000Z',
  contentHash: 'example-hash',
};

describe('normalized requirement contracts', () => {
  it('rejects facts without traceable scope, cycle, and source', () => {
    expect(validateRequirementData({
      id: 'bad', universityId: 'ucl', institutionId: 'peking-university',
    })).toBe(false);
  });

  it('requires every institution to have non-empty unique raw names', () => {
    const allNames = institutionRecords.flatMap((item) => [item.nameZh, item.nameEn, ...item.aliases].filter((name): name is string => Boolean(name)));
    expect(allNames.every((name) => name.trim().length > 0)).toBe(true);
    expect(new Set(allNames).size).toBe(allNames.length);
  });

  it('requires every fact to reference registered records', () => {
    const universityIds = new Set(universityRecords.map((item) => item.id));
    const sourceIds = new Set(sourceRecords.map((item) => item.id));
    const institutionIds = new Set(institutionRecords.map((item) => item.id));

    expect(requirementRecords.every((fact) =>
      universityIds.has(fact.universityId) &&
      sourceIds.has(fact.sourceId) &&
      institutionIds.has(fact.institutionId),
    )).toBe(true);
  });

  it('loads schema-valid generated official-list datasets', () => {
    expect(loadInstitutions().length).toBeGreaterThan(0);
    expect(loadRequirements().length).toBeGreaterThan(0);
  });

  it.each([
    ['missing Chinese name', { id: validInstitution.id, nameEn: validInstitution.nameEn, aliases: validInstitution.aliases }, '/0'],
    ['Chinese name', { ...validInstitution, nameZh: '   ' }, '/0/nameZh'],
    ['English name', { ...validInstitution, nameEn: '   ' }, '/0/nameEn'],
    ['alias', { ...validInstitution, aliases: ['   '] }, '/0/aliases/0'],
  ])('rejects whitespace-only institution %s', (_label, record, path) => {
    expect(() => loadInstitutions([record])).toThrow(DataValidationError);
    try {
      loadInstitutions([record]);
    } catch (error) {
      expect(error).toMatchObject({
        dataset: 'Institution',
        paths: expect.arrayContaining([expect.stringContaining(path)]),
      });
    }
  });

  it('reports duplicate institution IDs as data validation errors with paths', () => {
    expect(() => loadInstitutions([validInstitution, { ...validInstitution }]))
      .toThrow(DataValidationError);
    try {
      loadInstitutions([validInstitution, { ...validInstitution }]);
    } catch (error) {
      expect(error).toMatchObject({
        dataset: 'Institution',
        paths: expect.arrayContaining([
          expect.stringContaining('/0/id'),
          expect.stringContaining('/1/id'),
        ]),
      });
    }
  });

  it('reports duplicate requirement IDs as data validation errors with paths', () => {
    expect(() => loadRequirements([validRequirement, { ...validRequirement }]))
      .toThrow(DataValidationError);
    try {
      loadRequirements([validRequirement, { ...validRequirement }]);
    } catch (error) {
      expect(error).toMatchObject({
        dataset: 'Requirement',
        paths: expect.arrayContaining([
          expect.stringContaining('/0/id'),
          expect.stringContaining('/1/id'),
        ]),
      });
    }
  });
});
