import { describe, expect, it } from 'vitest';
import researchMarkdown from '../docs/research/masters-course-directory-batch-1.md?raw';
import { loadMastersCourseDirectories } from '../src/lib/data';

const batch1UniversityIds = [
  'imperial-college-london',
  'university-of-oxford',
  'university-of-cambridge',
  'university-college-london',
  'university-of-edinburgh',
  'kings-college-london',
  'university-of-manchester',
  'university-of-bristol',
  'london-school-of-economics-and-political-science',
  'university-of-warwick',
  'university-of-birmingham',
  'university-of-leeds',
  'university-of-glasgow',
  'university-of-sheffield',
  'durham-university',
  'university-of-nottingham',
  'queen-mary-university-of-london',
  'university-of-southampton',
  'university-of-st-andrews',
  'university-of-bath',
  'university-of-exeter',
  'university-of-liverpool',
  'newcastle-university',
  'university-of-york',
  'lancaster-university',
  'queens-university-belfast',
] as const;

const verifiedExpectations = {
  'imperial-college-london': {
    url: 'https://www.imperial.ac.uk/study/courses/?courseType=postgraduate+taught',
    pageTitle: 'Course search | Study | Imperial College London',
    requiredText: ['Find a course', 'Postgraduate taught'],
  },
  'university-of-oxford': {
    url: 'https://www.ox.ac.uk/admissions/graduate/courses/find-your-course',
    pageTitle: 'Find your postgraduate course | Oxford University',
    requiredText: ['Find your postgraduate course', "Use this search tool to explore all of Oxford's graduate courses."],
  },
  'university-of-cambridge': {
    url: 'https://www.postgraduate.study.cam.ac.uk/courses',
    pageTitle: 'Course Directory | Postgraduate Study',
    requiredText: ['Course Directory', 'Use the Course Directory to search over 300 postgraduate courses at Cambridge.'],
  },
  'university-college-london': {
    url: 'https://www.ucl.ac.uk/study/prospective-students/graduate',
    pageTitle: 'Graduate degrees | Study at UCL',
    requiredText: ['Taught degrees', 'Research degrees'],
  },
  'university-of-edinburgh': {
    url: 'https://study.ed.ac.uk/postgraduate',
    pageTitle: 'Postgraduate study | The University of Edinburgh',
    requiredText: ['Browse the degree finder', 'Search the degree finder'],
  },
  'kings-college-london': {
    url: 'https://www.kcl.ac.uk/study/home?lang=en',
    pageTitle: "Study | King's College London",
    requiredText: ['Postgraduate taught', 'Postgraduate research'],
  },
  'university-of-manchester': {
    url: 'https://www.manchester.ac.uk/study/',
    pageTitle: 'Study | The University of Manchester',
    requiredText: ["Taught master's", 'Postgraduate research'],
  },
  'university-of-bristol': {
    url: 'https://www.bristol.ac.uk/study/postgraduate/',
    pageTitle: 'Postgraduate study | Study at Bristol | University of Bristol',
    requiredText: ['Find your programme', 'Postgraduate study routes'],
  },
  'london-school-of-economics-and-political-science': {
    url: 'https://www.lse.ac.uk/study-at-lse/Graduate',
    pageTitle: 'Graduate',
    requiredText: ['Graduate study opportunities at LSE', 'Available programmes'],
  },
  'university-of-warwick': {
    url: 'https://warwick.ac.uk/study/postgraduate/courses-2026/course-list/',
    pageTitle: 'course-list',
    requiredText: ['Postgraduate Taught', 'Postgraduate Research'],
  },
  'university-of-birmingham': {
    url: 'https://www.birmingham.ac.uk/study/postgraduate',
    pageTitle: 'Postgraduate study & research at Birmingham - University of Birmingham',
    requiredText: ['Postgraduate study or research', 'over 600 taught postgraduate programmes'],
  },
  'university-of-leeds': {
    url: 'https://courses.leeds.ac.uk/courses/',
    pageTitle: 'Course Search | University of Leeds',
    requiredText: ['Undergraduate and Masters course search', 'Search for postgraduate research opportunities'],
  },
  'university-of-glasgow': {
    url: 'https://www.gla.ac.uk/postgraduate/',
    pageTitle: 'University of Glasgow - Postgraduate study',
    requiredText: ['Find a programme', 'Postgraduate Research'],
  },
  'university-of-sheffield': {
    url: 'https://sheffield.ac.uk/postgraduate',
    pageTitle: 'Postgraduate study | Postgraduate study | The University of Sheffield',
    requiredText: ['Postgraduate study', 'A masters or PhD at Sheffield'],
  },
  'durham-university': {
    url: 'https://www.durham.ac.uk/study/postgraduate/',
    pageTitle: 'Postgraduate - Durham University',
    requiredText: [
      'Postgraduate Taught degrees',
      'Postgraduate Research',
    ],
  },
  'university-of-nottingham': {
    url: 'https://www.nottingham.ac.uk/pgstudy/courses/courses.aspx',
    pageTitle: 'Postgraduate course search - The University of Nottingham',
    requiredText: ['Postgraduate course search', 'Taught Research All'],
  },
  'queen-mary-university-of-london': {
    url: 'https://www.qmul.ac.uk/postgraduate/',
    pageTitle: 'Postgraduate study - Queen Mary University of London',
    requiredText: ['Masters programmes', 'Research degrees'],
  },
  'university-of-southampton': {
    url: 'https://www.southampton.ac.uk/courses',
    pageTitle: 'CourseFinder | University of Southampton',
    requiredText: ['Find your course', 'Select study level'],
  },
  'university-of-st-andrews': {
    url: 'https://www.st-andrews.ac.uk/study/postgraduate/',
    pageTitle: 'Masters - Study at St Andrews - University of St Andrews',
    requiredText: ['Masters study at St Andrews', 'Research degrees'],
  },
  'university-of-bath': {
    url: 'https://www.bath.ac.uk/courses/',
    pageTitle: 'Courses',
    requiredText: ['Search for a course', 'Postgraduate research'],
  },
  'university-of-exeter': {
    url: 'https://www.exeter.ac.uk/masters-degrees/',
    pageTitle: 'Masters Degrees and Courses | University of Exeter',
    requiredText: ['Masters degrees and courses', 'Search for a course'],
  },
  'university-of-liverpool': {
    url: 'https://www.liverpool.ac.uk/courses/postgraduate-taught',
    pageTitle: 'Postgraduate taught | Courses | University of Liverpool',
    requiredText: ['Our courses', 'Postgraduate research'],
  },
  'newcastle-university': {
    url: 'https://www.ncl.ac.uk/postgraduate/degrees/',
    pageTitle: 'Find a Degree | Postgraduate | Newcastle University',
    requiredText: ['Find a Postgraduate Degree', 'more than 300 postgraduate degrees'],
  },
  'university-of-york': {
    url: 'https://www.york.ac.uk/study/postgraduate/',
    pageTitle: 'Postgraduate - Postgraduate, University of York',
    requiredText: ['Postgraduate taught', 'Masters by research'],
  },
  'lancaster-university': {
    url: 'https://www.lancaster.ac.uk/study/postgraduate/postgraduate-courses/',
    pageTitle: 'Postgraduate courses - Lancaster University',
    requiredText: ['Postgraduate courses', 'Find your course'],
  },
  'queens-university-belfast': {
    url: 'https://www.qub.ac.uk/Study/postgraduate/',
    pageTitle: "Postgraduate Degrees  | Study | Queen's University Belfast",
    requiredText: ['Masters Degrees', 'Research Degrees'],
  },
} as const;

