import type {
  InstitutionRecord,
  InstitutionRule,
  InstitutionRuleType,
  RequirementFact,
  SourceScope,
  SourceWithStatus,
  UniversityWithStatus,
} from './types';

export interface OfficialListDisplayRow {
  institutionId: string;
  nameZh: string;
  nameEn: string;
  tierOfficial: string;
  scoreOfficial?: string;
}

export interface OfficialListDisplayPanel {
  universityId: string;
  sourceId: string;
  sourceLabelZh: string;
  sourceUrl: string;
  ruleType: Exclude<InstitutionRuleType, 'none'>;
  ruleSummaryZh: string;
  listedMeaningZh: string;
  unlistedMeaningZh: string;
  caveatZh?: string;
  scope: SourceScope;
  scopeZh: string;
  cycle?: string;
  extractedAt: string;
  rows: OfficialListDisplayRow[];
}

interface WorkingPanel extends OfficialListDisplayPanel {
  institutionIds: Set<string>;
}

function assertDisplayableRule(source: SourceWithStatus): asserts source is SourceWithStatus & {
  institutionRule: InstitutionRule & {
    type: Exclude<InstitutionRuleType, 'none'>;
    listedMeaningZh: string;
    unlistedMeaningZh: string;
  };
} {
  if (source.institutionRule.type === 'none') {
    throw new Error(`Source ${source.id} is requirements-only and cannot carry institution facts`);
  }
  if (!source.institutionRule.listedMeaningZh || !source.institutionRule.unlistedMeaningZh) {
    throw new Error(`Source ${source.id} has incomplete institution rule meaning`);
  }
}

export function buildOfficialListDisplays(input: {
  universities: UniversityWithStatus[];
  institutions: InstitutionRecord[];
  requirements: RequirementFact[];
}): Map<string, OfficialListDisplayPanel[]> {
  const universityById = new Map(input.universities.map((university) => [university.id, university]));
  const institutionById = new Map(input.institutions.map((institution) => [institution.id, institution]));
  const panelsByKey = new Map<string, WorkingPanel>();

  for (const fact of input.requirements) {
    const university = universityById.get(fact.universityId);
    if (!university) {
      throw new Error(`Requirement ${fact.id} references missing university ${fact.universityId}`);
    }

    const source = university.sources.find((candidate) => candidate.id === fact.sourceId);
    if (!source || source.universityId !== university.id) {
      throw new Error(`Requirement ${fact.id} references a missing or mismatched source ${fact.sourceId}`);
    }
    assertDisplayableRule(source);
    if (source.parser.mode === 'link-only') {
      throw new Error(`Requirement ${fact.id} cannot be displayed from link-only source ${source.id}`);
    }

    const institution = institutionById.get(fact.institutionId);
    if (!institution) {
      throw new Error(`Requirement ${fact.id} references missing institution ${fact.institutionId}`);
    }

    const key = `${university.id}\u0000${source.id}`;
    let panel = panelsByKey.get(key);
    if (!panel) {
      panel = {
        universityId: university.id,
        sourceId: source.id,
        sourceLabelZh: source.labelZh,
        sourceUrl: source.url,
        ruleType: source.institutionRule.type,
        ruleSummaryZh: source.institutionRule.summaryZh,
        listedMeaningZh: source.institutionRule.listedMeaningZh,
        unlistedMeaningZh: source.institutionRule.unlistedMeaningZh,
        ...(source.institutionRule.caveatZh ? { caveatZh: source.institutionRule.caveatZh } : {}),
        scope: source.scope,
        scopeZh: source.scopeZh,
        ...(source.cycle ? { cycle: source.cycle } : {}),
        extractedAt: fact.extractedAt,
        rows: [],
        institutionIds: new Set<string>(),
      };
      panelsByKey.set(key, panel);
    }

    if (panel.institutionIds.has(institution.id)) {
      throw new Error(`Duplicate institution ${institution.id} in source ${source.id}`);
    }
    panel.institutionIds.add(institution.id);
    panel.extractedAt = fact.extractedAt > panel.extractedAt ? fact.extractedAt : panel.extractedAt;
    panel.rows.push({
      institutionId: institution.id,
      nameZh: institution.nameZh,
      nameEn: institution.nameEn,
      tierOfficial: fact.tierOfficial,
      ...(fact.scoreOfficial ? { scoreOfficial: fact.scoreOfficial } : {}),
    });
  }

  const result = new Map<string, OfficialListDisplayPanel[]>();
  for (const panel of panelsByKey.values()) {
    panel.rows.sort((left, right) =>
      left.nameZh.localeCompare(right.nameZh, 'zh-CN')
      || left.institutionId.localeCompare(right.institutionId));

    const { institutionIds: _institutionIds, ...displayPanel } = panel;
    const universityPanels = result.get(panel.universityId) ?? [];
    universityPanels.push(displayPanel);
    result.set(panel.universityId, universityPanels);
  }

  for (const panels of result.values()) {
    panels.sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  }

  return result;
}
