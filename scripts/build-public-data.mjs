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

export async function buildPublicData({ outputDir, institutions, requirements, sources, statuses }) {
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
          nameZh: institution.nameZh,
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
  await writeFile(join(outputDir, 'reverse-index.json'), json(reverseIndex), 'utf8');
  return { listFiles: structuredSources(sources).length, reverseIndexEntries: reverseIndex.length };
}

async function loadJson(...parts) {
  return JSON.parse(await readFile(join(root, ...parts), 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [institutions, requirements, sources, statuses] = await Promise.all([
    loadJson('src', 'data', 'institutions.json'),
    loadJson('src', 'data', 'generated', 'requirements.json'),
    loadJson('src', 'data', 'sources.json'),
    loadJson('src', 'data', 'status.json'),
  ]);
  const result = await buildPublicData({
    outputDir: join(root, 'public', 'generated'), institutions, requirements, sources, statuses,
  });
  console.log(`Built ${result.listFiles} public list files and ${result.reverseIndexEntries} reverse-index entries.`);
}
