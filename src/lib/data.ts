import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import institutionsJson from '../data/institutions.json';
import institutionsSchema from '../data/institutions.schema.json';
import requirementsJson from '../data/generated/requirements.json';
import requirementsSchema from '../data/requirements.schema.json';
import sourcesJson from '../data/sources.json';
import sourcesSchema from '../data/sources.schema.json';
import statusesJson from '../data/status.json';
import universitiesJson from '../data/universities.json';
import universitiesSchema from '../data/universities.schema.json';
import type {
  InstitutionRecord,
  OfficialSourceConfig,
  RequirementFact,
  StatusMap,
  University,
  UniversityWithStatus,
} from './types';

const ajv = new Ajv2020({ allErrors: true });
const validateUniversitySchema = ajv.compile(universitiesSchema);
const validateSourceSchema = ajv.compile(sourcesSchema);
const validateInstitutionSchema = ajv.compile(institutionsSchema);
const validateRequirementSchema = ajv.compile(requirementsSchema);

export class DataValidationError extends Error {
  constructor(
    public readonly dataset: string,
    public readonly paths: string[],
  ) {
    super(`${dataset} data validation failed: ${paths.join('; ')}`);
    this.name = 'DataValidationError';
  }
}

function formatSchemaError(errors: ErrorObject[] | null | undefined): string {
  return ajv.errorsText(errors, { separator: '; ' });
}

function assertUniqueIds(records: Array<{ id: string }>, label: string): void {
  const ids = records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate stable IDs`);
}

function schemaPaths(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? error.keyword}`);
}

function assertSchema(
  valid: boolean,
  errors: ErrorObject[] | null | undefined,
  dataset: string,
): void {
  if (!valid) throw new DataValidationError(dataset, schemaPaths(errors));
}

function assertUniqueInstitutionNames(records: InstitutionRecord[]): void {
  const names = records.flatMap((record) => [record.nameZh, record.nameEn, ...record.aliases]);
  if (new Set(names).size !== names.length) {
    throw new DataValidationError('Institution', ['/ must contain globally unique raw names']);
  }
}

export function validateUniversities(input: unknown): University[] {
  if (!validateUniversitySchema(input)) {
    throw new Error(`University data schema error: ${formatSchemaError(validateUniversitySchema.errors)}`);
  }

  const records = input as University[];
  assertUniqueIds(records, 'University data');
  return records;
}

export function validateOfficialSources(input: unknown): OfficialSourceConfig[] {
  if (!validateSourceSchema(input)) {
    throw new Error(`Official source registry schema error: ${formatSchemaError(validateSourceSchema.errors)}`);
  }

  const records = input as OfficialSourceConfig[];
  assertUniqueIds(records, 'Official source registry');
  return records;
}

export function validateInstitutionData(input: unknown): boolean {
  return validateInstitutionSchema(input) as boolean;
}

export function validateRequirementData(input: unknown): boolean {
  return validateRequirementSchema(input) as boolean;
}

export function loadInstitutions(): InstitutionRecord[] {
  assertSchema(
    validateInstitutionData(institutionsJson),
    validateInstitutionSchema.errors,
    'Institution',
  );

  const records = institutionsJson as InstitutionRecord[];
  assertUniqueIds(records, 'Institution data');
  assertUniqueInstitutionNames(records);
  return records;
}

export function loadRequirements(): RequirementFact[] {
  assertSchema(
    validateRequirementData(requirementsJson),
    validateRequirementSchema.errors,
    'Requirement',
  );

  const records = requirementsJson as RequirementFact[];
  assertUniqueIds(records, 'Requirement data');

  const universityIds = new Set(validateUniversities(universitiesJson).map((record) => record.id));
  const sourceById = new Map(validateOfficialSources(sourcesJson).map((record) => [record.id, record]));
  const institutionIds = new Set(loadInstitutions().map((record) => record.id));

  for (const fact of records) {
    if (!universityIds.has(fact.universityId)) {
      throw new DataValidationError('Requirement', [`/${fact.id}/universityId references an unregistered university`]);
    }
    const source = sourceById.get(fact.sourceId);
    if (!source) {
      throw new DataValidationError('Requirement', [`/${fact.id}/sourceId references an unregistered source`]);
    }
    if (source.universityId !== fact.universityId) {
      throw new DataValidationError('Requirement', [`/${fact.id}/sourceId is registered for another university`]);
    }
    if (!institutionIds.has(fact.institutionId)) {
      throw new DataValidationError('Requirement', [`/${fact.id}/institutionId references an unregistered institution`]);
    }
  }

  return records;
}

export function joinUniversityStatuses(
  universities: University[],
  sources: OfficialSourceConfig[],
  statuses: StatusMap,
): UniversityWithStatus[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return universities.map((university) => ({
    ...university,
    sources: university.sourceIds.map((sourceId) => {
      const source = sourceById.get(sourceId);
      if (!source) throw new Error(`University ${university.id} references unregistered source ${sourceId}`);
      if (source.universityId !== university.id) {
        throw new Error(`Source ${source.id} is registered for ${source.universityId}, not ${university.id}`);
      }
      return { ...source, status: statuses[source.id] };
    }),
  }));
}

export function loadUniversities(): UniversityWithStatus[] {
  const universities = validateUniversities(universitiesJson);
  const sources = validateOfficialSources(sourcesJson);
  return joinUniversityStatuses(universities, sources, statusesJson as StatusMap);
}
