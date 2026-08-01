import { describe, expect, it } from 'vitest';
import institutions from '../src/data/institutions.json';
import requirements from '../src/data/generated/requirements.json';
import sources from '../src/data/sources.json';
import universities from '../src/data/universities.json';
import {
  loadInstitutions,
  loadRequirements,
  validateRequirementData,
} from '../src/lib/data';
import type { InstitutionRecord, OfficialSourceConfig, RequirementFact, University } from '../src/lib/types';

const institutionRecords = institutions as InstitutionRecord[];
const requirementRecords = requirements as RequirementFact[];
const sourceRecords = sources as OfficialSourceConfig[];
const universityRecords = universities as University[];

describe('normalized requirement contracts', () => {
  it('rejects facts without traceable scope, cycle, and source', () => {
    expect(validateRequirementData({
      id: 'bad', universityId: 'ucl', institutionId: 'peking-university',
    })).toBe(false);
  });

  it('requires every institution to have non-empty unique raw names', () => {
    const allNames = institutionRecords.flatMap((item) => [item.nameZh, item.nameEn, ...item.aliases]);
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

  it('loads empty, schema-valid generated datasets', () => {
    expect(loadInstitutions()).toEqual([]);
    expect(loadRequirements()).toEqual([]);
  });
});
