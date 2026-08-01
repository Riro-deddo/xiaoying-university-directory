import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../data/universities.schema.json';
import universitiesJson from '../data/universities.json';
import statusesJson from '../data/status.json';
import type { StatusMap, University, UniversityWithStatus } from './types';

const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

export function validateUniversities(input: unknown): University[] {
  if (!validate(input)) {
    throw new Error(`大学数据格式错误：${ajv.errorsText(validate.errors, { separator: '；' })}`);
  }

  const records = input as University[];
  const ids = records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) throw new Error('大学数据包含重复的稳定 ID');

  const sourceIds = records.flatMap((record) => record.sources.map((source) => source.id));
  if (new Set(sourceIds).size !== sourceIds.length) throw new Error('大学数据包含重复的来源 ID');
  return records;
}

export function joinUniversityStatuses(
  universities: University[],
  statuses: StatusMap,
): UniversityWithStatus[] {
  return universities.map((university) => ({
    ...university,
    sources: university.sources.map((source) => ({
      ...source,
      status: statuses[source.id],
    })),
  }));
}

export function loadUniversities(): UniversityWithStatus[] {
  return joinUniversityStatuses(validateUniversities(universitiesJson), statusesJson as StatusMap);
}
