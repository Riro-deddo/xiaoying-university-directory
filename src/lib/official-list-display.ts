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
  ruleReviewedAt: string;
  ruleSourceUrl: string;
  scope: SourceScope;
  scopeZh: string;
  cycle?: string;
  extractedAt: string;
  rows: OfficialListDisplayRow[];
}

interface WorkingPanel extends OfficialListDisplayPanel {
  rowKeys: Set<string>;
}

function assertDisplayableRule(source: SourceWithStatus): asserts source is SourceWithStatus & {
  institutionRule: InstitutionRule & {
    type: Exclude<InstitutionRuleType, 'none'>;
    listedMeaningZh: string;
    unlistedMeaningZh: string;
    verification: { reviewedAt: string; url: string; requiredText: string[] };
  };
} {
  if (source.institutionRule.type === 'none') {
    throw new Error(`Source ${source.id} is requirements-only and cannot carry institution facts`);
  }
  if (!source.institutionRule.listedMeaningZh || !source.institutionRule.unlistedMeaningZh) {
    throw new Error(`Source ${source.id} has incomplete institution rule meaning`);
  }
  if (!source.institutionRule.verification) {
    throw new Error(`Source ${source.id} has no reviewed institution rule verification`);
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
        ruleReviewedAt: source.institutionRule.verification.reviewedAt,
        ruleSourceUrl: source.institutionRule.verification.url,
        scope: source.scope,
        scopeZh: source.scopeZh,
        ...(source.cycle ? { cycle: source.cycle } : {}),
        extractedAt: fact.extractedAt,
        rows: [],
        rowKeys: new Set<string>(),
      };
      panelsByKey.set(key, panel);
    }

    const rowKey = [
      institution.id,
      fact.institutionOfficial,
      fact.institutionNameZh ?? institution.nameZh,
      fact.tierOfficial,
      fact.scoreOfficial ?? '',
    ].join('\u0000');
    if (panel.rowKeys.has(rowKey)) {
      throw new Error(`Duplicate institution ${institution.id} in source ${source.id}`);
    }
    panel.rowKeys.add(rowKey);
    panel.extractedAt = fact.extractedAt > panel.extractedAt ? fact.extractedAt : panel.extractedAt;
    panel.rows.push({
      institutionId: institution.id,
      nameZh: fact.institutionNameZh ?? institution.nameZh,
      nameEn: fact.institutionOfficial,
      tierOfficial: fact.tierOfficial,
      ...(fact.scoreOfficial ? { scoreOfficial: fact.scoreOfficial } : {}),
    });
  }

  const result = new Map<string, OfficialListDisplayPanel[]>();
  for (const panel of panelsByKey.values()) {
    panel.rows.sort((left, right) =>
      left.nameZh.localeCompare(right.nameZh, 'zh-CN')
      || left.institutionId.localeCompare(right.institutionId)
      || (left.scoreOfficial ?? '').localeCompare(right.scoreOfficial ?? ''));

    const { rowKeys: _rowKeys, ...displayPanel } = panel;
    const universityPanels = result.get(panel.universityId) ?? [];
    universityPanels.push(displayPanel);
    result.set(panel.universityId, universityPanels);
  }

  for (const panels of result.values()) {
    panels.sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  }

  return result;
}
