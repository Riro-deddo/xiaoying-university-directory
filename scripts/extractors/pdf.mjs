import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

class ExtractorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ExtractorError';
    this.code = code;
  }
}

function textLines(items) {
  const rows = new Map();
  for (const item of items) {
    if (!item.str) continue;
    const y = item.transform?.[5] ?? rows.size;
    const key = Math.round(y * 100) / 100;
    rows.set(key, `${rows.get(key) ?? ''}${item.str}`);
  }
  return [...rows.entries()]
    .sort(([first], [second]) => second - first)
    .map(([, line]) => line.trim())
    .filter(Boolean);
}

function factFromRow(match, config) {
  const columns = match.slice(1).map((column) => column?.trim());
  const requiredColumns = [config.institutionColumn, config.tierColumn]
    .filter((column) => column !== undefined);
  if (!Number.isInteger(config.institutionColumn)
    || requiredColumns.some((column) => !Number.isInteger(column) || columns[column] === undefined)
    || (config.scoreColumn !== undefined && (!Number.isInteger(config.scoreColumn) || config.scoreColumn >= columns.length))) {
    throw new ExtractorError('PARSER_STRUCTURE_CHANGED', 'Registered PDF columns are no longer available.');
  }

  const fact = { institutionOfficial: columns[config.institutionColumn] };
  if (config.tierColumn !== undefined) fact.tierOfficial = columns[config.tierColumn];
  if (config.scoreColumn !== undefined && columns[config.scoreColumn] !== undefined) {
    fact.scoreOfficial = columns[config.scoreColumn];
  }
  return fact;
}

export async function extractPdfFacts(config, bytes) {
  if (config.mode !== 'pdf-text' || !config.headingPattern || !config.rowPattern) {
    throw new ExtractorError('PARSER_STRUCTURE_CHANGED', 'PDF extraction requires registered heading and row patterns.');
  }

  const pdf = await getDocument({ data: bytes }).promise;
  const pages = [];
  let foundText = false;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    const lines = textLines(content.items);
    if (lines.length > 0) foundText = true;
    pages.push(lines);
  }
  if (!foundText) throw new ExtractorError('PDF_NO_TEXT_LAYER', 'PDF has no extractable text layer.');

  const heading = new RegExp(config.headingPattern);
  const row = new RegExp(config.rowPattern);
  const lines = pages.flat();
  const headingIndex = lines.findIndex((line) => heading.test(line));
  if (headingIndex === -1) throw new ExtractorError('PARSER_EMPTY', 'Registered PDF heading was not found.');

  const facts = lines.slice(headingIndex + 1).flatMap((line) => {
    const match = line.match(row);
    return match ? [factFromRow(match, config)] : [];
  });
  if (facts.length === 0) throw new ExtractorError('PARSER_EMPTY', 'Registered PDF heading has no rows.');
  return facts;
}
