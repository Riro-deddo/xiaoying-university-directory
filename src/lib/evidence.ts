import type { EvidenceState, OfficialSourceConfig, RequirementFact, SourceStatus } from './types';

export interface EvidenceInput {
  fact?: RequirementFact;
  source?: OfficialSourceConfig;
  status?: SourceStatus;
}

export interface EvidenceResult {
  state: EvidenceState;
  sourceId?: string;
  tierOfficial?: string;
  scoreOfficial?: string;
  scopeZh?: string;
  cycle?: string;
  lastSuccessfulAt?: string;
}

function sourceMetadata(input: EvidenceInput): Omit<EvidenceResult, 'state'> {
  const sourceId = input.source?.id ?? input.fact?.sourceId;
  const lastSuccessfulAt = input.status?.lastSuccessfulAt ?? input.fact?.extractedAt;
  return {
    ...(sourceId ? { sourceId } : {}),
    ...(lastSuccessfulAt ? { lastSuccessfulAt } : {}),
  };
}

function factEvidence(input: EvidenceInput, state: 'official-match' | 'faculty-match'): EvidenceResult {
  const fact = input.fact!;
  return {
    state,
    ...sourceMetadata(input),
    tierOfficial: fact.tierOfficial,
    ...(fact.scoreOfficial ? { scoreOfficial: fact.scoreOfficial } : {}),
    scopeZh: fact.scopeZh,
    ...(fact.cycle ? { cycle: fact.cycle } : {}),
  };
}

export function deriveEvidence(input: EvidenceInput): EvidenceResult {
  const health = input.status?.health;
  if (health === 'changed') return { state: 'source-changed', ...sourceMetadata(input) };
  if (health === 'unavailable' || health === 'temporary-error') {
    return { state: 'source-unavailable', ...sourceMetadata(input) };
  }

  if (input.fact?.scope === 'university') return factEvidence(input, 'official-match');
  if (input.fact) return factEvidence(input, 'faculty-match');

  if (input.source?.kind === 'official-list' && input.source.scope === 'university') {
    return { state: 'not-found-in-public-list', ...sourceMetadata(input) };
  }
  return { state: 'no-public-list', ...sourceMetadata(input) };
}
