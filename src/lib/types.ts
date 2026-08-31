export type UniversityState =
  | 'official-list'
  | 'china-requirements'
  | 'faculty-only'
  | 'not-public'
  | 'pending';

export type DirectoryCategory = 'qs-directory' | 'specialist';
export type RankingProvider = 'qs' | 'the';
export type RankingPlacement = 'exact' | 'tied' | 'band' | 'unranked' | 'unverified';
export type DirectorySort = 'qs' | 'the' | 'name';

export interface RankingRelease {
  provider: RankingProvider;
  rankingName: string;
  edition: number;
  country: 'United Kingdom';
  sourceUrl: string;
  attribution: string;
  verifiedAt: string;
}

export interface RankingRecord {
  universityId: string;
  provider: RankingProvider;
  edition: number;
  placement: RankingPlacement;
  displayRank?: string;
  sortRank?: number;
}

export interface RankingDataset {
  releases: RankingRelease[];
  records: RankingRecord[];
}

export interface StrengthEvidence {
  kind: 'subject-ranking' | 'research-assessment';
  provider: 'qs' | 'shanghai' | 'ref';
  rankingName: string;
  subjectZh: string;
  edition: number;
  placement: 'exact' | 'band' | 'derived-national-exact';
  displayRank: string;
  sourceUrl: string;
  noteZh: string;
}

export interface QsDirectoryMembership {
  firstEdition: number;
  verifiedEdition: number;
  current: boolean;
}

export type SourceKind = 'official-list' | 'china-requirements' | 'faculty-page';
export type SourceHealth = 'ok' | 'redirected' | 'changed' | 'temporary-error' | 'unavailable' | 'unchecked';
export type SourceScope = 'university' | 'faculty' | 'programme';
export type ParserMode = 'html-table' | 'html-list' | 'html-grouped-items' | 'pdf-text' | 'link-only';
export type InstitutionRuleType = 'eligibility' | 'grade-threshold' | 'mixed' | 'none';
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

export interface ParserGroup {
  selector: string;
  tierOfficial?: string;
  tierSelector?: string;
}

export interface ParserScoreColumn {
  label: string;
  column: number;
}

export interface ParserConfig {
  mode: ParserMode;
  selector?: string;
  rowSelector?: string;
  institutionColumn?: number;
  institutionColumns?: number[];
  nameZhColumn?: number;
  tierColumn?: number;
  defaultTierOfficial?: string;
  scoreColumn?: number;
  scoreColumns?: ParserScoreColumn[];
  tableIndex?: number;
  splitOnBreaks?: boolean;
  dedupeExactRows?: boolean;
  allowMultipleFactsPerInstitution?: boolean;
  institutionPattern?: string;
  groups?: ParserGroup[];
  itemSelector?: string;
  headingPattern?: string;
  rowPattern?: string;
  guard: ParserGuard;
}

export interface InstitutionRule {
  type: InstitutionRuleType;
  summaryZh: string;
  listedMeaningZh?: string;
  unlistedMeaningZh?: string;
  caveatZh?: string;
  verification?: {
    reviewedAt: string;
    url: string;
    requiredText: string[];
  };
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
  institutionRule: InstitutionRule;
  parser: ParserConfig;
}

export interface University {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  directoryCategory: DirectoryCategory;
  qsDirectory?: QsDirectoryMembership;
  strengthEvidence?: StrengthEvidence;
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
  observedContentHash?: string;
  consecutiveFailures?: number;
  lastAttemptError?: string;
  error?: string;
}

export interface MastersCourseDirectory {
  id: string;
  universityId: string;
  labelZh: '查看全部硕士课程';
  url: string;
  pageTitle: string;
  reviewedAt: string;
  requiredText: string[];
  monitorMode: 'page-identity';
}

export type MastersCourseDirectoryWithStatus =
  MastersCourseDirectory & { status?: SourceStatus };

export type MastersScholarshipEntryKind =
  | 'masters-directory'
  | 'masters-search'
  | 'postgraduate-funding'
  | 'category';

export interface MastersScholarshipLink {
  id: string;
  universityId: string;
  labelZh: '查看硕士奖学金官网';
  scopeZh: string;
  kind: MastersScholarshipEntryKind;
  requiresFiltering: boolean;
  url: string;
  pageTitle: string;
  reviewedAt: string;
  requiredText: string[];
  monitorMode: 'page-identity';
}

export type MastersScholarshipEntryState = 'available' | 'no-public-entry';

interface MastersScholarshipEntryBase {
  universityId: string;
  entryState: MastersScholarshipEntryState;
  reviewedAt: string;
}

export interface AvailableMastersScholarshipEntry extends MastersScholarshipEntryBase {
  entryState: 'available';
  links: MastersScholarshipLink[];
}

export interface NoPublicMastersScholarshipEntry extends MastersScholarshipEntryBase {
  entryState: 'no-public-entry';
  links: [];
}

export type MastersScholarshipEntry =
  | AvailableMastersScholarshipEntry
  | NoPublicMastersScholarshipEntry;

export type MastersScholarshipLinkWithStatus =
  MastersScholarshipLink & { status?: SourceStatus };

export type MastersScholarshipEntryWithStatus =
  | (Omit<AvailableMastersScholarshipEntry, 'links'> & { links: MastersScholarshipLinkWithStatus[] })
  | NoPublicMastersScholarshipEntry;

export interface InstitutionRecord {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
}

export interface RequirementFact {
  id: string;
  universityId: string;
  sourceId: string;
  institutionId: string;
  institutionOfficial: string;
  institutionNameZh?: string;
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
export type UniversityWithStatus = Omit<University, 'sourceIds'> & {
  sources: SourceWithStatus[];
  rankings: Partial<Record<RankingProvider, RankingRecord>>;
};

export type UniversityDirectoryRecord = UniversityWithStatus & {
  mastersCourse: MastersCourseDirectoryWithStatus;
};
