import Fuse from 'fuse.js';
import type { InstitutionRecord } from './types';

const punctuation = /\p{P}+/gu;
const whitespace = /[\s\u3000]+/gu;

export function normalizeInstitutionName(name: string): string {
  return name
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(punctuation, ' ')
    .replace(whitespace, ' ')
    .trim();
}

function searchNames(record: InstitutionRecord): string[] {
  return [record.nameZh, record.nameEn, ...record.aliases];
}

function exactNameIndex(records: InstitutionRecord[]): Map<string, InstitutionRecord[]> {
  const byNormalizedName = new Map<string, InstitutionRecord[]>();
  for (const record of records) {
    for (const name of searchNames(record)) {
      const normalized = normalizeInstitutionName(name);
      const matches = byNormalizedName.get(normalized) ?? [];
      if (!matches.some((candidate) => candidate.id === record.id)) matches.push(record);
      byNormalizedName.set(normalized, matches);
    }
  }
  return byNormalizedName;
}

export function exactSearchNameCollisions(records: InstitutionRecord[]): Array<readonly [string, string[]]> {
  return [...exactNameIndex(records).entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([name, matches]) => [name, matches.map((record) => record.id).sort()] as const)
    .sort(([left], [right]) => left.localeCompare(right));
}

export function createInstitutionSearch(records: InstitutionRecord[]) {
  const byNormalizedName = exactNameIndex(records);

  const fuse = new Fuse(records, {
    threshold: 0.34,
    ignoreLocation: true,
    keys: [
      { name: 'nameZh', weight: 0.4 },
      { name: 'nameEn', weight: 0.4 },
      { name: 'aliases', weight: 0.2 },
    ],
  });

  return {
    find(query: string): InstitutionRecord[] {
      return byNormalizedName.get(normalizeInstitutionName(query)) ?? [];
    },
    suggest(query: string, limit = 5): InstitutionRecord[] {
      const normalized = normalizeInstitutionName(query);
      if (!normalized) return [];
      return fuse.search(normalized, { limit }).map(({ item }) => item);
    },
  };
}
