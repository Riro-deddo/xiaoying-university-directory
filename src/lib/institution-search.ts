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

export function createInstitutionSearch(records: InstitutionRecord[]) {
  const byNormalizedName = new Map<string, InstitutionRecord[]>();

  for (const record of records) {
    for (const name of [record.nameZh, record.nameEn, ...record.aliases]) {
      const normalized = normalizeInstitutionName(name);
      const matches = byNormalizedName.get(normalized) ?? [];
      if (!matches.some((candidate) => candidate.id === record.id)) matches.push(record);
      byNormalizedName.set(normalized, matches);
    }
  }

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
