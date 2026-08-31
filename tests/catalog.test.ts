import { describe, expect, it } from 'vitest';
import cohort from '../src/data/qs-2027-top-200-uk.json';
import universities from '../src/data/universities.json';
import sources from '../src/data/sources.json';
import institutions from '../src/data/institutions.json';
import requirements from '../src/data/generated/requirements.json';
import audit from '../src/data/china-rule-audit.json';
import baseline from './fixtures/pending-china-audit-baseline.json';
import statuses from '../src/data/status.json';
import { loadChinaRuleAudit, loadUniversities } from '../src/lib/data';
import { normalizeInstitutionName } from '../src/lib/institution-search';
import { expectUnacceptedLinkOnlyStatus } from './helpers/source-status';

const officialBaseHost = (url: string) => new URL(url).hostname.replace(/^www\./u, '');
const leedsSourceIds = [
  'leeds-business-china',
  'leeds-computer-science-media-china',
  'leeds-other-schools-a-l-china',
  'leeds-other-schools-m-z-china',
] as const;
const replacedBaselineSourceIds = new Set(['leeds-china', 'nottingham-china']);
const sha256 = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(JSON.stringify(value)),
)), (byte) => byte.toString(16).padStart(2, '0')).join('');

describe('QS cohort and official source registry', () => {
  it('freezes only the official QS 2027 UK top-200 cohort', () => {
    expect(cohort.edition).toBe(2027);
    expect(cohort.sourceUrl).toContain('topuniversities.com/world-university-rankings');
    expect(cohort.universities.length).toBeGreaterThan(20);
    expect(cohort.universities.every((item) => item.rank >= 1 && item.rank <= 200)).toBe(true);
    expect(new Set(cohort.universities.map((item) => item.id)).size).toBe(cohort.universities.length);
  });

  it('keeps every frozen top-200 university in the complete current QS directory', () => {
    const cohortIds = new Set(cohort.universities.map((item) => item.id));
    const rankedUniversityIds = new Set(universities
      .filter((item) => item.directoryCategory === 'qs-directory')
      .map((item) => item.id));
    expect([...cohortIds].every((id) => rankedUniversityIds.has(id))).toBe(true);
  });

  it('records the reviewed China-rule batches while retaining only the two blocked universities', () => {
    const cohortIds = [...cohort.universities.map((item) => item.id)].sort();
    const batchReviewedIds = [
      'loughborough-university', 'university-of-strathclyde', 'university-of-surrey', 'university-of-sussex',
      'university-of-leicester', 'swansea-university', 'heriot-watt-university', 'brunel-university-of-london',
      'birkbeck-university-of-london', 'city-st-georges-university-of-london', 'oxford-brookes-university',
      'university-of-kent', 'aston-university', 'university-of-essex', 'university-of-dundee',
      'soas-university-of-london', 'royal-holloway-university-of-london', 'university-of-bradford',
      'university-of-huddersfield', 'northumbria-university', 'university-of-stirling', 'bangor-university',
      'university-of-hull', 'coventry-university',
      'ulster-university', 'manchester-metropolitan-university', 'nottingham-trent-university',
      'university-of-portsmouth', 'kingston-university-london', 'university-of-plymouth',
      'goldsmiths-university-of-london', 'university-of-the-west-of-england', 'university-of-greenwich',
      'aberystwyth-university', 'bournemouth-university', 'edinburgh-napier-university', 'keele-university',
      'de-montfort-university', 'liverpool-john-moores-university', 'university-of-hertfordshire',
      'university-of-lincoln', 'university-of-westminster', 'london-south-bank-university',
      'middlesex-university', 'university-of-brighton', 'anglia-ruskin-university',
      'birmingham-city-university', 'glasgow-caledonian-university', 'leeds-beckett-university',
      'robert-gordon-university', 'sheffield-hallam-university', 'university-of-lancashire',
      'university-of-derby', 'canterbury-christ-church-university',
      'university-of-aberdeen', 'university-of-east-anglia', 'london-metropolitan-university',
      'university-of-roehampton', 'university-of-salford', 'university-of-wolverhampton',
      'queen-margaret-university-edinburgh', 'university-of-northampton', 'university-of-south-wales',
    ];
    const reviewedIds = universities
      .filter((item) => item.directoryCategory === 'qs-directory' && item.state !== 'pending')
      .map((item) => item.id)
      .sort();

    expect(reviewedIds).toEqual([...cohortIds, ...batchReviewedIds].sort());
    expect(universities.filter((item) => item.state === 'pending').map((item) => item.id).sort()).toEqual([
      'university-of-east-london',
      'university-of-the-arts-london',
    ]);
  });

  it('preserves the reviewed China-rule findings and records their lifecycle', () => {
    expect(loadChinaRuleAudit()).toEqual(audit);
    expect(audit).toHaveLength(101);
    expect(audit.filter((row) => row.expectedState !== 'pending')).toHaveLength(99);
    expect(audit.filter((row) => row.reviewStatus === 'reviewed')).toHaveLength(99);
    expect(audit.filter((row) => row.reviewStatus === 'blocked')).toHaveLength(2);
    expect(audit.filter((row) => row.reviewStatus === 'unreviewed')).toHaveLength(0);
    expect(audit.filter((row) => !['university-of-leeds', 'university-of-nottingham'].includes(row.universityId)
      && baseline.nonTargetAuditRows.some((baselineRow) => baselineRow.universityId === row.universityId))
      .map(({ reviewStatus: _reviewStatus, ...row }) => row))
      .toEqual(baseline.nonTargetAuditRows.filter((row) => !['university-of-leeds', 'university-of-nottingham'].includes(row.universityId)));
    expect(audit.filter((row) => row.expectedState === 'official-list').map((row) => row.universityId).sort()).toEqual([
      'loughborough-university',
      'university-college-london',
      'university-of-bristol',
      'university-of-cambridge',
      'university-of-edinburgh',
      'university-of-glasgow',
      'university-of-leeds',
      'university-of-nottingham',
      'university-of-sheffield',
      'university-of-southampton',
      'university-of-warwick',
    ].sort());
    expect(audit.find((row) => row.universityId === 'university-of-manchester')).toMatchObject({
      expectedState: 'china-requirements',
      directoryCategory: 'qs-directory',
    });
    expect(audit.find((row) => row.universityId === 'university-of-exeter')).toMatchObject({
      expectedState: 'not-public',
      finding: expect.stringMatching(/2026.*removed.*ranking.*all.*Ministry of Education.*uniform/i),
    });
  });

  it('gives every university exactly one matching China-rule audit row', () => {
    const loadedUniversities = loadUniversities();
    const auditRowsByUniversity = new Map<string, typeof audit>();
    for (const row of audit) {
      auditRowsByUniversity.set(row.universityId, [...(auditRowsByUniversity.get(row.universityId) ?? []), row]);
    }

    expect(audit).toHaveLength(loadedUniversities.length);
    for (const university of loadedUniversities) {
      expect(auditRowsByUniversity.get(university.id)).toHaveLength(1);
      expect(auditRowsByUniversity.get(university.id)?.[0]).toMatchObject({
        directoryCategory: university.directoryCategory,
        expectedState: university.state,
      });
    }
  });

  it('preserves the pending-source baseline and generated requirements digest', async () => {
    const batchReviewedIds = new Set([
      'loughborough-university', 'university-of-strathclyde', 'university-of-surrey', 'university-of-sussex',
      'university-of-leicester', 'swansea-university', 'heriot-watt-university', 'brunel-university-of-london',
      'birkbeck-university-of-london', 'city-st-georges-university-of-london', 'oxford-brookes-university',
      'university-of-kent', 'aston-university', 'university-of-essex', 'university-of-dundee',
      'soas-university-of-london', 'royal-holloway-university-of-london', 'university-of-bradford',
      'university-of-huddersfield', 'northumbria-university', 'university-of-stirling', 'bangor-university',
      'university-of-hull', 'coventry-university',
      'ulster-university', 'manchester-metropolitan-university', 'nottingham-trent-university',
      'university-of-portsmouth', 'kingston-university-london', 'university-of-plymouth',
      'goldsmiths-university-of-london', 'university-of-the-west-of-england', 'university-of-greenwich',
      'aberystwyth-university', 'bournemouth-university', 'edinburgh-napier-university', 'keele-university',
      'de-montfort-university', 'liverpool-john-moores-university', 'university-of-hertfordshire',
      'university-of-lincoln', 'university-of-westminster', 'london-south-bank-university',
      'middlesex-university', 'university-of-brighton', 'anglia-ruskin-university',
      'birmingham-city-university', 'glasgow-caledonian-university', 'leeds-beckett-university',
      'robert-gordon-university', 'sheffield-hallam-university', 'university-of-lancashire',
      'university-of-derby', 'canterbury-christ-church-university',
      'university-of-aberdeen', 'university-of-east-anglia', 'london-metropolitan-university',
      'university-of-roehampton', 'university-of-salford', 'university-of-wolverhampton',
      'queen-margaret-university-edinburgh', 'university-of-northampton', 'university-of-south-wales',
    ]);
    expect(universities.filter((university) => university.state === 'pending').map((university) => university.id))
      .toEqual(baseline.pendingUniversityIds.filter((id) => !batchReviewedIds.has(id)));
    const preservedBaselineSources = baseline.sourceConfigs
      .filter((source) => !replacedBaselineSourceIds.has(source.id));
    const preExistingSourceIds = new Set(preservedBaselineSources.map((source) => source.id));
    expect(sources.filter((source) => preExistingSourceIds.has(source.id))).toEqual(preservedBaselineSources);
    const baselineRequirements = requirements.filter((fact) => preExistingSourceIds.has(fact.sourceId));
    expect(baselineRequirements).toHaveLength(5586);
    expect(await sha256(baselineRequirements)).toBe('dc061732aa95ced1da2198a0fc058222859ae0575c63a95c15ce9b0840413e52');
  });

  it.each([
    ['official-list', [
      'loughborough-university',
      'university-college-london',
      'university-of-bristol',
      'university-of-cambridge',
      'university-of-edinburgh',
      'university-of-glasgow',
      'university-of-leeds',
      'university-of-nottingham',
      'university-of-sheffield',
      'university-of-southampton',
      'university-of-warwick',
    ]],
    ['china-requirements', [
      'birkbeck-university-of-london',
      'brunel-university-of-london',
      'city-st-georges-university-of-london',
      'cranfield-university',
      'heriot-watt-university',
      'imperial-college-london',
      'kings-college-london',
      'lancaster-university',
      'london-school-of-economics-and-political-science',
      'london-school-of-hygiene-and-tropical-medicine',
      'royal-college-of-music',
      'swansea-university',
      'newcastle-university',
      'oxford-brookes-university',
      'queen-mary-university-of-london',
      'queens-university-belfast',
      'university-of-birmingham',
      'university-of-leicester',
      'university-of-liverpool',
      'university-of-manchester',
      'university-of-oxford',
      'university-of-reading',
      'university-of-st-andrews',
      'university-of-strathclyde',
      'university-of-surrey',
      'university-of-sussex',
      'university-of-york',
      'cardiff-university',
      'university-of-kent',
      'aston-university',
      'university-of-essex',
      'university-of-dundee',
      'soas-university-of-london',
      'royal-holloway-university-of-london',
      'university-of-bradford',
      'university-of-huddersfield',
      'northumbria-university',
      'university-of-stirling',
      'bangor-university',
      'university-of-hull',
      'coventry-university',
      'ulster-university',
      'manchester-metropolitan-university',
      'nottingham-trent-university',
      'university-of-portsmouth',
      'kingston-university-london',
      'university-of-plymouth',
      'goldsmiths-university-of-london',
      'university-of-the-west-of-england',
      'university-of-greenwich',
      'aberystwyth-university',
      'bournemouth-university',
      'edinburgh-napier-university',
      'keele-university',
      'de-montfort-university',
      'liverpool-john-moores-university',
      'university-of-hertfordshire',
      'university-of-lincoln',
      'university-of-westminster',
      'london-south-bank-university',
      'middlesex-university',
      'university-of-brighton',
      'anglia-ruskin-university',
      'birmingham-city-university',
      'glasgow-caledonian-university',
      'leeds-beckett-university',
      'robert-gordon-university',
      'sheffield-hallam-university',
      'university-of-lancashire',
      'university-of-derby',
      'canterbury-christ-church-university',
      'university-of-aberdeen',
      'university-of-east-anglia',
      'london-metropolitan-university',
      'university-of-roehampton',
      'university-of-salford',
      'university-of-wolverhampton',
      'queen-margaret-university-edinburgh',
      'university-of-northampton',
      'university-of-south-wales',
    ]],
    ['not-public', [
      'durham-university',
      'institute-of-cancer-research-london',
      'liverpool-school-of-tropical-medicine',
      'london-business-school',
      'royal-college-of-art',
      'royal-veterinary-college',
      'university-of-bath',
      'university-of-exeter',
    ]],
  ])('assigns the reviewed %s state to exactly the approved universities', (state, expectedIds) => {
    const actualIds = universities
      .filter((university) => university.state === state)
      .map((university) => university.id)
      .sort();

    expect(actualIds).toEqual([...expectedIds].sort());
  });

  it('registers reviewed link-only semantics for every China-rule source', () => {
    const recheckedSources = new Set([
      'aberdeen-china-entry-requirements',
      'uea-china-country-requirements',
      'london-metropolitan-china-requirements',
      'roehampton-china-requirements',
      'salford-china-requirements',
      'wolverhampton-china-requirements',
      'qmu-china-requirements',
      'northampton-china-entry-requirements',
      'usw-china-entry-requirements',
    ]);
    const newlyReviewedSources = new Set([
      'cranfield-china-entry',
      'lshtm-china-entry',
      'rca-postgraduate-entry',
      'rvc-international-entry',
      'rcm-china-entry',
      'icr-msc-oncology-entry',
      'lstm-postgraduate-entry',
      'loughborough-china-institution-lookup',
      'strathclyde-china-entry',
      'surrey-china-entry',
      'sussex-china-entry',
      'leicester-china-entry',
      'swansea-china-pgt-entry',
      'heriot-watt-china-pgt-entry',
      'brunel-china-entry',
      'birkbeck-china-entry',
      'city-st-georges-international-commercial-law-china',
      'oxford-brookes-china-entry',
      'kent-china-requirements', 'aston-china-requirements', 'essex-china-requirements',
      'dundee-china-requirements', 'soas-china-requirements', 'royal-holloway-china-requirements',
      'dundee-international-business-management-china-requirements',
      'bradford-china-requirements', 'huddersfield-china-requirements', 'northumbria-china-requirements',
      'stirling-china-requirements', 'bangor-china-requirements', 'hull-china-requirements',
      'coventry-china-requirements',
      'ulster-china-requirements', 'manchester-metropolitan-china-requirements',
      'nottingham-trent-china-requirements', 'portsmouth-china-requirements',
      'kingston-china-requirements', 'plymouth-china-requirements',
      'goldsmiths-china-requirements', 'uwe-china-requirements', 'greenwich-china-requirements',
      'aberystwyth-china-requirements', 'bournemouth-china-requirements',
      'edinburgh-napier-china-requirements', 'keele-china-requirements',
      'dmu-china-requirements', 'ljmu-china-requirements', 'hertfordshire-china-requirements',
      'lincoln-china-requirements', 'westminster-china-requirements', 'lsbu-china-requirements',
      'middlesex-china-requirements', 'brighton-china-requirements', 'aru-china-requirements',
      'bcu-china-requirements', 'gcu-china-requirements', 'leeds-beckett-china-requirements',
      'rgu-china-requirements', 'shu-china-entry-requirements', 'lancashire-china-requirements',
      'derby-mainland-china-international-entry', 'cccu-china-requirements',
    ]);
    const leedsUpdatedSources = new Set<string>(leedsSourceIds);
    for (const source of sources) {
      expect(source.url).toMatch(/^https:\/\//u);
      expect(source.scopeZh.trim()).toBeTruthy();
      expect(source.institutionRule.summaryZh.trim()).toBeTruthy();
      expect(source.institutionRule.verification).toMatchObject({
        reviewedAt: source.id === 'nottingham-china'
          ? '2026-08-31'
          : leedsUpdatedSources.has(source.id)
          ? '2026-08-30'
          : recheckedSources.has(source.id)
          ? '2026-08-10'
          : newlyReviewedSources.has(source.id) ? '2026-08-09' : '2026-08-02',
        url: expect.stringMatching(/^https:\/\//u),
      });
      expect(source.institutionRule.verification?.requiredText.length).toBeGreaterThan(1);
    }
  });

  it('uses KCL’s current China & Globalisation MSc China-equivalency display without inventing a university-owned roster', () => {
    const source = sources.find((item) => item.id === 'kcl-china');

    expect(source).toMatchObject({
      url: 'https://www.kcl.ac.uk/study/postgraduate-taught/courses/china-and-globalisation-msc/requirements',
      labelZh: '中国与全球化理学硕士中国学历要求',
      scope: 'programme',
      institutionRule: {
        type: 'none',
      },
    });
    expect(source?.institutionRule.verification?.requiredText).toEqual(expect.arrayContaining([
      'Equivalent International qualifications',
      'China & Globalisation MSc',
      'September 2026',
    ]));
    expect(source?.institutionRule.summaryZh).toContain('选择 China');
    expect(source?.institutionRule.summaryZh).toContain('80%');
    expect(source?.institutionRule.summaryZh).toContain('85%');
    expect(source?.institutionRule.summaryZh).toContain('仅适用于中国与全球化理学硕士');
    expect(source?.institutionRule.summaryZh).toContain('完整名单未公开');
    for (const outOfScopePhrase of ['指定课程', 'UK ENIC', 'Project 211', '双一流']) {
      expect(source?.institutionRule.summaryZh).not.toContain(outOfScopePhrase);
    }
    expect(source?.url).not.toContain('/study-legacy/');
  });

  it('registers all nine reviewed public lists with guarded structured parsers', () => {
    const expectedSourceSemantics = [
      ['cambridge-china', 'grade-threshold', 'html-grouped-items', 80],
      ['ucl-china', 'grade-threshold', 'html-table'],
      ['edinburgh-china', 'mixed', 'pdf-text'],
      ['bristol-china', 'eligibility', 'html-table', 300],
      ['warwick-china', 'eligibility', 'html-table', 250],
      ['glasgow-china', 'eligibility', 'pdf-text', 500],
      ['sheffield-china', 'grade-threshold', 'html-table', 2800],
      ['nottingham-china', 'grade-threshold', 'html-table', 150],
      ['southampton-china', 'grade-threshold', 'html-grouped-items', 500],
    ] as const;

    for (const [sourceId, ruleType, parserMode, minimumRecords] of expectedSourceSemantics) {
      expect(sources.find((source) => source.id === sourceId)).toMatchObject({
        kind: 'official-list',
        scope: 'university',
        institutionRule: { type: ruleType },
        parser: { mode: parserMode },
      });
      if (minimumRecords !== undefined) {
        expect(sources.find((source) => source.id === sourceId)?.parser.guard.minimumRecords).toBe(minimumRecords);
      }
    }
    expect(sources.find((source) => source.id === 'ucl-china')?.parser.guard.minimumRecords).toBe(84);
    expect(sources.find((source) => source.id === 'edinburgh-china')?.parser.guard.minimumRecords).toBe(81);
  });

  it('records Manchester as scoped institution-sensitive requirements without inventing a public roster', () => {
    const sourceIds = [
      'manchester-china',
      'manchester-computer-science-china',
      'manchester-law-china',
    ];

    expect(universities.find((university) => university.id === 'university-of-manchester')?.sourceIds).toEqual(sourceIds);
    for (const sourceId of sourceIds) {
      expect(sources.find((source) => source.id === sourceId)).toMatchObject({
        parser: { mode: 'link-only' },
        institutionRule: { type: 'none' },
      });
    }
    expect(sources.find((source) => source.id === 'manchester-law-china')?.institutionRule.summaryZh)
      .not.toMatch(/公开.*名单/u);
  });

  it('records Exeter’s current 2026 uniform rule instead of the historical ranking PDF', () => {
    const source = sources.find((item) => item.id === 'exeter-china');

    expect(source).toMatchObject({
      kind: 'china-requirements',
      scope: 'university',
      institutionRule: { type: 'none' },
    });
    expect(source?.institutionRule.summaryZh).toMatch(/2026.*取消.*排名.*教育部.*75%.*70%/u);
    expect(source?.url).not.toMatch(/\.pdf(?:$|\?)/u);
  });

  it('references only explicitly registered official sources', () => {
    const sourceIds = new Set(sources.map((source) => source.id));
    expect(universities.flatMap((item) => item.sourceIds)
      .every((id) => sourceIds.has(id))).toBe(true);
  });

  it('registers and links the LBS Masters in Management source', () => {
    expect(universities.find((item) => item.id === 'london-business-school')?.sourceIds).toEqual(['lbs-mim-entry']);
    expect(sources.find((item) => item.id === 'lbs-mim-entry')).toMatchObject({
      universityId: 'london-business-school',
      url: 'https://www.london.edu/masters-degrees/masters-in-management/apply',
      institutionRule: {
        verification: { reviewedAt: '2026-08-02' },
      },
    });
  });

  it.each([
    ['lshtm-china-entry', 'london-school-of-hygiene-and-tropical-medicine', 'https://www.lshtm.ac.uk/study/international/country-region-information/china', 'university'],
    ['cranfield-china-entry', 'cranfield-university', 'https://www.cranfield.ac.uk/china', 'university'],
    ['rca-postgraduate-entry', 'royal-college-of-art', 'https://www.rca.ac.uk/study/apply-to-study/', 'university'],
    ['rvc-international-entry', 'royal-veterinary-college', 'https://www.rvc.ac.uk/study/international-students/how-to-apply', 'university'],
    ['rcm-china-entry', 'royal-college-of-music', 'https://www.rcm.ac.uk/international/china/', 'university'],
    ['icr-msc-oncology-entry', 'institute-of-cancer-research-london', 'https://www.icr.ac.uk/study-and-careers/opportunities-for-clinicians/msc-in-oncology', 'programme'],
    ['lstm-postgraduate-entry', 'liverpool-school-of-tropical-medicine', 'https://lstmed.ac.uk/study/', 'university'],
  ])('registers reviewed specialist source %s', (sourceId, universityId, url, scope) => {
    const university = universities.find((item) => item.id === universityId);
    expect(university).toBeDefined();
    expect(university?.sourceIds).toContain(sourceId);
    expect(sources.find((item) => item.id === sourceId)).toMatchObject({
      universityId,
      url,
      kind: 'china-requirements',
      scope,
      institutionRule: { type: 'none', verification: { reviewedAt: '2026-08-09' } },
      parser: { mode: 'link-only' },
    });
    expectUnacceptedLinkOnlyStatus((statuses as Record<string, unknown>)[sourceId], sourceId);
    expect(requirements.some((fact) => fact.sourceId === sourceId)).toBe(false);
  });

  it('keeps the ICR application summary within its narrow clinical programme scope', () => {
    const summary = sources.find((source) => source.id === 'icr-msc-oncology-entry')?.institutionRule.summaryZh ?? '';
    for (const phrase of ['医学学位', '两年临床经验', 'GMC', '在英临床岗位', '不是面向普通国际学生']) {
      expect(summary).toContain(phrase);
    }
  });

  it('uses HTTPS official domains and keeps every registered source on its university domain', () => {
    const universityById = new Map(universities.map((university) => [university.id, university]));
    const sourceById = new Map(sources.map((source) => [source.id, source]));

    for (const university of universities) {
      expect(university.officialDomain).toMatch(/^https:\/\//u);
      for (const sourceId of university.sourceIds) {
        const source = sourceById.get(sourceId);
        expect(source?.universityId).toBe(university.id);
        const sourceHost = officialBaseHost(source!.url);
        const officialHost = officialBaseHost(universityById.get(university.id)!.officialDomain);
        const approvedFirstPartyAlias = university.id === 'university-of-greenwich'
          && sourceHost === 'gre.ac.uk'
          && officialHost === 'greenwich.ac.uk';
        expect(sourceHost === officialHost || sourceHost.endsWith(`.${officialHost}`) || approvedFirstPartyAlias).toBe(true);
      }
    }
  });

  it('registers deterministic facts for the three directly published official lists', () => {
    for (const sourceId of ['ucl-china', 'edinburgh-china']) {
      const source = sources.find((item) => item.id === sourceId);
      expect(source?.parser.mode).not.toBe('link-only');
      const facts = requirements.filter((item) => item.sourceId === sourceId);
      expect(facts.length).toBeGreaterThan(0);
      expect(facts.every((fact) => institutions.some((institution) => institution.id === fact.institutionId))).toBe(true);
    }
  });

  it('keeps generated facts refreshable and free from placeholders', () => {
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(requirements.every((fact) => sourceById.get(fact.sourceId)?.parser.mode !== 'link-only')).toBe(true);
    expect(requirements.every((fact) => /^[a-f0-9]{64}$/u.test(fact.contentHash) && fact.contentHash !== emptyHash)).toBe(true);
    const userFacingStrings = [
      ...universities.flatMap((item) => [item.nameZh, item.nameEn, ...item.aliases, 'noteZh' in item ? item.noteZh : undefined]),
      ...sources.flatMap((source) => [
        source.labelZh,
        source.scopeZh,
        source.parser.defaultTierOfficial,
        source.institutionRule.summaryZh,
        source.institutionRule.listedMeaningZh,
        source.institutionRule.unlistedMeaningZh,
        source.institutionRule.caveatZh,
      ]),
      ...institutions.flatMap((institution) => [institution.nameZh, institution.nameEn, ...institution.aliases]),
      ...requirements.flatMap((fact) => [fact.tierOfficial, 'scoreOfficial' in fact ? fact.scoreOfficial : undefined, fact.scopeZh]),
    ].filter((value): value is string => typeof value === 'string');
    expect(userFacingStrings.every((value) => value.trim().length > 0 && !/[?\uFFFD]/u.test(value))).toBe(true);
    for (const source of sources.filter((item) => item.parser.mode !== 'link-only')) {
      const count = requirements.filter((fact) => fact.sourceId === source.id).length;
      expect(count).toBeGreaterThanOrEqual(source.parser.guard.minimumRecords);
      expect(count).toBeLessThanOrEqual(source.parser.guard.maximumRecords);
    }
  });

  it('preserves registered source scope and configured official tiers exactly', () => {
    const sourceById = new Map(sources.map((source) => [source.id, source]));

    for (const fact of requirements) {
      const source = sourceById.get(fact.sourceId)!;
      expect(fact.scope).toBe(source.scope);
      expect(fact.scopeZh).toBe(source.scopeZh);
      expect(fact.tierOfficial.trim()).toBeTruthy();
      if (!('tierColumn' in source.parser) && !('groups' in source.parser)) {
        expect(fact.tierOfficial).toBe(source.parser.defaultTierOfficial);
      }
      if (source.cycle) expect(fact.cycle).toBe(source.cycle);
    }
  });

  it('keeps accepted parser counts for every confirmed public list', () => {
    const publicListSourceIds = [
      'cambridge-china', 'warwick-china', 'bristol-china', 'glasgow-china',
      'nottingham-china', 'sheffield-china', 'southampton-china', 'ucl-china', 'edinburgh-china',
    ];
    for (const sourceId of publicListSourceIds) {
      const source = sources.find((item) => item.id === sourceId)!;
      const count = requirements.filter((fact) => fact.sourceId === sourceId).length;
      expect(count).toBeGreaterThanOrEqual(source.parser.guard.minimumRecords);
      expect(count).toBeLessThanOrEqual(source.parser.guard.maximumRecords);
    }

    const linkOnlyIds = new Set(sources
      .filter((source) => source.parser.mode === 'link-only')
      .map((source) => source.id));
    expect(requirements.every((fact) => !linkOnlyIds.has(fact.sourceId))).toBe(true);
  });

  it('keeps Glasgow bilingual PDF facts free of fragments, mojibake, and unreviewed English collisions', () => {
    const glasgowFacts = requirements.filter((fact) => fact.sourceId === 'glasgow-china');
    const expectedEnglishByChinese = new Map([
      ['湖南工学院', 'Hunan Institute of Technology'],
      ['鞍山师范学院', 'Anshan Normal University'],
      ['哈尔滨学院', 'Harbin University'],
      ['湖北工程学院', 'Hubei Engineering University'],
    ]);
    const allowedEnglishCollisions = new Set(['taizhou university', 'wuyi university']);
    const chineseByEnglish = new Map<string, Set<string>>();

    for (const fact of glasgowFacts) {
      expect(fact.institutionOfficial.trim().split(/\s+/u).length).toBeGreaterThan(1);
      expect(Array.from(String(fact.scoreOfficial ?? '')).some((character) => ['\u00ef', '\u00bc', '\ufffd'].includes(character))).toBe(false);
      const english = fact.institutionOfficial.trim().toLocaleLowerCase('en-US');
      const chinese = fact.institutionNameZh?.trim();
      if (chinese) chineseByEnglish.set(english, new Set([...(chineseByEnglish.get(english) ?? []), chinese]));
    }

    for (const [chinese, expectedEnglish] of expectedEnglishByChinese) {
      expect(glasgowFacts.find((fact) => fact.institutionNameZh === chinese)?.institutionOfficial).toBe(expectedEnglish);
    }
    for (const [english, chineseNames] of chineseByEnglish) {
      if (chineseNames.size > 1) expect(allowedEnglishCollisions).toContain(english);
    }
  });

  it('keeps Glasgow-linked registry English names unique after removing parser-corrupted aliases', () => {
    const glasgowChineseNames = new Set(requirements
      .filter((fact) => fact.sourceId === 'glasgow-china')
      .map((fact) => fact.institutionNameZh)
      .filter((name): name is string => Boolean(name)));
    const glasgowRecords = institutions.filter((record) => glasgowChineseNames.has(record.nameZh));
    const allowedEnglishCollisions = new Set(['taizhou university', 'wuyi university']);
    const allowedReviewedAcronyms = new Set(['UIBE', 'SUSTech']);
    const recordsByEnglish = new Map<string, Set<string>>();
    const expectedChineseByEnglish = new Map([
      ['Hunan Institute of Technology', '湖南工学院'],
      ['Anshan Normal University', '鞍山师范学院'],
      ['Harbin University', '哈尔滨学院'],
      ['Hubei Engineering University', '湖北工程学院'],
      ['Chaohu University', '巢湖学院'],
    ]);

    for (const record of glasgowRecords) {
      for (const name of [record.nameEn, ...record.aliases]) {
        if (/^[A-Za-z]+$/u.test(name.trim())) expect(allowedReviewedAcronyms).toContain(name.trim());
        const normalized = normalizeInstitutionName(name);
        if (!normalized) continue;
        recordsByEnglish.set(normalized, new Set([...(recordsByEnglish.get(normalized) ?? []), record.nameZh]));
      }
    }

    for (const [english, chineseNames] of recordsByEnglish) {
      if (chineseNames.size > 1) expect(allowedEnglishCollisions).toContain(english);
    }
    for (const [english, expectedChinese] of expectedChineseByEnglish) {
      const matches = glasgowRecords.filter((record) => [record.nameEn, ...record.aliases]
        .some((name) => normalizeInstitutionName(name) === normalizeInstitutionName(english)));
      expect(matches.map((record) => record.nameZh)).toEqual([expectedChinese]);
      expect(glasgowRecords.find((record) => record.nameZh === expectedChinese)?.nameEn).toBe(english);
    }
    for (const chinese of ['鞍山师范学院', '哈尔滨学院', '湖北工程学院']) {
      expect(glasgowRecords.find((record) => record.nameZh === chinese)?.aliases).not.toContain('Hunan Institute of Technology');
    }
  });

  it('limits full-registry normalized search conflicts to the reviewed ambiguities', () => {
    const recordIdsByName = new Map<string, Set<string>>();
    for (const record of institutions) {
      for (const name of [record.nameZh, record.nameEn, ...record.aliases]) {
        const normalized = normalizeInstitutionName(name);
        recordIdsByName.set(normalized, new Set([...(recordIdsByName.get(normalized) ?? []), record.id]));
      }
    }
    const collisionKeys = [...recordIdsByName]
      .filter(([, recordIds]) => recordIds.size > 1)
      .map(([name]) => name)
      .sort();
    const registeredIds = new Set(institutions.map((record) => record.id));
    const referencedIds = new Set(requirements.map((fact) => fact.institutionId));

    expect(institutions).toHaveLength(2979);
    expect(requirements).toHaveLength(9155);
    expect(collisionKeys).toEqual(['chongqing institute of engineering', 'taizhou university', 'wuyi university']);
    expect(requirements.every((fact) => registeredIds.has(fact.institutionId))).toBe(true);
    expect(institutions.every((record) => referencedIds.has(record.id))).toBe(true);
    expect(registeredIds.has('the-second-military-medical-university-55f6f4f4')).toBe(false);

    const expectedExactSearchIds = new Map([
      ['中国人民解放军海军军医大学(第二军医大学)', 'cn-9f87dd4ea325c693'],
      ['第二军医大学', 'cn-9f87dd4ea325c693'],
      ['Second Military Medical University', 'cn-9f87dd4ea325c693'],
      ['The Second Military Medical University', 'cn-9f87dd4ea325c693'],
      ['Naval Medical University', 'cn-9f87dd4ea325c693'],
      ['UIBE', 'university-of-international-business-and-economics-2a13872d'],
      ['SUSTech', 'cn-fd334bd375069320'],
    ]);
    for (const [query, expectedId] of expectedExactSearchIds) {
      expect([...recordIdsByName.get(normalizeInstitutionName(query)) ?? []]).toEqual([expectedId]);
    }

    const navalFacts = requirements.filter((fact) => fact.institutionId === 'cn-9f87dd4ea325c693');
    expect([...new Set(navalFacts.map((fact) => fact.sourceId))].sort()).toEqual([
      'bristol-china',
      'cambridge-china',
      'edinburgh-china',
      'leeds-business-china',
      'leeds-computer-science-media-china',
      'leeds-other-schools-m-z-china',
      'sheffield-china',
      'southampton-china',
      'warwick-china',
    ]);
  });

  it('preserves every distinct historical source row whose identity was merged', () => {
    const preservedRows = [
      ['sheffield-china', 'cn-d65eedfa9c42cf79', 'Gannan University of Science and Technology', '赣南科技学院', 'China ranking list'],
      ['sheffield-china', 'cn-798a43f1d58b93f6', 'Qingdao Film Academy', '青岛电影学院', 'China ranking list'],
      ['sheffield-china', 'cn-e1081944b32c4a84', 'Qingdao University of Technology, Qindao College', '青岛理工大学琴岛学院', 'China ranking list'],
      ['sheffield-china', 'cn-c54a8bf9427f90d1', 'Sichuan University Jincheng College', '四川大学锦城学院', 'China ranking list'],
      ['southampton-china', 'cn-9e338bea93785dc4', 'Jiaxing University', '嘉兴大学', 'Tier B'],
      ['southampton-china', 'cn-3eed51e9f008d2ea', 'Fuyang Normal University', '阜阳师范大学', 'Tier C'],
      ['southampton-china', 'cn-13a3c963f474ff79', 'Guangdong Polytechnic Normal University', '广东技术师范大学', 'Tier C'],
      ['southampton-china', 'cn-420d922c78eeff4e', 'Ningxia Normal University', '宁夏师范大学', 'Tier C'],
      ['southampton-china', 'cn-8e869295f3c945de', 'Yili Normal University', '伊犁师范大学', 'Tier C'],
    ];

    for (const [sourceId, institutionId, institutionOfficial, institutionNameZh, tierOfficial] of preservedRows) {
      expect(requirements).toContainEqual(expect.objectContaining({
        sourceId,
        institutionId,
        institutionOfficial,
        institutionNameZh,
        tierOfficial,
      }));
    }
  });

  it('links Southampton directly to its official tier list with a grouped bilingual parser', () => {
    const source = sources.find((item) => item.id === 'southampton-china');

    expect(source?.url).toBe('https://www.southampton.ac.uk/international/entry-qualification-equivalencies/china/postgraduate-taught-tier-list');
    expect(source?.labelZh).toBe('中国院校 Tier 名单');
    expect(source?.cycle).toBe('2025/26');
    expect(source?.parser).toMatchObject({
      mode: 'html-grouped-items',
      itemSelector: '.copy ul > li',
      guard: { minimumRecords: 500 },
    });
    expect(source?.institutionRule.caveatZh).toBe('本站展示最近一次成功提取的院校与分档记录；院校名称或 Tier 可能更新，最终请以大学官网当前页面为准。');
  });

  it('keeps Edinburgh’s Priority List parser separate from its current China rule verification page', () => {
    const source = sources.find((item) => item.id === 'edinburgh-china');

    expect(source?.url).toBe('https://edwebcontent.ed.ac.uk/sites/default/files/atoms/files/priority_list_of_chinese_universities.pdf');
    expect(source?.parser.mode).toBe('pdf-text');
    expect(source?.institutionRule.verification).toMatchObject({
      url: 'https://www.ed.ac.uk/studying/international/postgraduate-entry/asia/china',
      requiredText: ['Priority List', 'minimum grades between 80-85%', 'Band A', 'recognised university'],
    });
  });

  it('distinguishes eligibility, grade-threshold, mixed, and requirements-only sources', () => {
    const ruleType = (sourceId: string) => sources.find((source) => source.id === sourceId)?.institutionRule.type;

    expect(ruleType('ucl-china')).toBe('grade-threshold');
    expect(ruleType('edinburgh-china')).toBe('mixed');
    expect(ruleType('southampton-china')).toBe('grade-threshold');
    expect(ruleType('manchester-law-china')).toBe('none');
  });

  it('records safe listed and unlisted meanings for every source with institution rules', () => {
    for (const source of sources.filter((item) => item.institutionRule.type !== 'none')) {
      expect(source.institutionRule.listedMeaningZh?.trim()).toBeTruthy();
      expect(source.institutionRule.unlistedMeaningZh?.trim()).toBeTruthy();
      expect(source.institutionRule.verification?.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(source.institutionRule.verification?.url).toMatch(/^https:\/\//u);
      expect(source.institutionRule.verification?.requiredText.length).toBeGreaterThan(1);
    }
  });

  it('canonicalizes cross-source English variants without losing exact official names', () => {
    const variants = [
      ['Beihang University (formerly Beijing University of Aeronautics & Astronautics)', 'Beihang University'],
      ['North China Electric Power University / Huabei Electric Power University', 'North China Electric Power University'],
      ['Beijing Jiaotong University (formerly Beifang (Northern) Jiaotong University)', 'Beijing Jiaotong University'],
      ['Beijing Normal University (see note regarding United International College) *', 'Beijing Normal University'],
      ['Shanghai Jiaotong University', 'Shanghai Jiao Tong University'],
      ['Huazhong Agricultural University / Central China Agricultural University', 'Huazhong Agricultural University'],
      ['Sun Yat-Sen University (might appear as Zhongshan University)', 'Sun Yat-Sen University'],
      ['Suzhou (Soochow) University**', 'Soochow University'],
      ["Xidian University (also known as Xi'an Electronic Science and Technology University)**", 'Xidian University'],
      ['Zhengzhou University**', 'Zhengzhou University'],
    ];

    expect(institutions.length).toBeGreaterThanOrEqual(118);
    for (const pair of variants) {
      const matches = pair.map((officialName) => institutions.find((institution) =>
        [institution.nameEn, ...institution.aliases].includes(officialName)));
      expect(matches[0]?.id).toBe(matches[1]?.id);
      expect([...new Set(requirements
        .filter((fact) => fact.institutionId === matches[0]?.id)
        .map((fact) => fact.sourceId))]).toEqual(expect.arrayContaining(['ucl-china', 'edinburgh-china']));
    }
  });

  it('preserves each source spelling after canonical institution matching', () => {
    const beihangId = institutions.find((institution) => institution.nameZh === '北京航空航天大学')?.id;
    const officialName = (sourceId: string) => requirements.find((fact) =>
      fact.sourceId === sourceId && fact.institutionId === beihangId)?.institutionOfficial;

    expect(officialName('ucl-china')).toBe('Beihang University (formerly Beijing University of Aeronautics & Astronautics)');
    expect(officialName('edinburgh-china')).toBe('Beihang University');
  });
});
