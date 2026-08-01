import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { extractPdfFacts } from '../scripts/extractors/pdf.mjs';

const fixtureBytes = async () => new Uint8Array(await readFile(new URL('./fixtures/sources/list-text-layer.pdf', import.meta.url)));
const footerFixtureBytes = async () => new Uint8Array(await readFile(new URL('./fixtures/sources/list-with-footer.pdf', import.meta.url)));
const scannedBytes = async () => new Uint8Array(await readFile(new URL('./fixtures/sources/scanned-no-text.pdf', import.meta.url)));
const pdfConfig = {
  mode: 'pdf-text',
  headingPattern: '^University \\| Tier$',
  rowPattern: '^(Example University) \\| (Group 1)$',
  institutionColumn: 0,
  tierColumn: 1,
};

describe('extractPdfFacts', () => {
  it('extracts text-layer rows and preserves official tier wording', async () => {
    const facts = await extractPdfFacts(pdfConfig, await fixtureBytes());

    expect(facts[0]).toMatchObject({ institutionOfficial: 'Example University', tierOfficial: 'Group 1' });
  });

  it('ignores footer lines that do not match the registered row pattern', async () => {
    await expect(extractPdfFacts(pdfConfig, await footerFixtureBytes())).resolves.toEqual([
      { institutionOfficial: 'Example University', tierOfficial: 'Group 1' },
    ]);
  });

  it('returns a typed no-text anomaly for scanned PDFs', async () => {
    await expect(extractPdfFacts(pdfConfig, await scannedBytes())).rejects.toMatchObject({ code: 'PDF_NO_TEXT_LAYER' });
  });

  it('returns a typed empty anomaly when the registered heading is absent', async () => {
    await expect(extractPdfFacts({ ...pdfConfig, headingPattern: '^Wrong heading$' }, await fixtureBytes()))
      .rejects.toMatchObject({ code: 'PARSER_EMPTY' });
  });

  it('returns a typed structure anomaly when a registered column is unavailable', async () => {
    await expect(extractPdfFacts({ ...pdfConfig, scoreColumn: 2 }, await fixtureBytes()))
      .rejects.toMatchObject({ code: 'PARSER_STRUCTURE_CHANGED' });
  });

  it('omits an unmatched optional score capture without crashing', async () => {
    await expect(extractPdfFacts({
      ...pdfConfig,
      rowPattern: '^(Example University) \\| (Group 1)(?: \\| (.+))?$',
      scoreColumn: 2,
    }, await fixtureBytes())).resolves.toEqual([
      { institutionOfficial: 'Example University', tierOfficial: 'Group 1' },
    ]);
  });
});
