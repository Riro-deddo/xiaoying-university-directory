import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import chinaRuleAuditJson from '../data/china-rule-audit.json';
import chinaRuleAuditSchema from '../data/china-rule-audit.schema.json';
import institutionsJson from '../data/institutions.json';
import institutionsSchema from '../data/institutions.schema.json';
import mastersCourseDirectoriesJson from '../data/masters-course-directories.json';
import mastersCourseDirectoriesSchema from '../data/masters-course-directories.schema.json';
import mastersScholarshipEntriesJson from '../data/masters-scholarship-entries.json';
import mastersScholarshipEntriesSchema from '../data/masters-scholarship-entries.schema.json';
import requirementsJson from '../data/generated/requirements.json';
import requirementsSchema from '../data/requirements.schema.json';
import rankingsJson from '../data/rankings.json';
import rankingsSchema from '../data/rankings.schema.json';
import sourcesJson from '../data/sources.json';
import sourcesSchema from '../data/sources.schema.json';
import statusesJson from '../data/status.json';
import universitiesJson from '../data/universities.json';
import universitiesSchema from '../data/universities.schema.json';
import type {
  InstitutionRecord,
  DirectoryCategory,
  MastersCourseDirectory,
  MastersScholarshipEntry,
  OfficialSourceConfig,
  RequirementFact,
  RankingDataset,
  RankingRecord,
  StatusMap,
  University,
  UniversityDirectoryRecord,
  UniversityState,
  UniversityWithMastersCourse,
  UniversityWithRankings,
  UniversityWithStatus,
} from './types';

export interface ChinaRuleAuditRow {
  universityId: string;
  directoryCategory: DirectoryCategory;
  expectedState: UniversityState;
  reviewDate: string;
  finding: string;
}

const ajv = new Ajv2020({ allErrors: true });
const validateUniversitySchema = ajv.compile(universitiesSchema);
const validateSourceSchema = ajv.compile(sourcesSchema);
const validateInstitutionSchema = ajv.compile(institutionsSchema);
const validateMastersCourseDirectorySchema = ajv.compile(mastersCourseDirectoriesSchema);
const validateMastersScholarshipEntrySchema = ajv.compile(mastersScholarshipEntriesSchema);
const validateRequirementSchema = ajv.compile(requirementsSchema);
const validateChinaRuleAuditSchema = ajv.compile(chinaRuleAuditSchema);
const validateRankingSchema = ajv.compile(rankingsSchema);

const firstPartyCourseDirectoryDomainAliases = new Map<string, ReadonlySet<string>>([
  ['university-of-greenwich', new Set(['gre.ac.uk'])],
]);
const firstPartyScholarshipDomainAliases = new Map<string, ReadonlySet<string>>([
  ['university-of-greenwich', new Set(['gre.ac.uk'])],
]);

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

