export type UniversityState =
  | 'official-list'
  | 'china-requirements'
  | 'faculty-only'
  | 'not-public'
  | 'pending';

export type SourceKind = 'official-list' | 'china-requirements' | 'faculty-page';
export type SourceHealth = 'ok' | 'redirected' | 'changed' | 'temporary-error' | 'unavailable' | 'unchecked';

export interface SourceLink {
  id: string;
  labelZh: string;
  url: string;
  kind: SourceKind;
  scopeZh?: string;
  cycle?: string;
}

export interface University {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  qs: { edition: 2027; rank: number };
  state: UniversityState;
  sources: SourceLink[];
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

export type StatusMap = Record<string, SourceStatus>;
export type SourceWithStatus = SourceLink & { status?: SourceStatus };
export type UniversityWithStatus = Omit<University, 'sources'> & { sources: SourceWithStatus[] };
