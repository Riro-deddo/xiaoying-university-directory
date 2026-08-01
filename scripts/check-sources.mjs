import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSource } from './source-checker.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const universitiesPath = join(root, 'src', 'data', 'universities.json');
const statusPath = join(root, 'src', 'data', 'status.json');
const tempPath = `${statusPath}.next`;
const universities = JSON.parse(await readFile(universitiesPath, 'utf8'));
const previous = JSON.parse(await readFile(statusPath, 'utf8'));
const sources = universities.flatMap((university) => university.sources);
const next = {};

for (const source of sources) {
  next[source.id] = await checkSource(source, fetch, previous[source.id]);
  await new Promise((resolve) => setTimeout(resolve, 600));
}

await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
await rename(tempPath, statusPath);
console.log(`Checked ${sources.length} official source(s).`);