const reviewedCombinedPostgraduateManifest = {
  'university-college-london': {
    officialUrl: 'https://www.ucl.ac.uk/prospective-students/graduate',
    knownTaughtOnlyUrl: 'https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees',
    knownTaughtOnlyRequiredText: ['Find your course', 'Search by keyword'],
  },
  'kings-college-london': {
    officialUrl: 'https://www.kcl.ac.uk/study/home?lang=en',
    knownTaughtOnlyUrl: 'https://www.kcl.ac.uk/study/postgraduate-taught',
    knownTaughtOnlyRequiredText: ['Postgraduate taught', 'Search for courses'],
  },
  'university-of-manchester': {
    officialUrl: 'https://www.manchester.ac.uk/study/',
    knownTaughtOnlyUrl: 'https://www.manchester.ac.uk/study/masters/courses/',
    knownTaughtOnlyRequiredText: ["Master's courses at The University of Manchester", 'Course finder'],
  },
  'queen-mary-university-of-london': {
    officialUrl: 'https://www.qmul.ac.uk/postgraduate/',
    knownTaughtOnlyUrl: 'https://www.qmul.ac.uk/postgraduate/taught/',
    knownTaughtOnlyRequiredText: ['Postgraduate Taught', 'Find a course'],
  },
  'university-of-york': {
    officialUrl: 'https://www.york.ac.uk/study/postgraduate/',
    knownTaughtOnlyUrl: 'https://www.york.ac.uk/study/postgraduate/courses/all',
    knownTaughtOnlyRequiredText: ['Search postgraduate taught courses', 'Showing all courses'],
  },
  'queens-university-belfast': {
    officialUrl: 'https://www.qub.ac.uk/Study/PostgraduateStudy/',
    knownTaughtOnlyUrl: 'https://www.qub.ac.uk/courses/postgraduate-taught/',
    knownTaughtOnlyRequiredText: ['Postgraduate Taught 2026 Course Search', 'Postgraduate Taught 2026 Course Listings'],
  },
} as const;

