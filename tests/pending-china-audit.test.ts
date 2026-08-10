import { describe, expect, it } from 'vitest';
import universities from '../src/data/universities.json';
import sources from '../src/data/sources.json';
import audit from '../src/data/china-rule-audit.json';
import institutions from '../src/data/institutions.json';
import requirements from '../src/data/generated/requirements.json';
import statuses from '../src/data/status.json';
import baseline from './fixtures/pending-china-audit-baseline.json';
import { expectUnacceptedLinkOnlyStatus } from './helpers/source-status';

const sha256 = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(JSON.stringify(value)),
)), (byte) => byte.toString(16).padStart(2, '0')).join('');

const featureStartBaseline = baseline as typeof baseline & {
  reviewedUniversities: typeof universities;
  institutionsCount: number;
  institutionsSha256: string;
};

const batch1Ids = [
  'loughborough-university',
  'university-of-aberdeen',
  'university-of-east-anglia',
  'university-of-strathclyde',
  'university-of-surrey',
  'university-of-sussex',
  'university-of-leicester',
  'swansea-university',
  'heriot-watt-university',
  'brunel-university-of-london',
  'birkbeck-university-of-london',
  'city-st-georges-university-of-london',
  'oxford-brookes-university',
] as const;

const reviewedIds = batch1Ids.filter((id) => ![
  'university-of-aberdeen',
  'university-of-east-anglia',
].includes(id));

const reviewedSourceManifest = [
  ['loughborough-university', 'loughborough-china-institution-lookup', 'https://www.lboro.ac.uk/study/postgraduate/entry-requirements-china/', 'official-list', 'university', 'grade-threshold', ['Find your institution', 'Search for a University (e.g. Anhui or 安徽)', 'Tier | First class (70%) | Mid 2:1 (65%) | 2:1 (60%)']],
  ['university-of-strathclyde', 'strathclyde-china-entry', 'https://www.strath.ac.uk/studywithus/internationalstudents/entryrequirements/', 'china-requirements', 'university', 'grade-threshold', ['GPA from a four-year undergraduate degree must be:', 'over an average of 70% for 211/985 universities', 'over an average of 75% for the rest of Chinese universities']],
  ['university-of-surrey', 'surrey-china-entry', 'https://www.surrey.ac.uk/china/entry-requirements', 'china-requirements', 'university', 'none', ['Students who have completed 4-year undergraduate study in any Chinese University', 'For the courses that require a UK 2:1, an overall grade of 75%', 'For the courses that require a UK 2:2, an overall grade of 70%']],
  ['university-of-sussex', 'sussex-china-entry', 'https://www.sussex.ac.uk/study/international-students/information-by-country/china', 'china-requirements', 'university', 'grade-threshold', ['A Bachelor’s degree with a minimum overall mark of at least 65%-70% depending on your university and chosen Masters course.', 'Sussex uses Project 211/985 to inform offer levels.']],
  ['university-of-leicester', 'leicester-china-entry', 'https://le.ac.uk/study/international-students/countries/asia/china', 'china-requirements', 'university', 'grade-threshold', ['Four-year Bachelors degree from a prestigious university in China (211/985 project universities or ranked in top 1014 Chinese universities)', 'Other Chinese universities: 70-75% depending on the course.']],
  ['swansea-university', 'swansea-china-pgt-entry', 'https://www.swansea.ac.uk/postgraduate/apply/entry-requirements/country-specific/', 'china-requirements', 'university', 'grade-threshold', ['Double World Class Universities', 'All other Universities', 'UK 2.1 or Master’s (Merit)', '75%', '80%']],
  ['heriot-watt-university', 'heriot-watt-china-pgt-entry', 'https://www.hw.ac.uk/china/apply-now/postgraduate-programmes', 'china-requirements', 'university', 'grade-threshold', ['软科中国大学排名前1-250的大学', '四年制本科学位平均成绩达到68', '软科中国大学排名251名以后的大学', '四年制本科学位平均成绩达到72']],
  ['brunel-university-of-london', 'brunel-china-entry', 'https://www.brunel.ac.uk/international/your-country-and-region/China', 'china-requirements', 'university', 'none', ['As a guideline and depending on the programme you apply for', 'from a recognised Chinese institution:', 'A UK 2:1 (Second Class Upper) ... 75% - 80%', 'A UK 2:2 (Second Class Lower) ... 70% - 75%']],
  ['birkbeck-university-of-london', 'birkbeck-china-entry', 'https://www.bbk.ac.uk/international/country-region-information/china', 'china-requirements', 'university', 'grade-threshold', ["a bachelor's degree (Xueshi) from a 211, 985 or top national university with an overall average grade of 70%", "a bachelor's degree from a national university with an overall average grade of 75%", "a bachelor's degree from a high-ranking private university with an overall average grade of 75%"]],
  ['city-st-georges-university-of-london', 'city-st-georges-international-commercial-law-china', 'https://www.citystgeorges.ac.uk/prospective-students/courses/postgraduate/international-commercial-law-llm/2026', 'china-requirements', 'programme', 'grade-threshold', ['### China', 'The equivalents provided are intended as a guide only and individual applications are assessed on a case-by-case basis.', 'Depending on the awarding institution Chinese 4 year Bachelor degrees are typically accepted with 75 to 80%', '70 to 75%']],
  ['oxford-brookes-university', 'oxford-brookes-china-entry', 'https://www.brookes.ac.uk/study/international-students/your-country/china/entry-requirements', 'china-requirements', 'university', 'none', ['Qualifications equivalent to a UK bachelor degree:', '学士学位 (Bachelor degree)', '2:1 | 75%', '2:2 | 70%']],
] as const;

