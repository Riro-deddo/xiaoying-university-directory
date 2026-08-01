import Fuse from 'fuse.js';
import type { UniversityState, UniversityWithStatus } from './types';

function normalizeQuery(query: string): string {
  return query.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export function createUniversitySearch(records: UniversityWithStatus[]) {
  const ranked = [...records].sort((a, b) => a.qs.rank - b.qs.rank);
  const fuse = new Fuse(ranked, {
    threshold: 0.34,
    ignoreLocation: true,
    keys: [
      { name: 'nameZh', weight: 0.4 },
      { name: 'nameEn', weight: 0.4 },
      { name: 'aliases', weight: 0.2 },
    ],
  });

  return {
    search(query: string, states: UniversityState[]): UniversityWithStatus[] {
      const normalized = normalizeQuery(query);
      const matches = normalized ? fuse.search(normalized).map(({ item }) => item) : ranked;
      if (states.length === 0) return matches;
      const allowed = new Set(states);
      return matches.filter((record) => allowed.has(record.state));
    },
  };
}
