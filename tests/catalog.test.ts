import { describe, expect, it } from 'vitest';
import cohort from '../src/data/qs-2027-top-200-uk.json';
import universities from '../src/data/universities.json';
import sources from '../src/data/sources.json';
import institutions from '../src/data/institutions.json';
import requirements from '../src/data/generated/requirements.json';
import audit from '../src/data/china-rule-audit.json';
import { loadChinaRuleAudit } from '../src/lib/data';
import { normalizeInstitutionName } from '../src/lib/institution-search';

describe('QS cohort and official source registry', () => {
  it('freezes only the official QS 2027 UK top-200 cohort', () => {
    expect(cohort.edition).toBe(2027);
    expect(cohort.sourceUrl).toContain('topuniversities.com/world-university-rankings');
    expect(cohort.universities.length).toBeGreaterThan(20);
    expect(cohort.universities.every((item) => item.rank >= 1 && item.rank <= 200)).toBe(true);
    expect(new Set(cohort.universities.map((item) => item.id)).size).toBe(cohort.universities.length);
  });

  it('does not contain universities outside the frozen cohort', () => {
    const cohortIds = new Set(cohort.universities.map((item) => item.id));
    const rankedUniversities = universities.filter((item) => item.directoryCategory === 'qs-top-200');
    expect(rankedUniversities.every((item) => cohortIds.has(item.id))).toBe(true);
  });

  it('covers every frozen cohort university exactly once without pending records', () => {
    const cohortIds = [...cohort.universities.map((item) => item.id)].sort();
    const publicIds = universities
      .filter((item) => item.directoryCategory === 'qs-top-200')
      .map((item) => item.id)
      .sort();

    expect(publicIds).toEqual(cohortIds);
    expect(universities.every((item) => item.state !== 'pending')).toBe(true);
  });

  it('loads a reviewed 29-school China rule audit with the binding classifications', () => {
    expect(loadChinaRuleAudit()).toEqual(audit);
    expect(audit).toHaveLength(29);
    expect(audit.filter((row) => row.expectedState === 'official-list').map((row) => row.universityId).sort()).toEqual([
      'university-college-london',
      'university-of-bristol',
      'university-of-cambridge',
      'university-of-edinburgh',
      'university-of-glasgow',
      'university-of-nottingham',
      'university-of-sheffield',
      'university-of-southampton',
      'university-of-warwick',
    ].sort());
    expect(audit.find((row) => row.universityId === 'university-of-manchester')).toMatchObject({
      expectedState: 'china-requirements',
      directoryCategory: 'qs-top-200',
    });
    expect(audit.find((row) => row.universityId === 'university-of-exeter')).toMatchObject({
      expectedState: 'not-public',
      finding: expect.stringMatching(/2026.*removed.*ranking.*all.*Ministry of Education.*uniform/i),
    });
  });

  it.each([
    ['official-list', [
      'university-college-london',
      'university-of-bristol',
      'university-of-cambridge',
      'university-of-edinburgh',
      'university-of-glasgow',
      'university-of-nottingham',
      'university-of-sheffield',
      'university-of-southampton',
      'university-of-warwick',
    ]],
    ['china-requirements', [
      'imperial-college-london',
      'kings-college-london',
      'lancaster-university',
      'london-school-of-economics-and-political-science',
      'newcastle-university',
      'queen-mary-university-of-london',
      'queens-university-belfast',
      'university-of-birmingham',
      'university-of-leeds',
      'university-of-liverpool',
      'university-of-manchester',
      'university-of-oxford',
      'university-of-reading',
      'university-of-st-andrews',
      'university-of-york',
      'cardiff-university',
    ]],
    ['not-public', [
      'durham-university',
      'london-business-school',
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
    for (const source of sources) {
      expect(source.url).toMatch(/^https:\/\//u);
      expect(source.scopeZh.trim()).toBeTruthy();
      expect(source.institutionRule.summaryZh.trim()).toBeTruthy();
      expect(source.institutionRule.verification).toMatchObject({
        reviewedAt: '2026-08-02',
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

  it('gives every university an official-domain source', () => {
    const universityById = new Map(universities.map((university) => [university.id, university]));
    const sourceById = new Map(sources.map((source) => [source.id, source]));

    for (const university of universities) {
      expect(university.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of university.sourceIds) {
        const source = sourceById.get(sourceId);
        expect(source?.universityId).toBe(university.id);
        const sourceHost = new URL(source!.url).hostname;
        const officialHost = new URL(universityById.get(university.id)!.officialDomain).hostname;
        expect(sourceHost === officialHost || sourceHost.endsWith(`.${officialHost}`)).toBe(true);
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

  it('limits full-registry normalized search conflicts to the two reviewed ambiguities', () => {
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

    expect(institutions).toHaveLength(2914);
    expect(requirements).toHaveLength(5754);
    expect(collisionKeys).toEqual(['taizhou university', 'wuyi university']);
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