describe('first pending China-rule audit batch', () => {
  const universityById = new Map(universities.map((university) => [university.id, university]));
  const auditById = new Map(audit.map((row) => [row.universityId, row]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  it('records the approved review lifecycle and catalog state for every batch university', () => {
    expect(new Set(batch1Ids).size).toBe(13);

    for (const id of batch1Ids) {
      const university = universityById.get(id);
      const auditRow = auditById.get(id);

      expect(university, id).toBeDefined();
      expect(auditRow, id).toBeDefined();
      expect(auditRow?.reviewStatus, id).not.toBe('unreviewed');
      expect(auditRow?.reviewDate, id).toBe('2026-08-09');
      expect(auditRow?.finding, id).not.toContain('have not yet been reviewed');
      expect(auditRow?.expectedState, id).toBe(university?.state);

      if (auditRow?.reviewStatus === 'reviewed') {
        expect(university?.state, id).not.toBe('pending');
        expect(university?.sourceIds.length, id).toBeGreaterThan(0);
      } else {
        expect(auditRow?.reviewStatus, id).toBe('blocked');
        expect(university?.state, id).toBe('pending');
        expect(university?.sourceIds, id).toEqual([]);
      }
    }
  });

  it('registers only reviewed same-university HTTPS sources with link-only zero-record guards', () => {
    for (const id of reviewedIds) {
      const university = universityById.get(id)!;
      expect(university.sourceIds.length, id).toBeGreaterThan(0);

      for (const sourceId of university.sourceIds) {
        const source = sourceById.get(sourceId);
        expect(source, sourceId).toBeDefined();
        expect(source?.universityId, sourceId).toBe(id);
        expect(source?.url, sourceId).toMatch(/^https:\/\//u);
        expect(source?.institutionRule.verification?.reviewedAt, sourceId).toBe('2026-08-09');
        expect(source?.institutionRule.verification?.requiredText.length, sourceId).toBeGreaterThanOrEqual(2);
        expect(source?.parser).toMatchObject({
          mode: 'link-only',
          guard: { minimumRecords: 0, maximumRecords: 0, maximumRemovalRatio: 0 },
        });
      }
    }
  });

  it('pins every reviewed batch source to its approved official evidence manifest', () => {
    expect(reviewedSourceManifest).toHaveLength(11);

    for (const [universityId, sourceId, url, kind, scope, ruleType, requiredText] of reviewedSourceManifest) {
      const university = universityById.get(universityId);
      const source = sourceById.get(sourceId);

      expect(university?.sourceIds).toEqual([sourceId]);
      expect(source).toMatchObject({
        id: sourceId,
        universityId,
        url,
        kind,
        scope,
        institutionRule: { type: ruleType },
        parser: { mode: 'link-only', guard: { minimumRecords: 0, maximumRecords: 0, maximumRemovalRatio: 0 } },
      });
      expect(source?.institutionRule.verification?.requiredText).toEqual(requiredText);
    }
  });

  it('uses the approved state distribution and scope', () => {
    expect(universityById.get('loughborough-university')?.state).toBe('official-list');
    expect(reviewedIds.filter((id) => universityById.get(id)?.state === 'china-requirements')).toHaveLength(10);
    for (const id of ['university-of-aberdeen', 'university-of-east-anglia']) {
      expect(universityById.get(id)?.state).toBe('pending');
      expect(auditById.get(id)?.reviewStatus).toBe('blocked');
    }
    expect(sourceById.get('city-st-georges-international-commercial-law-china')?.scope).toBe('programme');
  });

  it('keeps Loughborough as a confirmed lookup without storing an unverified roster', () => {
    const university = universityById.get('loughborough-university');
    const source = sourceById.get('loughborough-china-institution-lookup');

    expect(university?.noteZh).toMatch(/查询|检索/u);
    expect(source?.institutionRule.summaryZh).toMatch(/查询|检索/u);
    expect(source?.institutionRule.caveatZh).toMatch(/完整.*名录|完整.*院校/u);
    expect(requirements.some((fact) => fact.sourceId === source?.id)).toBe(false);
  });

  it('preserves the feature-start reviewed audit rows, source configurations, and requirement facts', async () => {
    const baselineAuditRows = audit
      .filter((row) => baseline.nonTargetAuditRows.some((baselineRow) => baselineRow.universityId === row.universityId))
      .map(({ reviewStatus: _reviewStatus, ...row }) => row);
    expect(baselineAuditRows).toEqual(baseline.nonTargetAuditRows);

    const preExistingSourceIds = new Set(baseline.sourceConfigs.map((source) => source.id));
    expect(sources.filter((source) => preExistingSourceIds.has(source.id))).toEqual(baseline.sourceConfigs);

    const baselineRequirements = requirements.filter((fact) => preExistingSourceIds.has(fact.sourceId));
    expect(baselineRequirements).toHaveLength(baseline.reviewedRequirementCount);
    expect(await sha256(baselineRequirements))
      .toBe(baseline.requirementsSha256);
  });

  it('preserves every feature-start reviewed university object', () => {
    expect(featureStartBaseline.reviewedUniversities).toHaveLength(36);
    const reviewedUniversityIds = new Set(featureStartBaseline.reviewedUniversities.map((university) => university.id));
    expect(universities.filter((university) => reviewedUniversityIds.has(university.id)))
      .toEqual(featureStartBaseline.reviewedUniversities);
  });

  it('preserves the feature-start institutions dataset digest', async () => {
    expect(featureStartBaseline.institutionsCount).toBe(institutions.length);
    expect(await sha256(institutions))
      .toBe(featureStartBaseline.institutionsSha256);
  });
});

const batch2Ids = [
  'university-of-kent', 'aston-university', 'university-of-essex', 'university-of-dundee',
  'soas-university-of-london', 'royal-holloway-university-of-london', 'university-of-bradford',
  'university-of-huddersfield', 'northumbria-university', 'university-of-stirling', 'bangor-university',
  'university-of-hull', 'coventry-university',
] as const;

const batch2SourceManifest = [
  ['university-of-kent', 'kent-china-requirements', 'https://www.kent.ac.uk/international/countries/china', 'university', ['For courses that require a UK 2.2', '65% or 70%/GPA of 2.6', 'depending on the institution where the degree was completed']],
  ['aston-university', 'aston-china-requirements', 'https://www.aston.ac.uk/international/aston-in-your-country/north-east-asia/china', 'university', ['The specific percentage requirement will vary', "2:1 China full-time Bachelor's degree", 'Project 211/985 universities']],
  ['university-of-essex', 'essex-china-requirements', 'https://www.essex.ac.uk/international/country-specific-information/china', 'university', ['75% overall average from Gaokao', '65-70% for Academic Ranking of World Universities (ARWU) band 1 universities', '70-75% for ARWU band 2 universities']],
  ['university-of-dundee', 'dundee-china-requirements', 'https://www.dundee.ac.uk/countries/china', 'university', ['choose China from the I am from list', 'choose your qualification from the I am studying list']],
  ['university-of-dundee', 'dundee-international-business-management-china-requirements', 'https://www.dundee.ac.uk/postgraduate/international-business-management/entry-requirements/all', 'programme', ['Tier 1 Double First University', 'Tier 2 Non Double First University']],
  ['soas-university-of-london', 'soas-china-requirements', 'https://www.soas.ac.uk/international/information-region/information-prospective-students-china', 'university', ['C9 or a Double First Class university', '73% to 75%', 'Graduates from non C9 or Double First Class institutions']],
  ['royal-holloway-university-of-london', 'royal-holloway-china-requirements', 'https://www.royalholloway.ac.uk/studying-here/international-students/find-your-country/china/', 'university', ['recognised university in China', 'Exact requirements will depend upon the programme', 'minimum of 65% to 75%']],
  ['university-of-bradford', 'bradford-china-requirements', 'https://www.bradford.ac.uk/international/country/china/', 'university', ['The information provided below is intended as guidance only', 'Bachelor Degree 学士学位', '85% | 80% | 65%']],
  ['university-of-huddersfield', 'huddersfield-china-requirements', 'https://london.hud.ac.uk/how-to-apply/entry-requirements', 'university', ['Country/region-specific entry requirements', 'China | Bachelor Degree | 65%', 'Huikao ... | 80%']],
  ['northumbria-university', 'northumbria-china-requirements', 'https://www.northumbria.ac.uk/-/media/corporate-website/documents/agent-zone/publication-359527china-approved.ashx', 'university', ['Entry and Scholarship Requirements', 'Postgraduate programmes (for courses requiring a 2:2 equivalent)', '70% and above', '75% and above']],
  ['university-of-stirling', 'stirling-china-requirements', 'https://www.stir.ac.uk/international/international-students/international-entry-requirements/', 'university', ['## China', "65% in a 4-year Bachelor’s degree from a 211 or 985 university", '70% in a 4-year Bachelor’s degree from other universities']],
  ['bangor-university', 'bangor-china-requirements', 'https://www.bangor.ac.uk/international/countries/china', 'university', ['Postgraduate/Master Degree', 'minimum of 65%', '(211 university)', 'minimum of 70%']],
  ['university-of-hull', 'hull-china-requirements', 'https://www.hull.ac.uk/study/international-students/your-country/china', 'university', ['The following is a guide to the entry requirements for each type of degree', 'Entry requirements may vary by course', 'check your course page for the most up to date information']],
  ['coventry-university', 'coventry-china-requirements', 'https://www.coventry.ac.uk/international-students-hub/entry-requirements/?country=China&region=ea', 'university', ['## China', 'Students who have completed 4-year undergraduate study should achieve an overall grade of 70%', 'Grading system, transcript and a copy of your degree certificate']],
] as const;

describe('second pending China-rule audit batch', () => {
  const universityById = new Map(universities.map((university) => [university.id, university]));
  const auditById = new Map(audit.map((row) => [row.universityId, row]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  it('marks exactly the approved thirteen universities reviewed with matching catalog states', () => {
    expect(batch2Ids).toHaveLength(13);
    expect(batch2SourceManifest).toHaveLength(14);

    for (const id of batch2Ids) {
      const university = universityById.get(id);
      const auditRow = auditById.get(id);

      expect(university?.state, id).toBe('china-requirements');
      expect(university?.sourceIds.length, id).toBeGreaterThan(0);
      expect(auditRow, id).toMatchObject({
        expectedState: university?.state,
        reviewStatus: 'reviewed',
        reviewDate: '2026-08-09',
      });
      expect(auditRow?.finding, id).not.toContain('have not yet been reviewed');
    }
  });

  it('registers the approved official evidence as link-only China requirements without institution rules', () => {
    for (const [universityId, sourceId, url, scope, requiredText] of batch2SourceManifest) {
      const university = universityById.get(universityId);
      const source = sourceById.get(sourceId);

      expect(university?.sourceIds).toContain(sourceId);
      expect(source).toMatchObject({
        id: sourceId,
        universityId,
        url,
        kind: 'china-requirements',
        scope,
        institutionRule: {
          type: 'none',
          verification: { reviewedAt: '2026-08-09', requiredText },
        },
        parser: { mode: 'link-only', guard: { minimumRecords: 0, maximumRecords: 0, maximumRemovalRatio: 0 } },
      });
      expect(source?.url).toMatch(/^https:\/\//u);
      expect(source?.institutionRule.verification?.requiredText.length).toBeGreaterThanOrEqual(2);
    }

    expect(universityById.get('university-of-dundee')?.sourceIds).toEqual([
      'dundee-china-requirements',
      'dundee-international-business-management-china-requirements',
    ]);
  });

  it('keeps every source lifecycle-compatible without an accepted hash', () => {
    for (const [, sourceId] of batch2SourceManifest) {
      expectUnacceptedLinkOnlyStatus(statuses[sourceId], sourceId);
    }
  });

  it('does not turn broad China categories into institution or requirement records', async () => {
    const batch2SourceIds = new Set(batch2SourceManifest.map(([, sourceId]) => sourceId));
    expect(requirements.some((fact) => batch2SourceIds.has(fact.sourceId))).toBe(false);
    expect(institutions).toHaveLength(featureStartBaseline.institutionsCount);
    expect(await sha256(institutions))
      .toBe(featureStartBaseline.institutionsSha256);
  });

  it('retains the source-specific access and scope caveats', () => {
    expect(universityById.get('university-of-dundee')?.noteZh).toMatch(/课程|项目/u);
    expect(universityById.get('university-of-huddersfield')?.noteZh).toMatch(/伦敦/u);
    expect(universityById.get('northumbria-university')?.noteZh).toMatch(/PDF/u);
    expect(universityById.get('university-of-hull')?.noteZh).toMatch(/课程|百分/u);
    expect(sourceById.get('coventry-china-requirements')?.url).toContain('country=China&region=ea');
  });
});

const batch3Ids = [
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
] as const;

const batch3SourceManifest = [
  ['ulster-university', 'ulster-china-requirements', 'https://www.ulster.ac.uk/global/apply/country/china', 'university', ['Successful completion of National College Entrance Examination (NCEE) (Gaokao) with 70% or above', "4 Year Bachelor's Degree", '2:1 - 75%'], '学校中国国别页的本科和授课型研究生入学要求', '页面提供高考和四年制学士学位成绩要求，未公开可确定成员的中国院校名录。', '课程要求可能不同，在线课程目录仍为准。'],
  ['manchester-metropolitan-university', 'manchester-metropolitan-china-requirements', 'https://www.mmu.ac.uk/study/international/international-students/china', 'university', ['This information is provided as a guidance only.', 'Some courses may have specific entry requirements that are listed on the relevant course page.', 'We look at each application individually.'], '学校中国国别页的各学习阶段入学指导', '页面按学习阶段提供中国入学指导并说明逐案审查，未公开中国院校成员名录。', '页面明确说明信息仅作指导，具体课程可能另有要求。'],
  ['nottingham-trent-university', 'nottingham-trent-china-requirements', 'https://www.ntu.ac.uk/international/countries/asia/china', 'university', ['Completion of the National College Entrance Examination (Gaokao) with 70% of the maximum score achieved', 'Completion of first year of Chinese university degree', 'Bachelors degree (four years or five + years in medicine / dentistry) from a recognised higher education institution in China.Grades of 70% or above'], '学校中国国别页的本科、硕士和研究型研究生要求', '页面按中国学历和成绩对应学习阶段，未公开具名中国院校名录。', '认可院校措辞未给出成员名单，未列资格应向校方咨询。'],
  ['university-of-portsmouth', 'portsmouth-china-requirements', 'https://www.port.ac.uk/study/international-students/your-country/china', 'university', ['the entry requirements you need to meet will depend on the course you want to study', 'one year at a recognised university in China', 'Typical minimum Grade Point Average (GPA) requirements'], '学校中国国别页的预科、本科、研究生和博士要求', '页面提供中国学历、GPA 和课程相关入学指导，未公开中国院校名录。', 'recognised 未在页面定义为成员名单，课程可设额外条件。'],
  ['kingston-university-london', 'kingston-china-requirements', 'https://www.kingston.ac.uk/study/international-students/country-specific-information', 'university', ['Bachelor degree (4 years) from any institution on ECCTIS', "Bachelor degree (4 years) from a 'prestigious' institution on ECCTIS", 'UK 2:1 equivalent: 70%'], '学校国别选择器中中国部分的本科和研究生要求', '页面引用 ECCTIS 类别的成绩要求，但未公开可确定的中国院校成员名录。', 'ECCTIS 是外部分类；交换伙伴不是本校招生院校名单。'],
  ['university-of-plymouth', 'plymouth-china-requirements', 'https://www.plymouth.ac.uk/international/study/international-students-country-guides/china', 'university', ['We generally require an overall 70% grade or above but this will vary depending on the institution.', 'a masters degree from a ranked Chinese university', 'Chinese degree classification - prestigious institution'], '学校中国国别指南的本科和研究生入学要求', '页面提供学历、专升本和研究生成绩指导，未定义 ranked 或 prestigious 的院校成员。', 'ranked 和 prestigious 类别没有公开名录，院校相关要求需向招生部门确认。'],
  ['goldsmiths-university-of-london', 'goldsmiths-china-requirements', 'https://www.gold.ac.uk/international/regions/china/', 'university', ['If you have achieved an average of 75% in your Chinese high school diploma', 'Refer to individual course pages to see whether there are any additional application requirements.', 'Normally, you will need to have been attending university for at least 1 year.'], '学校中国指南的预科、本科、研究生和研究型课程要求', '页面提供中国高中和一般学位入学指导，未公开中国院校名录。', '合作伙伴或路径项目仅限课程，不能推断为学校招生院校名单。'],
  ['university-of-the-west-of-england', 'uwe-china-requirements', 'https://www.uwe.ac.uk/courses/international-study/country-or-region/china', 'university', ['completed one year of a degree programme at a Chinese university with 70%', "bachelor's degree awarded by a Chinese university after four years of study with 70%", 'where UWE Bristol has an academic agreement in place with an institution, greater flexibility'], '学校中国国别页的预科、本科和硕士要求', '页面提供中国学历和成绩门槛，未公开中国院校或协议成员名录。', '学术协议不公开成员名单，不能作为招生分类规则。'],
  ['university-of-greenwich', 'greenwich-china-requirements', 'https://www.gre.ac.uk/international/countries/china', 'university', ['Senior Secondary School Graduation Certificate with a minmum average grade 70%', 'National College Entrance Examination (NCEE/Gokao) with a minimum average grade 65%', 'Bachelor Degree with a minimum average grade of 70% (GPA 2.6 out of 4.0)'], '学校中国国别页的本科、进阶入学和硕士要求', '页面提供中学、高考、学士学位和 GPA 门槛，未公开中国院校名录。', '课程条件可能不同，相关学科资格由招生部门申请后判断。'],
  ['aberystwyth-university', 'aberystwyth-china-requirements', 'https://www.aber.ac.uk/en/study-with-us/international/countries/china/', 'university', ['Passed the Chinese University Entrance Exam (GaoKao) with a minimum grade of 70%', 'Prestigious Universities: final average 66.0%', 'National Universities: final average 75.0%'], '学校中国国别页的预科、本科和研究生要求', '页面对 Prestigious 和 National Universities 给出不同均分要求，但未公开成员。', '类别成员未定义，不能用第三方名单解析或推断。'],
  ['bournemouth-university', 'bournemouth-china-requirements', 'https://www.bournemouth.ac.uk/study/international/bu-your-country/china/entry-requirements-chinese-students', 'university', ['Applicants from 985 or 211 universities', 'Media studies and other subjects equivalent to UK 2:1 degree | 65% +', 'Applicants from other universities'], '学校中国学生入学要求页的预科、本科、专升本、研究生和研究型课程要求', '页面对 985/211 与其他院校给出不同成绩要求，但未公开本校维护的成员名录。', '985/211 成员名单不由本页发布，科目和课程等效要求仍会影响门槛。'],
  ['edinburgh-napier-university', 'edinburgh-napier-china-requirements', 'https://www.napier.ac.uk/study-with-us/international-students/your-country/east-asia/china', 'university', ['Senior Secondary School Certificate with 75% or above', '500 points or above in CUEE is acceptable if you have sat the Gaokao exam', 'a bachelors degree from a recognised institution with 70% or above'], '学校中国国别页的本科、研究生、英语和衔接课程要求', '页面给出中学、高考和认可院校学士学位门槛，未公开中国院校名录。', '衔接课程与直录要求不同，具体课程可能需要更高英语成绩。'],
  ['keele-university', 'keele-china-requirements', 'https://www.keele.ac.uk/study/internationalstudents/yourcountry/asia/china', 'university', ['The actual grades you require in particular subjects will vary according to the degree course you wish to study.', 'Senior Secondary School Graduation Certificate, plus Gaokao.', 'ABB-BBC courses = Senior Secondary School Graduation Certificate with 80% overall plus Gaokao with 75%'], '学校中国国别页的预科、本科、英语和医学要求', '页面将高中和高考成绩对应本科课程档位，未公开中国院校名录。', '内容侧重本科课程档位和学科成绩，并非研究生院校规则。'],
] as const;

describe('third pending China-rule audit batch', () => {
  const universityById = new Map(universities.map((university) => [university.id, university]));
  const auditById = new Map(audit.map((row) => [row.universityId, row]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  it('marks exactly the approved thirteen universities reviewed with matching catalog states and findings', () => {
    expect(batch3Ids).toHaveLength(13);
    expect(new Set(batch3Ids).size).toBe(13);

    for (const id of batch3Ids) {
      const university = universityById.get(id);
      const auditRow = auditById.get(id);

      expect(university?.state, id).toBe('china-requirements');
      expect(university?.sourceIds, id).toHaveLength(1);
      expect(auditRow, id).toMatchObject({
        expectedState: university?.state,
        reviewStatus: 'reviewed',
        reviewDate: '2026-08-09',
      });
      expect(auditRow?.finding, id).not.toContain('have not yet been reviewed');
      expect(auditRow?.finding, id).not.toContain('尚待核查');
    }
  });

  it('pins every source to directly verified official China requirements evidence without a roster inference', () => {
    expect(batch3SourceManifest).toHaveLength(13);

    for (const [universityId, sourceId, url, scope, requiredText, scopeZh, summaryZh, caveatZh] of batch3SourceManifest) {
      const university = universityById.get(universityId);
      const source = sourceById.get(sourceId);

      expect([scopeZh, summaryZh, caveatZh], sourceId).not.toContain(undefined);
      expect(university?.sourceIds).toEqual([sourceId]);
      expect(source).toMatchObject({
        id: sourceId,
        universityId,
        url,
        kind: 'china-requirements',
        scope,
        scopeZh,
        institutionRule: {
          type: 'none',
          summaryZh,
          caveatZh,
          verification: { reviewedAt: '2026-08-09', url, requiredText },
        },
        parser: { mode: 'link-only', guard: { minimumRecords: 0, maximumRecords: 0, maximumRemovalRatio: 0 } },
      });
      expect(source?.url).toMatch(/^https:\/\//u);
      expect(source?.institutionRule.verification?.requiredText).toEqual(requiredText);
      expect(source?.institutionRule.caveatZh).toMatch(/名录|名单|成员|分类|课程|院校/u);
    }
  });

  it('keeps every source lifecycle-compatible without an accepted hash', () => {
    for (const [, sourceId] of batch3SourceManifest) {
      expectUnacceptedLinkOnlyStatus(statuses[sourceId], sourceId);
    }
  });

  it('does not turn broad China guidance into institution or generated requirement records', async () => {
    const batch3SourceIds = new Set(batch3SourceManifest.map(([, sourceId]) => sourceId));
    expect(requirements.some((fact) => batch3SourceIds.has(fact.sourceId))).toBe(false);
    expect(institutions).toHaveLength(featureStartBaseline.institutionsCount);
    expect(await sha256(institutions))
      .toBe(featureStartBaseline.institutionsSha256);
  });

  it('retains the source-specific caveats that prohibit external or unrelated list inference', () => {
    expect(sourceById.get('kingston-china-requirements')?.institutionRule.caveatZh).toMatch(/ECCTIS|外部/u);
    expect(sourceById.get('goldsmiths-china-requirements')?.institutionRule.caveatZh).toMatch(/合作|伙伴|课程/u);
    expect(sourceById.get('uwe-china-requirements')?.institutionRule.caveatZh).toMatch(/协议|成员/u);
    expect(sourceById.get('aberystwyth-china-requirements')?.institutionRule.caveatZh).toMatch(/未定义|名录/u);
    expect(sourceById.get('keele-china-requirements')?.institutionRule.caveatZh).toMatch(/本科|课程/u);
  });
});

const batch4Ids = [
  'de-montfort-university',
  'liverpool-john-moores-university',
  'university-of-hertfordshire',
  'university-of-lincoln',
  'university-of-the-arts-london',
  'university-of-westminster',
  'london-south-bank-university',
  'middlesex-university',
  'university-of-brighton',
  'anglia-ruskin-university',
  'birmingham-city-university',
  'glasgow-caledonian-university',
  'leeds-beckett-university',
] as const;

const batch4SourceManifest = [
  ['de-montfort-university', 'dmu-china-requirements', 'https://www.dmu.ac.uk/international/en/entry-requirements.aspx', 'university', ['## China', "If you have a 4 year Chinese bachelor's degree:", '65% and all Pass (60%) overall for PG programs requiring 2.2', '70% and all Pass overall for PG programs required 2.1'], '学校国际入学要求页的中国部分，涵盖本科和授课型研究生指引', '页面按英国 2:2/2:1 对应给出中国学历和分数要求，未公开中国院校名录或院校分组成员。', '课程页面仍可能增加作品集、工作经历或专业背景要求。'],
  ['liverpool-john-moores-university', 'ljmu-china-requirements', 'https://www.ljmu.ac.uk/study/courses/international-entry-requirements/china', 'university', ['The following requirements are a guide only', '4 Year Bachelor Degree (学士学位) with 70%', 'from a recognised Institution (NARIC)'], '学校中国国别入学要求页', '页面给出中国本科和研究生学历与分数门槛，包括“认可院校”的四年制学位；未公开对应的中国认可院校名录。', '“recognised Institution (NARIC)”不是 LJMU 维护的可查询院校名录，课程和个人经历可影响要求。'],
  ['university-of-hertfordshire', 'hertfordshire-china-requirements', 'https://www.herts.ac.uk/international/guidance-for-your-region/south-east-and-east-asia/china', 'university', ['Chinese 4-year Bachelor degree with 70% or above', 'Some courses may vary and/or have specific requirements', 'all applications are assessed on an individual basis'], '学校中国地区页的入学要求表，覆盖预科至授课型研究生', '页面列出中国学历和分数门槛并说明逐案评估，未公开中国院校名录。', '具体课程可能另有要求，院校是否录取不能从任何缺失名录项推断。'],
  ['university-of-lincoln', 'lincoln-china-requirements', 'https://www.lincoln.ac.uk/studywithus/internationalstudents/entryrequirementsandyourcountry/china/', 'university', ['Applicants must have completed a Bachelor’s degree', 'at a recognised institution', 'Upper Second Class Hons (2:1)', '4 year Bachelor degree with 80%'], '学校中国国别入学要求页，涵盖本科和研究生', '页面将中国四年制学士学位成绩对应英国 2:1/2:2，并要求毕业于认可院校；未公开中国院校名录。', '“recognised institution”未附本校维护的成员名录，具体课程决定所需学位等级。'],
  ['university-of-westminster', 'westminster-china-requirements', 'https://www.westminster.ac.uk/international/your-country/china', 'university', ['Bachelor degree from 211, 985 or top national universities', 'Bachelor degree from non-211/985 universities', 'overall average grade of 65%', 'overall average grade of 70%'], '学校中国国别页的本科和研究生入学指引', '页面按 211/985/全国重点院校与非 211/985 院校给出不同硕士分数线，但未公开任一分组的院校成员名录。', '211/985 等外部类别不能形成威斯敏斯特大学维护的院校名录；页面说明为典型指引，课程条件仍可能不同。'],
  ['london-south-bank-university', 'lsbu-china-requirements', 'https://www.lsbu.ac.uk/international/your-country/asia-and-oceania/china', 'university', ['each application will be assessed on individual merit', 'Postgraduate course requirements', 'four-year Bachelor Degree from a Chinese university with good grades'], '学校当前中国国别页，涵盖预科至授课型研究生指引', '页面给出中国学历要求，授课型研究生可使用成绩良好的中国四年制学士学位；未公开中国院校名录。', '逐案评估且课程可能另有条件；旧版合作或衔接院校名单不是招生院校名录。'],
  ['middlesex-university', 'middlesex-china-requirements', 'https://www.mdx.ac.uk/international/support-in-your-countries-and-regions/china/', 'university', ['Undergraduate - Year 1', 'College Entrance Examination with 60%', 'China High School Graduation Certificate with a minimum average of 75', 'To find out more about our entry requirements for China, please read our guide'], '学校中国国别页，当前可见内容为本科入学指引及后续中国要求链接', '页面公布中国本科资格和分数门槛并链接进一步指南，当前可访问内容未公开中国院校名录或按院校区分的录取规则。', '后续指南须在提取额外数值前另行复核；地区、奖学金或合作材料中的名称不是招生名录证据。'],
  ['university-of-brighton', 'brighton-china-requirements', 'https://www.brighton.ac.uk/international/study-with-us/your-country-or-territory-info/china.aspx', 'university', ['Academic equivalencies', 'four-year benke 学士学位 bachelor degree OR a master degree', 'overall grade of 60–70%', 'subject to admissions assessment'], '学校中国国别页的本科和研究生学历等效要求', '页面要求中国四年制学士或硕士学位用于研究生申请，并规定 60–70% 总分且须经招生评估；未公开院校名录。', '更高的课程特定要求仍可能适用，页面未以院校成员规则作出录取结论。'],
  ['anglia-ruskin-university', 'aru-china-requirements', 'https://www.aru.ac.uk/international/north-east-asia', 'university', ['For entry to a Masters degree', '4-year Bachelor degree awarded by a recognised Chinese university', '(Prestigious/Regular/Private)', '70% result performance or above'], '学校东北亚地区页的中国本科、硕士和研究型课程入学要求', '页面接受来自“Prestigious/Regular/Private”认可中国院校的四年制学士学位（70%及以上）用于硕士申请，但未公开这些标签的成员名录。', '页面仅作指引，课程可增加学科、分数、作品集或面试要求；标签不能映射为院校名录。'],
  ['birmingham-city-university', 'bcu-china-requirements', 'https://www.bcu.ac.uk/international/bcu-in-your-country/china', 'university', ['Entry requirements for Chinese students', 'Postgraduate', 'Accept minimum 65% final average in degree', 'Some of our courses may have an additional selection process'], '学校中国国别页的本科和研究生入学要求', '页面规定中国研究生申请者的学位最终平均分最低为 65%，已发布要求没有院校名录或院校分组。', '作品集、试演、面试和课程页面要求可另行适用；BCUIC 等合作路径不是院校名录证据。'],
  ['glasgow-caledonian-university', 'gcu-china-requirements', 'https://www.gcu.ac.uk/internationalstudy/your-region/country-pages/china', 'university', ["four-year bachelor's degree at grade 65% from a tier one university", '70% from a tier two or tier three university', 'Tier One (985/211) universities', 'Tier two and tier three universities'], '学校中国国别页的本科和授课型研究生入学指引', '页面在研究生分数表中区分 Tier One（985/211）与 Tier Two/Three 中国院校，但未公开各层级的院校成员名录。', '985/211 属外部类别而非 GCU 维护的确定性名录，申请人仍须查阅具体学位课程。'],
  ['leeds-beckett-university', 'leeds-beckett-china-requirements', 'https://www.leedsbeckett.ac.uk/international-students/countries/china/china-entry-requirements/', 'university', ['China Entry Requirements', 'Postgraduate courses', "Qualification: Bachelor's degree", '60% for 2:2 or 65% for 2:1'], '学校中国入学要求页', '页面规定中国本科毕业生申请研究生时，英国 2:2 对应 60%、2:1 对应 65%；未公开院校名录或按院校划分的规则。', '学校将本页描述为一般指引，课程要求会变化，其他资格也可能获考虑。'],
] as const;

const ualBeforeBatch4 = {
  directoryCategory: 'qs-directory',
  aliases: ['UAL', 'University of Arts London'],
  officialDomain: 'https://www.arts.ac.uk',
  strengthEvidence: {
    kind: 'subject-ranking',
    provider: 'qs',
    rankingName: 'QS World University Rankings by Subject',
    subjectZh: '艺术与设计',
    edition: 2026,
    placement: 'exact',
    displayRank: '2',
    sourceUrl: 'https://www.arts.ac.uk/about-ual/press-office/stories/qs-world-rankings-2026',
    noteZh: '艺术与设计强势院校，仍参与 QS/THE 综合大学排序',
  },
} as const;

describe('fourth pending China-rule audit batch', () => {
  const universityById = new Map(universities.map((university) => [university.id, university]));
  const auditById = new Map(audit.map((row) => [row.universityId, row]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  it('reviews the exact thirteen-university cohort, leaving only UAL blocked and source-free', () => {
    expect(batch4Ids).toHaveLength(13);
    expect(new Set(batch4Ids).size).toBe(13);
    const reviewedIds = batch4Ids.filter((id) => id !== 'university-of-the-arts-london');

    for (const id of reviewedIds) {
      const university = universityById.get(id);
      expect(university?.state, id).toBe('china-requirements');
      expect(university?.sourceIds, id).toHaveLength(1);
      expect(auditById.get(id), id).toMatchObject({
        expectedState: 'china-requirements', reviewStatus: 'reviewed', reviewDate: '2026-08-09',
      });
    }

    const ual = universityById.get('university-of-the-arts-london');
    expect(ual).toMatchObject({ state: 'pending', sourceIds: [] });
    expect(auditById.get('university-of-the-arts-london')).toEqual({
      universityId: 'university-of-the-arts-london',
      directoryCategory: 'qs-directory',
      expectedState: 'pending',
      reviewDate: '2026-08-09',
      reviewStatus: 'blocked',
      finding: 'Current first-party international application guidance directs applicants to course-specific entry requirements but publishes no China-specific academic requirement or Chinese-institution rule; this is insufficient to classify a public or non-public list.',
    });
  });

  it('pins every reviewed source to its direct first-party China requirements evidence and zero-record guard', () => {
    expect(batch4SourceManifest).toHaveLength(12);

    for (const [universityId, sourceId, url, scope, requiredText, scopeZh, summaryZh, caveatZh] of batch4SourceManifest) {
      const university = universityById.get(universityId);
      const source = sourceById.get(sourceId);
      expect(university?.sourceIds).toEqual([sourceId]);
      expect(source).toMatchObject({
        id: sourceId,
        universityId,
        url,
        kind: 'china-requirements',
        scope,
        scopeZh,
        institutionRule: {
          type: 'none', summaryZh, caveatZh,
          verification: { reviewedAt: '2026-08-09', url, requiredText },
        },
        parser: { mode: 'link-only', guard: { minimumRecords: 0, maximumRecords: 0, maximumRemovalRatio: 0 } },
      });
      expect(source?.url).toMatch(/^https:\/\//u);
      expect(source?.institutionRule.verification?.requiredText).toEqual(requiredText);
      expect([scopeZh, summaryZh, caveatZh].every((value) => value.trim().length > 0), sourceId).toBe(true);
    }
  });

  it('keeps every source lifecycle-compatible without an accepted hash', () => {
    for (const [, sourceId] of batch4SourceManifest) {
      expectUnacceptedLinkOnlyStatus(statuses[sourceId], sourceId);
    }
    expect(statuses).not.toHaveProperty('ual-china-requirements');
  });

  it('does not manufacture institutions or generated requirements from China guidance', async () => {
    const batch4SourceIds = new Set(batch4SourceManifest.map(([, sourceId]) => sourceId));
    expect(requirements.some((fact) => batch4SourceIds.has(fact.sourceId))).toBe(false);
    expect(institutions).toHaveLength(featureStartBaseline.institutionsCount);
    expect(await sha256(institutions))
      .toBe(featureStartBaseline.institutionsSha256);
  });

  it('keeps UAL subject-strength evidence separate from its blocked China-rule review', () => {
    const ual = universityById.get('university-of-the-arts-london');
    expect({
      directoryCategory: ual?.directoryCategory,
      aliases: ual?.aliases,
      officialDomain: ual?.officialDomain,
      strengthEvidence: ual?.strengthEvidence,
    }).toEqual(ualBeforeBatch4);
    expect(ual?.noteZh).toContain('课程');
    expect(ual?.noteZh).toContain('中国');
  });
});

const batch5Ids = [
  'london-metropolitan-university',
  'robert-gordon-university',
  'sheffield-hallam-university',
  'university-of-lancashire',
  'university-of-roehampton',
  'university-of-salford',
  'university-of-wolverhampton',
  'queen-margaret-university-edinburgh',
  'university-of-northampton',
  'university-of-derby',
  'university-of-south-wales',
  'university-of-east-london',
  'canterbury-christ-church-university',
] as const;

const allPendingAuditBatchIds = [...batch1Ids, ...batch2Ids, ...batch3Ids, ...batch4Ids, ...batch5Ids];

const batch5Sources = [
  ['robert-gordon-university', 'rgu-china-requirements', 'https://www.rgu.ac.uk/study/international-students/your-country-or-territory/china', 'university', ['A four-year Bachelor’s Degree from a recognised "211" or "985" university', '70% is required from all other recognised universities in China', 'Applications are considered on an individual basis'], '学校中国国别页的本科和研究生入学指引', '页面按认可的 211/985 院校与其他认可中国院校给出不同研究生分数要求，但未公开任何类别的成员名录。', '页面的合作院校内容不是录取院校名录，课程可能另有要求。'],
  ['sheffield-hallam-university', 'shu-china-entry-requirements', 'https://www.shu.ac.uk/study-here/international/entry-requirements/entry-requirements-for-china', 'university', ['This page outlines the qualifications we accept from China', 'Four year Bachelor Degree from a recognised university', 'usual minimum average of 60 per cent', 'Masters degree from a recognised University'], '学校中国入学要求页，涵盖本科至研究型研究生', '页面列出中国学历与一般分数要求，授课型研究生可使用认可大学的四年制学位；未公开中国院校名录。', '具体课程可能有不同要求，认可大学表述不构成本校可查询成员名录。'],
  ['university-of-lancashire', 'lancashire-china-requirements', 'https://www.lancashire.ac.uk/international-students/country/china', 'university', ['Entry Requirements', 'Our entry requirements can change depending on the course and the year you apply', 'The information below is just a guide', 'If your academic or English language qualifications are not enough to start a degree with us'], '学校中国国别页的入学要求和预科路径指引', '页面公布中国学历和分数门槛，并说明要求会随课程和申请年份变化；未公开中国院校名录或院校分组规则。', '合作院校、代理和奖学金材料不是录取院校名录，页面分数仅为一般指引。'],
  ['university-of-derby', 'derby-mainland-china-international-entry', 'https://www.derby.ac.uk/undergraduate/apply/entry-requirements/international/', 'university', ['Mainland China', 'First year entry - 高考 - National College Entrance Examination (Gaokao)', 'Requirement: 50%', 'Bachelor degree certificate (学士学位) and Graduation Certificate （毕业证）', 'Requirement: 70% and above'], '学校国际学历表中的中国大陆条目，涵盖预科、本科和研究生', '中国大陆条目列出高考、职业文凭及学士/毕业证书的分数要求，没有院校分组或院校名录。', '学历要求可因课程或路径而异，不能将资格分数转换为院校记录。'],
  ['canterbury-christ-church-university', 'cccu-china-requirements', 'https://www.canterbury.ac.uk/study-here/international/find-your-country/china', 'university', ['Entry requirements', 'National High School Graduation Certificate with a minimum average grade of 70%', 'A minimum final grade of 70% or equivalent from one of the 211 universities', 'A minimum final grade of 65% or equivalent from one of the 211 universities'], '学校中国国别页的预科、本科和研究生入学要求', '页面公布中国学历与分数要求，并为 211 大学列出较低研究生门槛；未公开 211 院校成员名录。', '211 是外部类别而非 CCCU 维护的可查询院校名录，课程和英语条件可能另有要求。'],
] as const;

describe('final pending China-rule audit batch', () => {
  const universityById = new Map(universities.map((university) => [university.id, university]));
  const auditById = new Map(audit.map((row) => [row.universityId, row]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  it('reviews the exact final thirteen-school cohort from current first-party evidence', () => {
    expect(batch5Ids).toHaveLength(13);
    expect(new Set(batch5Ids).size).toBe(13);
    const blockedIds = [
      'london-metropolitan-university', 'university-of-east-london', 'university-of-roehampton',
      'university-of-salford', 'university-of-wolverhampton', 'queen-margaret-university-edinburgh',
      'university-of-northampton', 'university-of-south-wales',
    ];
    for (const id of batch5Ids) {
      const university = universityById.get(id);
      const row = auditById.get(id);
      if (blockedIds.includes(id)) {
        expect(university, id).toMatchObject({ state: 'pending', sourceIds: [] });
        expect(row, id).toMatchObject({ expectedState: 'pending', reviewStatus: 'blocked', reviewDate: '2026-08-09' });
      } else {
        expect(university?.state, id).toBe('china-requirements');
        expect(row, id).toMatchObject({ expectedState: 'china-requirements', reviewStatus: 'reviewed', reviewDate: '2026-08-09' });
      }
    }
    expect(audit.filter((row) => row.reviewStatus === 'unreviewed')).toHaveLength(0);
  });

  it('pins each reviewed page to zero-record link-only evidence with human Chinese semantics', () => {
    expect(batch5Sources).toHaveLength(5);
    for (const [universityId, sourceId, url, scope, requiredText, scopeZh, summaryZh, caveatZh] of batch5Sources) {
      const university = universityById.get(universityId);
      const source = sourceById.get(sourceId);
      expect(university?.sourceIds, sourceId).toEqual([sourceId]);
      expect(source).toMatchObject({
        id: sourceId, universityId, url, kind: 'china-requirements', scope, scopeZh,
        institutionRule: { type: 'none', summaryZh, caveatZh, verification: { reviewedAt: '2026-08-09', url, requiredText } },
        parser: { mode: 'link-only', guard: { minimumRecords: 0, maximumRecords: 0, maximumRemovalRatio: 0 } },
      });
      expect([source?.scopeZh, source?.institutionRule.summaryZh, source?.institutionRule.caveatZh]
        .every((value) => value?.trim()), sourceId).toBe(true);
      expectUnacceptedLinkOnlyStatus(statuses[sourceId], sourceId);
      expect(requirements.some((fact) => fact.sourceId === sourceId), sourceId).toBe(false);
    }
  });

  it('keeps every blocked Batch 5 row source-free', () => {
    for (const id of batch5Ids.filter((id) => auditById.get(id)?.reviewStatus === 'blocked')) {
      expect(universityById.get(id)?.sourceIds, id).toEqual([]);
    }
  });

  it('records Wolverhampton’s failed Pre-Master’s pathway PDF without generalising it to university-wide entry', () => {
    const university = universityById.get('university-of-wolverhampton');
    expect(university).toMatchObject({ state: 'pending', sourceIds: [] });
    expect(auditById.get('university-of-wolverhampton')).toMatchObject({
      reviewStatus: 'blocked', finding: expect.stringMatching(/Pre-Master|pathway|programme/i),
    });
  });

  it('covers the exact immutable 65-school feature-start pending cohort across all five batches', () => {
    expect(allPendingAuditBatchIds).toHaveLength(65);
    expect(new Set(allPendingAuditBatchIds).size).toBe(65);
    expect([...allPendingAuditBatchIds].sort()).toEqual([...baseline.pendingUniversityIds].sort());
  });
});
