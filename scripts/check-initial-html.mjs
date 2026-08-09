import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function inspectInitialHtml(html, registryNames, options = {}) {
  const inlineRegistry = /"institutions"\s*:/u.test(html) || registryNames.some((name) => html.includes(name));
  const inlineReverseIndex = /"evidenceState"\s*:/u.test(html);
  const listPanelMetadata = (html.match(/data-list-url=/gu) ?? []).length;

  if (inlineRegistry) throw new Error('Initial HTML embeds the institution registry');
  if (inlineReverseIndex) throw new Error('Initial HTML embeds the reverse index');
  if (!html.includes('generated/institutions.json') || !html.includes('generated/reverse-index.json')) {
    throw new Error('Initial HTML is missing lazy Chinese-institution data URLs');
  }

  const universityIds = [...html.matchAll(/<article\b(?=[^>]*\bclass="[^"]*\buniversity-row\b[^"]*")(?=[^>]*\bdata-id="([^"]+)")[^>]*>/gu)]
    .map((match) => match[1]);
  const uniqueUniversityRows = new Set(universityIds).size;
  const {
    expectedDirectoryCount,
    expectedFirstIds = [],
    expectedLastId,
  } = options;

  if (expectedDirectoryCount !== undefined && universityIds.length !== expectedDirectoryCount) {
    throw new Error(`Initial HTML directory row count ${universityIds.length} did not match ${expectedDirectoryCount}`);
  }
  if (expectedDirectoryCount !== undefined && uniqueUniversityRows !== expectedDirectoryCount) {
    throw new Error(`Initial HTML directory rows must be unique; found ${uniqueUniversityRows} unique IDs`);
  }
  if (expectedFirstIds.length > 0
    && expectedFirstIds.some((id, index) => universityIds[index] !== id)) {
    throw new Error('Initial HTML first directory rows did not match the expected QS order');
  }
  if (expectedLastId !== undefined && universityIds.at(-1) !== expectedLastId) {
    throw new Error(`Initial HTML last directory row must be ${expectedLastId}`);
  }

  return {
    listPanelMetadata,
    inlineRegistry,
    inlineReverseIndex,
    universityRows: universityIds.length,
    uniqueUniversityRows,
    firstUniversityIds: universityIds.slice(0, expectedFirstIds.length || 3),
    lastUniversityId: universityIds.at(-1),
  };
}

export function inspectProductionInitialHtml(html, registryNames) {
  return inspectInitialHtml(html, registryNames, {
    expectedDirectoryCount: 101,
    expectedFirstIds: ['imperial-college-london', 'university-of-oxford', 'university-of-cambridge'],
    expectedLastId: 'institute-of-cancer-research-london',
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [html, institutions] = await Promise.all([
    readFile(join(root, 'dist', 'index.html'), 'utf8'),
    readFile(join(root, 'src', 'data', 'institutions.json'), 'utf8').then(JSON.parse),
  ]);
  const result = inspectProductionInitialHtml(
    html,
    [institutions[0]?.nameZh, institutions.at(-1)?.nameZh].filter(Boolean),
  );
  console.log(`Initial HTML guard passed: ${result.listPanelMetadata} list panels and ${result.universityRows} unique QS-sorted rows, no inline institution registry or reverse index.`);
}
