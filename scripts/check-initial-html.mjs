import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function inspectInitialHtml(html, registryNames) {
  const inlineRegistry = /"institutions"\s*:/u.test(html) || registryNames.some((name) => html.includes(name));
  const inlineReverseIndex = /"evidenceState"\s*:/u.test(html);
  const listPanelMetadata = (html.match(/data-list-url=/gu) ?? []).length;

  if (inlineRegistry) throw new Error('Initial HTML embeds the institution registry');
  if (inlineReverseIndex) throw new Error('Initial HTML embeds the reverse index');
  if (!html.includes('generated/institutions.json') || !html.includes('generated/reverse-index.json')) {
    throw new Error('Initial HTML is missing lazy Chinese-institution data URLs');
  }
  return { listPanelMetadata, inlineRegistry, inlineReverseIndex };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [html, institutions] = await Promise.all([
    readFile(join(root, 'dist', 'index.html'), 'utf8'),
    readFile(join(root, 'src', 'data', 'institutions.json'), 'utf8').then(JSON.parse),
  ]);
  const result = inspectInitialHtml(html, [institutions[0]?.nameZh, institutions.at(-1)?.nameZh].filter(Boolean));
  console.log(`Initial HTML guard passed: ${result.listPanelMetadata} list panels, no inline institution registry or reverse index.`);
}
