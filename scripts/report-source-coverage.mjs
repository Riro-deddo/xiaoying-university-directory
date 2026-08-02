import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function sourceIsOfficial(source, university) {
  try {
    const sourceHost = new URL(source.url).hostname;
    const officialHost = new URL(university.officialDomain).hostname;
    return sourceHost === officialHost || sourceHost.endsWith(`.${officialHost}`);
  } catch {
    return false;
  }
}

export function evaluateCoverage({ cohort, universities, sources }) {
  const cohortIds = new Set(cohort.universities.map((item) => item.id));
  const universityIds = universities.map((item) => item.id);
  const rankedUniversityIds = universities
    .filter((item) => item.directoryCategory === 'qs-top-200')
    .map((item) => item.id);
  const specialistUniversityIds = universities
    .filter((item) => item.directoryCategory === 'specialist')
    .map((item) => item.id);
  const sourceIds = sources.map((item) => item.id);
  const sourceById = new Map(sources.map((item) => [item.id, item]));
  const failures = [];

  if (
    rankedUniversityIds.length !== cohortIds.size
    || rankedUniversityIds.some((id) => !cohortIds.has(id))
    || specialistUniversityIds.length !== 1
    || specialistUniversityIds[0] !== 'london-business-school'
    || new Set(universityIds).size !== universityIds.length
  ) {
    failures.push('directory scope must equal the QS cohort plus London Business School');
  }
  if (new Set(sourceIds).size !== sourceIds.length) failures.push('duplicate source IDs');

  for (const university of universities) {
    if (university.state === 'pending') failures.push(`pending university: ${university.id}`);
    if (!university.sourceIds.length) failures.push(`missing source: ${university.id}`);
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

  const count = (state) => universities.filter((item) => item.state === state).length;
  return {
    failures,
    counts: {
      cohortUniversities: cohortIds.size,
      fullPublicLists: count('official-list'),
      facultyOnlyLists: count('faculty-only'),
      noPublicListRecords: count('not-public'),
      parserEnabledSources: sources.filter((item) => item.parser.mode !== 'link-only').length,
      linkOnlySources: sources.filter((item) => item.parser.mode === 'link-only').length,
    },
  };
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dataRoot = process.env.SOURCE_COVERAGE_DATA_ROOT ?? join(root, 'src', 'data');
  const [cohort, universities, sources] = await Promise.all([
    readFile(join(dataRoot, 'qs-2027-top-200-uk.json'), 'utf8').then(JSON.parse),
    readFile(join(dataRoot, 'universities.json'), 'utf8').then(JSON.parse),
    readFile(join(dataRoot, 'sources.json'), 'utf8').then(JSON.parse),
  ]);
  const { counts, failures } = evaluateCoverage({ cohort, universities, sources });
  console.log(`Cohort universities: ${counts.cohortUniversities}`);
  console.log(`Full public lists: ${counts.fullPublicLists}`);
  console.log(`Faculty-only lists: ${counts.facultyOnlyLists}`);
  console.log(`No-public-list records: ${counts.noPublicListRecords}`);
  console.log(`Parser-enabled sources: ${counts.parserEnabledSources}`);
  console.log(`Link-only sources: ${counts.linkOnlySources}`);
  if (failures.length) {
    for (const failure of failures) console.error(`Coverage failure: ${failure}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