function assertUniqueIds(records: Array<{ id: string }>, dataset: string): void {
  const indexesById = new Map<string, number[]>();
  records.forEach((record, index) => {
    const indexes = indexesById.get(record.id) ?? [];
    indexes.push(index);
    indexesById.set(record.id, indexes);
  });

  const duplicatePaths = [...indexesById.values()]
    .filter((indexes) => indexes.length > 1)
    .flatMap((indexes) => indexes.map((index) => `/${index}/id duplicate stable ID`));
  if (duplicatePaths.length > 0) throw new DataValidationError(dataset, duplicatePaths);
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

function assertUniversityOwnedUrl(
  url: string,
  university: University,
  dataset: string,
  path: string,
  approvedAliases: ReadonlySet<string>,
): void {
  let recordHost: string;
  let officialHost: string;
  try {
    recordHost = new URL(url).hostname.toLowerCase().replace(/^www\./u, '');
    officialHost = new URL(university.officialDomain).hostname.toLowerCase().replace(/^www\./u, '');
  } catch {
    throw new DataValidationError(dataset, [`${path} must be a valid HTTPS URL`]);
  }

  if (recordHost !== officialHost
    && !recordHost.endsWith(`.${officialHost}`)
    && !approvedAliases.has(recordHost)) {
    throw new DataValidationError(dataset, [`${path} must use the university official domain`]);
  }
}

function assertUniqueInstitutionNames(records: InstitutionRecord[]): void {
  const canonicalChineseNames = records.map((record) => record.nameZh
    .normalize('NFKC')
    .replace(/\s*\(\s*/gu, '(')
    .replace(/\s*\)\s*/gu, ')')
    .trim());
  if (new Set(canonicalChineseNames).size !== canonicalChineseNames.length) {
    throw new DataValidationError('Institution', ['/ must contain globally unique canonical Chinese names']);
  }
}

export function validateUniversities(input: unknown): University[] {
  if (!validateUniversitySchema(input)) {
    throw new Error(`University data schema error: ${formatSchemaError(validateUniversitySchema.errors)}`);
  }

  const records = input as University[];
  assertUniqueIds(records, 'University');
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

export function validateMastersCourseDirectories(
  input: unknown,
  universities: University[] = validateUniversities(universitiesJson),
): MastersCourseDirectory[] {
  assertSchema(
    validateMastersCourseDirectorySchema(input),
    validateMastersCourseDirectorySchema.errors,
    'Masters course directory schema',
  );

  const records = input as MastersCourseDirectory[];
  assertUniqueIds(records, 'Masters course directory');
  const universitiesById = new Map(universities.map((university) => [university.id, university]));

  records.forEach((record, index) => {
    const university = universitiesById.get(record.universityId);
    if (!university) {
      throw new DataValidationError('Masters course directory', [
        `/${index}/universityId references an unregistered university`,
      ]);
    }
    if (record.id !== `masters-${record.universityId}`) {
      throw new DataValidationError('Masters course directory', [
        `/${index}/id must be derived from universityId`,
      ]);
    }

    assertUniversityOwnedUrl(
      record.url,
      university,
      'Masters course directory',
      `/${index}/url`,
      firstPartyCourseDirectoryDomainAliases.get(record.universityId) ?? new Set(),
    );
  });

  return records;
}

export function validateMastersScholarshipEntries(
  input: unknown,
  universities: University[] = validateUniversities(universitiesJson),
): MastersScholarshipEntry[] {
  assertSchema(
    validateMastersScholarshipEntrySchema(input),
    validateMastersScholarshipEntrySchema.errors,
    'Masters scholarship entry schema',
  );

  const records = input as MastersScholarshipEntry[];
  const universitiesById = new Map(universities.map((university) => [university.id, university]));
  const universityGroups = new Set<string>();
  const linkIds = new Set<string>();

  records.forEach((record, index) => {
    if (universityGroups.has(record.universityId)) {
      throw new DataValidationError('Masters scholarship entry', [
        `/${index}/universityId duplicate university group`,
      ]);
    }
    universityGroups.add(record.universityId);

    const university = universitiesById.get(record.universityId);
    if (!university) {
      throw new DataValidationError('Masters scholarship entry', [
        `/${index}/universityId references an unregistered university`,
      ]);
    }

    record.links.forEach((link, linkIndex) => {
      const path = `/${index}/links/${linkIndex}`;
      if (link.universityId !== record.universityId) {
        throw new DataValidationError('Masters scholarship entry', [
          `${path}/universityId must match its university group`,
        ]);
      }
      if (!link.id.startsWith(`scholarships-${record.universityId}-`)) {
        throw new DataValidationError('Masters scholarship entry', [
          `${path}/id must use the university-specific scholarship prefix`,
        ]);
      }
      if (linkIds.has(link.id)) {
        throw new DataValidationError('Masters scholarship entry', [
          `${path}/id duplicate stable ID`,
        ]);
      }
      linkIds.add(link.id);
      assertUniversityOwnedUrl(
        link.url,
        university,
        'Masters scholarship entry',
        `${path}/url`,
        firstPartyScholarshipDomainAliases.get(record.universityId) ?? new Set(),
      );
    });
  });

  return records;
}

export function loadMastersScholarshipEntries(
  input: unknown = mastersScholarshipEntriesJson,
): MastersScholarshipEntry[] {
  return validateMastersScholarshipEntries(input);
}

export function loadMastersCourseDirectories(
  input: unknown = mastersCourseDirectoriesJson,
): MastersCourseDirectory[] {
  return validateMastersCourseDirectories(input);
}

export function validateInstitutionData(input: unknown): boolean {
  return validateInstitutionSchema(input) as boolean;
}

export function validateRequirementData(input: unknown): boolean {
  return validateRequirementSchema(input) as boolean;
}

export function validateRankings(
  input: unknown,
  universities: University[] = validateUniversities(universitiesJson),
): RankingDataset {
  assertSchema(validateRankingSchema(input), validateRankingSchema.errors, 'Ranking');

  const dataset = input as RankingDataset;
  const releaseKeys = new Map<string, number[]>();
  dataset.releases.forEach((release, index) => {
    const key = `${release.provider}:${release.edition}`;
    releaseKeys.set(key, [...(releaseKeys.get(key) ?? []), index]);
  });
  const duplicateReleases = [...releaseKeys.values()]
    .filter((indexes) => indexes.length > 1)
    .flatMap((indexes) => indexes.map((index) => `/${index} duplicate ranking release`));
  if (duplicateReleases.length > 0) throw new DataValidationError('Ranking', duplicateReleases);

  const recordKeys = new Map<string, number[]>();
  dataset.records.forEach((record, index) => {
    const key = `${record.universityId}:${record.provider}:${record.edition}`;
    recordKeys.set(key, [...(recordKeys.get(key) ?? []), index]);
  });
  const duplicateRecords = [...recordKeys.values()]
    .filter((indexes) => indexes.length > 1)
    .flatMap((indexes) => indexes.map((index) => `/${index} duplicate ranking record`));
  if (duplicateRecords.length > 0) throw new DataValidationError('Ranking', duplicateRecords);

  const registeredReleases = new Set(releaseKeys.keys());
  const registeredUniversities = new Set(universities.map((university) => university.id));
  dataset.records.forEach((record, index) => {
    if (!registeredReleases.has(`${record.provider}:${record.edition}`)) {
      throw new DataValidationError('Ranking', [`/${index} references an unregistered release`]);
    }
    if (!registeredUniversities.has(record.universityId)) {
      throw new DataValidationError('Ranking', [`/${index}/universityId references an unregistered university`]);
    }
  });

  for (const university of universities) {
    if (university.directoryCategory !== 'qs-directory' || !university.qsDirectory?.current) continue;

    const verifiedQsRecords = dataset.records.filter((record) =>
      record.universityId === university.id
      && record.provider === 'qs'
      && record.edition === university.qsDirectory!.verifiedEdition,
    );
    if (verifiedQsRecords.length !== 1) {
      throw new DataValidationError('Ranking', [
        `/${university.id}/qsDirectory requires exactly one QS record at verified edition ${university.qsDirectory.verifiedEdition}`,
      ]);
    }
    if (verifiedQsRecords[0].placement === 'unranked' || verifiedQsRecords[0].placement === 'unverified') {
      throw new DataValidationError('Ranking', [
        `/${university.id}/qsDirectory requires a ranked QS record at verified edition ${university.qsDirectory.verifiedEdition}`,
      ]);
    }
  }

  return dataset;
}

export function loadRankings(
  input: unknown = rankingsJson,
  universities: University[] = validateUniversities(universitiesJson),
): RankingDataset {
  return validateRankings(input, universities);
}

export function loadChinaRuleAudit(input: unknown = chinaRuleAuditJson): ChinaRuleAuditRow[] {
  assertSchema(
    validateChinaRuleAuditSchema(input),
    validateChinaRuleAuditSchema.errors,
    'China rule audit',
  );

  const records = input as ChinaRuleAuditRow[];
  const indexesByUniversityId = new Map<string, number[]>();
  records.forEach((record, index) => {
    const indexes = indexesByUniversityId.get(record.universityId) ?? [];
    indexes.push(index);
    indexesByUniversityId.set(record.universityId, indexes);
  });
  const duplicates = [...indexesByUniversityId.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .flatMap(([universityId, indexes]) => indexes.map((index) => `/${index}/universityId duplicate ${universityId}`));
  if (duplicates.length > 0) throw new DataValidationError('China rule audit', duplicates);
  return records;
}

export function loadInstitutions(input: unknown = institutionsJson): InstitutionRecord[] {
  assertSchema(
    validateInstitutionData(input),
    validateInstitutionSchema.errors,
    'Institution',
  );

  const records = input as InstitutionRecord[];
  assertUniqueIds(records, 'Institution');
  assertUniqueInstitutionNames(records);
  return records;
}

export function loadRequirements(input: unknown = requirementsJson): RequirementFact[] {
  assertSchema(
    validateRequirementData(input),
    validateRequirementSchema.errors,
    'Requirement',
  );

  const records = input as RequirementFact[];
  assertUniqueIds(records, 'Requirement');

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
  universities: Array<University | UniversityWithRankings>,
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
    rankings: 'rankings' in university ? { ...university.rankings } : {},
  }));
}

