import Ajv2020 from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chinaRuleAuditSchema from '../src/data/china-rule-audit.schema.json' with { type: 'json' };

const validateChinaRuleAudit = new Ajv2020({ allErrors: true }).compile(chinaRuleAuditSchema);

const firstPartySourceDomainAliases = new Map([
  ['university-of-greenwich', new Set(['gre.ac.uk'])],
]);

function sourceIsOfficial(source, university) {
  try {
    const sourceHost = new URL(source.url).hostname.replace(/^www\./u, '');
    const officialHost = new URL(university.officialDomain).hostname.replace(/^www\./u, '');
    return sourceHost === officialHost
      || sourceHost.endsWith(`.${officialHost}`)
      || firstPartySourceDomainAliases.get(university.id)?.has(sourceHost) === true;
  } catch {
    return false;
  }
}

export function evaluateCoverage({ cohort, rankings, universities, sources, audit }) {
  if (!rankings || !Array.isArray(rankings.records)) {
    throw new TypeError('rankings are required for source coverage');
  }

  const cohortIds = new Set(cohort.universities.map((item) => item.id));
  const currentQsDirectoryIds = new Set(rankings.records
    .filter((record) => record.provider === 'qs' && record.edition === cohort.edition)
    .map((record) => record.universityId));
  const approvedSpecialistIds = [
    'cranfield-university',
    'institute-of-cancer-research-london',
    'liverpool-school-of-tropical-medicine',
    'london-business-school',
    'london-school-of-hygiene-and-tropical-medicine',
    'royal-college-of-art',
    'royal-college-of-music',
    'royal-veterinary-college',
  ];
  const expectedDirectoryIds = new Set([...currentQsDirectoryIds, ...approvedSpecialistIds]);
  const universityIds = universities.map((item) => item.id);
  const rankedUniversityIds = universities
    .filter((item) => item.directoryCategory === 'qs-directory')
    .map((item) => item.id);
  const specialistUniversityIds = universities
    .filter((item) => item.directoryCategory === 'specialist')
    .map((item) => item.id);
  const sourceIds = sources.map((item) => item.id);
  const sourceById = new Map(sources.map((item) => [item.id, item]));
  const failures = [];
  const auditIsValid = validateChinaRuleAudit(audit);
  const auditRows = auditIsValid ? audit : [];
  const auditRowsByUniversityId = new Map();

  if (
    rankedUniversityIds.length !== currentQsDirectoryIds.size
    || rankedUniversityIds.some((id) => !currentQsDirectoryIds.has(id))
    || specialistUniversityIds.length !== approvedSpecialistIds.length
    || specialistUniversityIds.sort().some((id, index) => id !== approvedSpecialistIds[index])
    || new Set(universityIds).size !== universityIds.length
  ) {
    failures.push('directory scope must equal the QS cohort plus the approved specialist institutions');
  }
  if (new Set(sourceIds).size !== sourceIds.length) failures.push('duplicate source IDs');

  if (!Array.isArray(audit)) {
    failures.push('missing audit matrix');
  } else if (!auditIsValid) {
    failures.push(`China rule audit data validation failed: ${validateChinaRuleAudit.errors?.map((error) =>
      `${error.instancePath || '/'} ${error.message ?? error.keyword}`).join('; ')}`);
  } else {
    for (const row of auditRows) {
      const rows = auditRowsByUniversityId.get(row.universityId) ?? [];
      rows.push(row);
      auditRowsByUniversityId.set(row.universityId, rows);
    }
    for (const [universityId, rows] of auditRowsByUniversityId) {
      if (rows.length > 1) failures.push(`duplicate audit row: ${universityId}`);
    }
    if (
      auditRows.length !== expectedDirectoryIds.size
      || auditRowsByUniversityId.size !== expectedDirectoryIds.size
      || [...expectedDirectoryIds].some((id) => !auditRowsByUniversityId.has(id))
      || [...auditRowsByUniversityId.keys()].some((id) => !expectedDirectoryIds.has(id))
    ) {
      failures.push('audit rows must cover every directory university exactly once');
    }
    for (const row of auditRows) {
      const university = universities.find((item) => item.id === row.universityId);
      if (!university) {
        failures.push(`audit university is unregistered: ${row.universityId}`);
        continue;
      }
      if (university.directoryCategory !== row.directoryCategory) {
        failures.push(`audit directory category mismatch: ${row.universityId}`);
      }
      if (university.state !== row.expectedState) {
        failures.push(`audit state mismatch: ${row.universityId}`);
      }
      if (row.reviewStatus === 'blocked'
        && (row.expectedState !== 'pending' || university.state !== 'pending')) {
        failures.push(`blocked audit row must remain pending: ${row.universityId}`);
      } else if (row.reviewStatus !== 'reviewed'
        && (row.expectedState !== 'pending' || university.state !== 'pending')) {
        failures.push(`non-pending audit row must be reviewed: ${row.universityId}`);
      } else if (row.reviewStatus === 'reviewed' && university.state === 'pending') {
        failures.push(`reviewed audit row cannot remain pending: ${row.universityId}`);
      }
    }
  }

  for (const university of universities) {
    const auditRow = auditRowsByUniversityId?.get(university.id)?.[0];
    const isBlockedPendingTarget = university.state === 'pending'
      && auditRow?.reviewStatus === 'blocked'
      && auditRow.finding.trim();
    const isUnreviewedPendingTarget = university.state === 'pending' && auditRow?.reviewStatus === 'unreviewed';
    const isReviewedPendingTarget = university.state === 'pending' && auditRow?.reviewStatus === 'reviewed';

    if (auditIsValid) {
      if (isUnreviewedPendingTarget) failures.push(`unreviewed audit target: ${university.id}`);
      else if (university.state === 'pending' && !isBlockedPendingTarget && !isReviewedPendingTarget) {
        failures.push(`pending university: ${university.id}`);
      }
      if (!university.sourceIds.length
        && !isUnreviewedPendingTarget
        && !isBlockedPendingTarget
        && !isReviewedPendingTarget) {
        failures.push(`missing source: ${university.id}`);
      }
    }
    for (const sourceId of university.sourceIds) {
      const source = sourceById.get(sourceId);
      if (!source) {
        failures.push(`unregistered source: ${university.id}/${sourceId}`);
      } else if (source.universityId !== university.id) {
        failures.push(`source belongs to another university: ${sourceId}`);
      } else if (!sourceIsOfficial(source, university)) {
        failures.push(`unregistered source domain: ${sourceId}`);
      }
    }
  }

  for (const source of sources) {
    const university = universities.find((item) => item.id === source.universityId);
    if (!university) {
      failures.push(`source university is unregistered: ${source.id}`);
      continue;
    }
    if (!university.sourceIds.includes(source.id)) {
      failures.push(`unreferenced source: ${source.id}`);
    }
    if (!sourceIsOfficial(source, university)) {
      failures.push(`unregistered source domain: ${source.id}`);
    }
  }

  const auditCount = (state) => auditRows.filter((item) => item.expectedState === state).length;
  return {
    failures: [...new Set(failures)],
    counts: {
      cohortUniversities: cohortIds.size,
      qsUniversities: auditRows.filter((item) => item.directoryCategory === 'qs-directory').length,
      specialistUniversities: auditRows.filter((item) => item.directoryCategory === 'specialist').length,
      fullPublicLists: auditCount('official-list'),
      ruleOnlyUniversities: auditCount('china-requirements'),
      noPublicListRecords: auditCount('not-public'),
      parserEnabledSources: sources.filter((item) => item.parser.mode !== 'link-only').length,
      linkOnlySources: sources.filter((item) => item.parser.mode === 'link-only').length,
    },
  };
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dataRoot = process.env.SOURCE_COVERAGE_DATA_ROOT ?? join(root, 'src', 'data');
  const [cohort, rankings, universities, sources, audit] = await Promise.all([
    readFile(join(dataRoot, 'qs-2027-top-200-uk.json'), 'utf8').then(JSON.parse),
    readFile(join(dataRoot, 'rankings.json'), 'utf8').then(JSON.parse),
    readFile(join(dataRoot, 'universities.json'), 'utf8').then(JSON.parse),
    readFile(join(dataRoot, 'sources.json'), 'utf8').then(JSON.parse),
    readFile(join(dataRoot, 'china-rule-audit.json'), 'utf8').then(JSON.parse),
  ]);
  const { counts, failures } = evaluateCoverage({ cohort, rankings, universities, sources, audit });
  console.log(`Cohort universities: ${counts.cohortUniversities}`);
  console.log(`QS universities: ${counts.qsUniversities}`);
  console.log(`Specialist universities: ${counts.specialistUniversities}`);
  console.log(`Full public lists: ${counts.fullPublicLists}`);
  console.log(`Rule-only universities: ${counts.ruleOnlyUniversities}`);
  console.log(`No-public-list records: ${counts.noPublicListRecords}`);
  console.log(`Parser-enabled sources: ${counts.parserEnabledSources}`);
  console.log(`Link-only sources: ${counts.linkOnlySources}`);
  if (failures.length) {
    for (const failure of failures) console.error(`Coverage failure: ${failure}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
