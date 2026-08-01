export type UniversityState =
  | 'official-list'
  | 'china-requirements'
  | 'faculty-only'
  | 'not-public'
  | 'pending';

export type SourceKind = 'official-list' | 'china-requirements' | 'faculty-page';
export type SourceHealth = 'ok' | 'redirected' | 'changed' | 'temporary-error' | 'unavailable' | 'unchecked';
export type SourceScope = 'university' | 'faculty' | 'programme';
export type ParserMode = 'html-table' | 'html-list' | 'pdf-text' | 'link-only';
export type EvidenceState =
  | 'official-match'
  | 'faculty-match'
  | 'not-found-in-public-list'
  | 'no-public-list'
  | 'source-changed'
  | 'source-unavailable';

export interface QsCohortEntry {
  id: string;
  nameEn: string;
  rank: number;
  edition: 2027;
  country: 'United Kingdom';
}

export interface ParserGuard {
  minimumRecords: number;
  maximumRecords: number;
  maximumRemovalRatio: number;
}

export interface ParserConfig {
  mode: ParserMode;
  selector?: string;
  rowSelector?: string;
  institutionColumn?: number;
  tierColumn?: number;
  defaultTierOfficial?: string;
  scoreColumn?: number;
  headingPattern?: string;
  rowPattern?: string;
  guard: ParserGuard;
}

export interface OfficialSourceConfig {
  id: string;
  universityId: string;
  labelZh: string;
  url: string;
  kind: SourceKind;
  scope: SourceScope;
  scopeZh: string;
  cycle?: string;
  parser: ParserConfig;
}

export interface University {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  qs: { edition: 2027; rank: number };
  state: UniversityState;
  officialDomain: string;
  sourceIds: string[];
  noteZh?: string;
}

export interface SourceStatus {
  sourceId: string;
  health: SourceHealth;
  checkedAt?: string;
  lastSuccessfulAt?: string;
  httpStatus?: number;
  finalUrl?: string;
  etag?: string;
  lastModified?: string;
  contentHash?: string;
  error?: string;
}

export interface InstitutionRecord {
  id: string;
  nameZh?: string;
  nameEn: string;
  aliases: string[];
}

export interface RequirementFact {
  id: string;
  universityId: string;
  sourceId: string;
  institutionId: string;
  tierOfficial: string;
  tierZh?: string;
  scoreOfficial?: string;
  scope: SourceScope;
  scopeZh: string;
  cycle?: string;
  extractedAt: string;
  contentHash: string;
}

export type StatusMap = Record<string, SourceStatus>;
export type SourceWithStatus = OfficialSourceConfig & { status?: SourceStatus };
export type UniversityWithStatus = Omit<University, 'sourceIds'> & { sources: SourceWithStatus[] };
