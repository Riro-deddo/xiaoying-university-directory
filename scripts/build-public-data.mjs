import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReverseIndex } from './build-reverse-index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function structuredSources(sources) {
  return sources.filter((source) => source.parser.mode !== 'link-only' && source.institutionRule.type !== 'none');
}

function joinedUniversityRecords(universities, rankings, sources, statuses) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const rankingsByUniversity = new Map();
  for (const record of rankings.records) {
    const universityRankings = rankingsByUniversity.get(record.universityId) ?? {};
    const current = universityRankings[record.provider];
    if (!current || record.edition > current.edition) universityRankings[record.provider] = record;
    rankingsByUniversity.set(record.universityId, universityRankings);
  }

  return universities.map(({ sourceIds, ...university }) => ({
    ...university,
    sources: sourceIds.map((sourceId) => {
      const source = sourceById.get(sourceId);
      if (!source) throw new Error(`University ${university.id} references unregistered source ${sourceId}`);
      return { ...source, status: statuses[sourceId] };
    }),
    rankings: { ...(rankingsByUniversity.get(university.id) ?? {}) },
  }));
}

export async function buildPublicData({ outputDir, universities, rankings, institutions, requirements, sources, statuses }) {
  const institutionById = new Map(institutions.map((institution) => [institution.id, institution]));
  const listsDir = join(outputDir, 'lists');
  await mkdir(listsDir, { recursive: true });

  for (const source of structuredSources(sources)) {
    const rows = requirements
      .filter((fact) => fact.sourceId === source.id)
      .map((fact) => {
        const institution = institutionById.get(fact.institutionId);
        if (!institution) throw new Error(`Public list fact references unknown institution: ${fact.id}`);
        return {
          institutionId: institution.id,
          nameZh: fact.institutionNameZh ?? institution.nameZh,
          nameEn: fact.institutionOfficial,
          tierOfficial: fact.tierOfficial,
          ...(fact.scoreOfficial ? { scoreOfficial: fact.scoreOfficial } : {}),
        };
      })
      .sort((left, right) => left.nameZh.localeCompare(right.nameZh, 'zh-CN')
        || left.institutionId.localeCompare(right.institutionId)
        || (left.scoreOfficial ?? '').localeCompare(right.scoreOfficial ?? ''));

    if (rows.length === 0) throw new Error(`Public structured source has no trusted records: ${source.id}`);
    await writeFile(join(listsDir, `${source.id}.json`), json({ sourceId: source.id, rows }), 'utf8');
  }

  const reverseIndex = buildReverseIndex({ institutions, requirements, sources, statuses });
  if (universities && rankings) {
    await writeFile(join(outputDir, 'universities.json'), json(joinedUniversityRecords(universities, rankings, sources, statuses)), 'utf8');
  }
  await writeFile(join(outputDir, 'institutions.json'), json(institutions), 'utf8');
  await writeFile(join(outputDir, 'reverse-index.json'), json(reverseIndex), 'utf8');
  return { listFiles: structuredSources(sources).length, institutionRecords: institutions.length, reverseIndexEntries: reverseIndex.length };
}

async function loadJson(...parts) {
  return JSON.parse(await readFile(join(root, ...parts), 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [universities, rankings, institutions, requirements, sources, statuses] = await Promise.all([
    loadJson('src', 'data', 'universities.json'),
    loadJson('src', 'data', 'rankings.json'),
    loadJson('src', 'data', 'institutions.json'),
    loadJson('src', 'data', 'generated', 'requirements.json'),
    loadJson('src', 'data', 'sources.json'),
    loadJson('src', 'data', 'status.json'),
  ]);
  const result = await buildPublicData({
    outputDir: join(root, 'public', 'generated'), universities, rankings, institutions, requirements, sources, statuses,
  });
  console.log(`Built ${result.listFiles} public list files, ${result.institutionRecords} institutions, and ${result.reverseIndexEntries} reverse-index entries.`);
}