export function joinUniversityRankings(
  universities: University[],
  dataset: RankingDataset,
): UniversityWithRankings[];
export function joinUniversityRankings(
  universities: UniversityWithStatus[],
  dataset: RankingDataset,
): UniversityWithStatus[];
export function joinUniversityRankings(
  universities: Array<University | UniversityWithStatus>,
  dataset: RankingDataset,
): Array<UniversityWithRankings | UniversityWithStatus> {
  const rankingsByUniversity = new Map<string, Partial<Record<RankingRecord['provider'], RankingRecord>>>();

  for (const record of dataset.records) {
    const rankings = rankingsByUniversity.get(record.universityId) ?? {};
    const existing = rankings[record.provider];
    if (!existing || record.edition > existing.edition) rankings[record.provider] = { ...record };
    rankingsByUniversity.set(record.universityId, rankings);
  }

  return universities.map((university) => ({
    ...university,
    rankings: { ...rankingsByUniversity.get(university.id) },
  }));
}

export function joinMastersCourseDirectories(
  universities: UniversityWithStatus[],
  directories: MastersCourseDirectory[],
  statuses: StatusMap,
): UniversityWithMastersCourse[] {
  const universityIds = new Set(universities.map((university) => university.id));
  const directoryByUniversityId = new Map<string, MastersCourseDirectory>();

  for (const directory of directories) {
    if (directoryByUniversityId.has(directory.universityId)) {
      throw new Error(`Duplicate masters course directory for university ${directory.universityId}`);
    }
    if (!universityIds.has(directory.universityId)) {
      throw new Error(`Extra masters course directory for university ${directory.universityId}`);
    }
    directoryByUniversityId.set(directory.universityId, directory);
  }

  return universities.map((university) => {
    const directory = directoryByUniversityId.get(university.id);
    if (!directory) throw new Error(`Missing masters course directory for university ${university.id}`);
    return {
      ...university,
      mastersCourse: { ...directory, status: statuses[directory.id] },
    };
  });
}

