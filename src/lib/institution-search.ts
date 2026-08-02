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

function aliasConflict(name: string): Error & { code: 'ALIAS_CONFLICT' } {
  const error = new Error(`ALIAS_CONFLICT: ${name}`) as Error & { code: 'ALIAS_CONFLICT' };
  error.code = 'ALIAS_CONFLICT';
  return error;
}

export function createInstitutionSearch(records: InstitutionRecord[]) {
  const byNormalizedName = new Map<string, InstitutionRecord>();

  for (const record of records) {
    for (const name of [record.nameZh, record.nameEn, ...record.aliases]) {
      const normalized = normalizeInstitutionName(name);
      const existing = byNormalizedName.get(normalized);
      if (existing && existing.id !== record.id) throw aliasConflict(normalized);
      byNormalizedName.set(normalized, record);
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
      const match = byNormalizedName.get(normalizeInstitutionName(query));
      return match ? [match] : [];
    },
    suggest(query: string, limit = 5): InstitutionRecord[] {
      const normalized = normalizeInstitutionName(query);
      if (!normalized) return [];
      return fuse.search(normalized, { limit }).map(({ item }) => item);
    },
  };
}
