import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import sourcesJson from '../data/sources.json';
import sourcesSchema from '../data/sources.schema.json';
import statusesJson from '../data/status.json';
import universitiesJson from '../data/universities.json';
import universitiesSchema from '../data/universities.schema.json';
import type {
  OfficialSourceConfig,
  StatusMap,
  University,
  UniversityWithStatus,
} from './types';

const ajv = new Ajv2020({ allErrors: true });
const validateUniversitySchema = ajv.compile(universitiesSchema);
const validateSourceSchema = ajv.compile(sourcesSchema);

function formatSchemaError(errors: ErrorObject[] | null | undefined): string {
  return ajv.errorsText(errors, { separator: '; ' });
}

function assertUniqueIds(records: Array<{ id: string }>, label: string): void {
  const ids = records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate stable IDs`);
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
