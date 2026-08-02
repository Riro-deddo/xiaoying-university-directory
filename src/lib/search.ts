import Fuse from 'fuse.js';
import { deriveEvidence, type EvidenceResult } from './evidence';
import { createInstitutionSearch } from './institution-search';
import type { InstitutionRecord, RequirementFact, UniversityState, UniversityWithStatus } from './types';

export interface ReverseIndexEntry {
  institutionId: string;
  institutionOfficial: string;
  universityId: string;
  evidenceState: 'official-match' | 'faculty-match';
  tierOfficial: string;
  scoreOfficial?: string;
  scopeZh: string;
  sourceId: string;
  lastSuccessfulAt: string;
  cycle?: string;
}

export interface InstitutionEvidenceCard {
  university: UniversityWithStatus;
  evidence: EvidenceResult;
  sourceUrl?: string;
  sourceLabelZh?: string;
  ruleSourceUrl?: string;
  ruleReviewedAt?: string;
}

export type InstitutionEvidenceSearchResult =
  | { kind: 'empty'; suggestions: InstitutionRecord[] }
  | { kind: 'unknown'; suggestions: InstitutionRecord[] }
  | { kind: 'suggestions'; suggestions: InstitutionRecord[] }
  | { kind: 'selected'; institution: InstitutionRecord; cards: InstitutionEvidenceCard[] };

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
      const exact = ranked.filter((record) =>
        [record.nameZh, record.nameEn, ...record.aliases]
          .some((value) => normalizeQuery(value).toLocaleLowerCase() === normalized.toLocaleLowerCase()),
      );
      const matches = normalized ? (exact.length > 0 ? exact : fuse.search(normalized).map(({ item }) => item)) : ranked;
      if (states.length === 0) return matches;
      const allowed = new Set(states);
      return matches.filter((record) => allowed.has(record.state));
    },
  };
}

function evidencePriority(state: EvidenceResult['state']): number {
  return {
    'source-changed': 0,
    'source-unavailable': 1,
    'official-match': 2,
    'faculty-match': 3,
    'not-found-in-public-list': 4,
    'no-public-list': 5,
  }[state];
}

function factFromIndex(entry: ReverseIndexEntry): RequirementFact {
  return {
    id: `${entry.institutionId}-${entry.universityId}-${entry.sourceId}`,
    institutionId: entry.institutionId,
    institutionOfficial: entry.institutionOfficial,
    universityId: entry.universityId,
    sourceId: entry.sourceId,
    tierOfficial: entry.tierOfficial,
    ...(entry.scoreOfficial ? { scoreOfficial: entry.scoreOfficial } : {}),
    scope: entry.evidenceState === 'official-match' ? 'university' : 'faculty',
    scopeZh: entry.scopeZh,
    ...(entry.cycle ? { cycle: entry.cycle } : {}),
    extractedAt: entry.lastSuccessfulAt,
    contentHash: '',
  };
}

export function createInstitutionEvidenceSearch({
  institutions,
  universities,
  reverseIndex,
}: {
  institutions: InstitutionRecord[];
  universities: UniversityWithStatus[];
  reverseIndex: ReverseIndexEntry[];
}) {
  const institutionSearch = createInstitutionSearch(institutions);
  const institutionsById = new Map(institutions.map((institution) => [institution.id, institution]));

  function select(institutionId: string): InstitutionEvidenceSearchResult {
    const institution = institutionsById.get(institutionId);
    if (!institution) return { kind: 'unknown', suggestions: [] };

    const cards = [...universities]
      .sort((left, right) => left.qs.rank - right.qs.rank)
      .map((university) => {
        const entries = reverseIndex.filter((entry) =>
          entry.institutionId === institution.id && entry.universityId === university.id,
        );
        const candidates = university.sources.map((source) => {
          const entry = entries.find((item) => item.sourceId === source.id);
          return {
            evidence: deriveEvidence({
              ...(entry ? { fact: factFromIndex(entry) } : {}),
              source,
              status: source.status,
            }),
            source,
          };
        });
        const selected = candidates.sort((left, right) =>
          evidencePriority(left.evidence.state) - evidencePriority(right.evidence.state),
        )[0] ?? { evidence: deriveEvidence({}), source: undefined };
        return {
          university,
          evidence: selected.evidence,
          sourceUrl: selected.source?.url ?? university.officialDomain,
          sourceLabelZh: selected.source?.labelZh ?? '大学官网',
          ...(selected.source?.institutionRule.verification ? {
            ruleSourceUrl: selected.source.institutionRule.verification.url,
            ruleReviewedAt: selected.source.institutionRule.verification.reviewedAt,
          } : {}),
        };
      });

    return { kind: 'selected', institution, cards };
  }

  return {
    search(query: string): InstitutionEvidenceSearchResult {
      if (!normalizeQuery(query)) return { kind: 'empty', suggestions: [] };
      const [exact] = institutionSearch.find(query);
      if (exact) return select(exact.id);
      const suggestions = institutionSearch.suggest(query);
      return suggestions.length > 0 ? { kind: 'suggestions', suggestions } : { kind: 'unknown', suggestions: [] };
    },
    select,
  };
}