describe('masters course directory batch 1', () => {
  it('contains every batch university and the fixed record contract', () => {
    const records = loadMastersCourseDirectories();
    const byUniversityId = new Map(records.map((record) => [record.universityId, record]));

    for (const id of batch1UniversityIds) {
      expect(byUniversityId.has(id), `missing masters directory for ${id}`).toBe(true);
      const record = byUniversityId.get(id)!;
      expect(record.id).toBe(`masters-${id}`);
      expect(record.labelZh).toBe('查看全部硕士课程');
      expect(record.monitorMode).toBe('page-identity');
      expect(record.requiredText.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(Object.entries(verifiedExpectations))('pins reviewed evidence for %s', (universityId, expected) => {
    const record = loadMastersCourseDirectories().find((entry) => entry.universityId === universityId);
    expect(record).toMatchObject({
      id: `masters-${universityId}`,
      universityId,
      labelZh: '查看全部硕士课程',
      ...expected,
      reviewedAt: '2026-08-11',
      monitorMode: 'page-identity',
    });
  });

  it('keeps the Durham research anchors exactly aligned with production evidence', () => {
    const expected = verifiedExpectations['durham-university'];
    const row = researchMarkdown.split(/\r?\n/)
      .find((line) => line.startsWith('| durham-university |'));
    expect(row).toBeDefined();

    const cells = row!.replace(/^\| /, '').replace(/ \|$/, '').split(' | ');
    expect(cells.slice(0, 7)).toEqual([
      'durham-university',
      expected.url,
      expected.url,
      expected.pageTitle,
      ...expected.requiredText,
      '2026-08-11',
    ]);
    expect(cells[7]).toContain('Postgraduate study');
    expect(cells[7]).toContain('both Postgraduate Taught degrees and Postgraduate Research');
  });

  it.each(Object.entries(reviewedCombinedPostgraduateManifest))(
    'keeps %s on its reviewed combined postgraduate entry',
    (universityId, knownTaughtOnly) => {
      const expected = verifiedExpectations[universityId as keyof typeof verifiedExpectations];
      const record = loadMastersCourseDirectories().find((entry) => entry.universityId === universityId)!;
      expect(record.labelZh).toBe('查看全部硕士课程');
      expect(record.url).toBe(expected.url);
      expect(record.url).not.toBe(knownTaughtOnly.knownTaughtOnlyUrl);
      expect(record.requiredText).toEqual(expected.requiredText);
      expect(record.requiredText).not.toEqual(knownTaughtOnly.knownTaughtOnlyRequiredText);

      const researchRow = researchMarkdown.split(/\r?\n/)
        .find((line) => line.startsWith(`| ${universityId} |`));
      expect(researchRow).toBeDefined();
      const cells = researchRow!.replace(/^\| /, '').replace(/ \|$/, '').split(' | ');
      expect(cells.slice(0, 7)).toEqual([
        universityId,
        knownTaughtOnly.officialUrl,
        expected.url,
        expected.pageTitle.replaceAll('|', '\\|'),
        ...expected.requiredText,
        '2026-08-11',
      ]);
      expect(cells[7]).toMatch(/taught|master/i);
      expect(cells[7]).toMatch(/research|MPhil|MRes/i);
    },
  );

  it('documents the QUB anti-bot threshold and rejects its empty JavaScript finder', () => {
    const record = loadMastersCourseDirectories()
      .find((entry) => entry.universityId === 'queens-university-belfast')!;
    expect(record.url).toBe('https://www.qub.ac.uk/Study/postgraduate/');
    expect(record.url).not.toBe('https://www.qub.ac.uk/courses/?level=pg');

    const researchRow = researchMarkdown.split(/\r?\n/)
      .find((line) => line.startsWith('| queens-university-belfast |'))!;
    expect(researchRow).toContain('automated checker receives 403');
    expect(researchRow).toContain('existing three-failure threshold');
    expect(researchRow).toContain('empty 202 response');
  });
});