export function joinMastersScholarshipEntries(
  universities: UniversityWithMastersCourse[],
  entries: MastersScholarshipEntry[],
  statuses: StatusMap,
): UniversityDirectoryRecord[] {
  const universityIds = new Set(universities.map((university) => university.id));
  const entryByUniversityId = new Map<string, MastersScholarshipEntry>();

  for (const entry of entries) {
    if (entryByUniversityId.has(entry.universityId)) {
      throw new Error(`Duplicate masters scholarship entry for university ${entry.universityId}`);
    }
    if (!universityIds.has(entry.universityId)) {
      throw new Error(`Extra masters scholarship entry for university ${entry.universityId}`);
    }
    entryByUniversityId.set(entry.universityId, entry);
  }

  return universities.map((university) => {
    const entry = entryByUniversityId.get(university.id);
    if (!entry) throw new Error(`Missing masters scholarship entry for university ${university.id}`);
    return {
      ...university,
      mastersScholarships: entry.entryState === 'available'
        ? {
          ...entry,
          links: entry.links.map((link) => ({ ...link, status: statuses[link.id] })),
        }
        : { ...entry, links: [] },
    };
  });
}

export function loadUniversities(): UniversityDirectoryRecord[] {
  const universities = validateUniversities(universitiesJson);
  const withRankings = joinUniversityRankings(
    universities,
    loadRankings(undefined, universities),
  );
  const sources = validateOfficialSources(sourcesJson);
  const statuses = statusesJson as StatusMap;
  const withSources = joinUniversityStatuses(withRankings, sources, statuses);
  const withMastersCourse = joinMastersCourseDirectories(
    withSources,
    loadMastersCourseDirectories(),
    statuses,
  );
  return joinMastersScholarshipEntries(
    withMastersCourse,
    loadMastersScholarshipEntries(),
    statuses,
  );
}
