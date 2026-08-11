import { describe, expect, it } from 'vitest';
import batch1ResearchMarkdown from '../docs/research/masters-course-directory-batch-1.md?raw';
import batch2ResearchMarkdown from '../docs/research/masters-course-directory-batch-2.md?raw';
import batch3ResearchMarkdown from '../docs/research/masters-course-directory-batch-3.md?raw';
import batch4ResearchMarkdown from '../docs/research/masters-course-directory-batch-4.md?raw';
import { loadMastersCourseDirectories } from '../src/lib/data';

const batch4UniversityIds = [
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
  'london-metropolitan-university',
  'robert-gordon-university',
  'sheffield-hallam-university',
  'university-of-east-london',
  'university-of-lancashire',
  'university-of-roehampton',
  'university-of-salford',
  'university-of-wolverhampton',
  'queen-margaret-university-edinburgh',
  'university-of-northampton',
  'university-of-derby',
  'university-of-south-wales',
  'canterbury-christ-church-university',
] as const;

const verifiedExpectations = {
  'liverpool-john-moores-university': {
    url: 'https://www.ljmu.ac.uk/study/postgraduate-students',
    pageTitle: 'Postgraduate | Liverpool John Moores University',
    requiredText: ['Find your course', 'postgraduate research opportunities'],
  },
  'university-of-hertfordshire': {
    url: 'https://www.herts.ac.uk/courses',
    pageTitle: 'Courses | University of Hertfordshire',
    requiredText: ['Postgraduate and Master’s Degree Courses', 'Research degrees'],
  },
  'university-of-lincoln': {
    url: 'https://www.lincoln.ac.uk/course/',
    pageTitle: 'Courses | Study at Lincoln | University of Lincoln',
    requiredText: ['Courses', 'Postgraduate Research'],
  },
  'university-of-the-arts-london': {
    url: 'https://www.arts.ac.uk/courses',
    pageTitle: 'Courses | UAL',
    requiredText: ['Postgraduate', 'Research degrees'],
  },
  'university-of-westminster': {
    url: 'https://www.westminster.ac.uk/study/postgraduate',
    pageTitle: 'Postgraduate | University of Westminster, London',
    requiredText: ['Find your course', 'Research degrees'],
  },
  'london-south-bank-university': {
    url: 'https://www.lsbu.ac.uk/study/course-finder',
    pageTitle: 'Course finder | London South Bank University',
    requiredText: ['Postgraduate', 'Research and Doctorates'],
  },
  'middlesex-university': {
    url: 'https://www.mdx.ac.uk/courses/?courseStudyType=postgraduate',
    pageTitle: 'Find a course | Middlesex University',
    requiredText: ['Postgraduate', 'Research degrees'],
  },
  'university-of-brighton': {
    url: 'https://www.brighton.ac.uk/courses/index.aspx',
    pageTitle: 'Courses',
    requiredText: ['University course search: Find the best courses to study', 'PhD, MPhil and professional doctorates'],
  },
  'anglia-ruskin-university': {
    url: 'https://www.aru.ac.uk/study',
    pageTitle: 'Study a degree course at Anglia Ruskin University - ARU',
    requiredText: ['Study a Masters or research degree at ARU', 'Research programmes'],
  },
  'birmingham-city-university': {
    url: 'https://www.bcu.ac.uk/courses',
    pageTitle: 'Courses | Birmingham City University',
    requiredText: ['Postgraduate Taught', 'Postgraduate Research'],
  },
  'glasgow-caledonian-university': {
    url: 'https://www.gcu.ac.uk/study',
    pageTitle: 'Study | Glasgow Caledonian University | Scotland, UK',
    requiredText: ['Find your course', 'Postgraduate research study'],
  },
  'leeds-beckett-university': {
    url: 'https://www.leedsbeckett.ac.uk/postgraduate/',
    pageTitle: 'Postgraduate study | Leeds Beckett University',
    requiredText: ['Find a course', 'Postgraduate research degrees'],
  },
  'london-metropolitan-university': {
    url: 'https://www.londonmet.ac.uk/courses/postgraduate/',
    pageTitle: 'Postgraduate courses - London Metropolitan University',
    requiredText: ["Master's (MA, MSc, MBA) and research degrees", 'Search for a postgraduate course'],
  },
  'robert-gordon-university': {
    url: 'https://www.rgu.ac.uk/study/course-search',
    pageTitle: 'Course Search | Study | RGU',
    requiredText: ['RGU Course Search', 'Postgraduate', 'Graduate School'],
  },
  'sheffield-hallam-university': {
    url: 'https://www.shu.ac.uk/study-here/postgraduate',
    pageTitle: 'Postgraduate | Sheffield Hallam University',
    requiredText: ['Masters and diplomas', 'PhDs'],
  },
  'university-of-east-london': {
    url: 'https://www.uel.ac.uk/study/postgraduate',
    pageTitle: 'Postgraduate | University of East London',
    requiredText: ['Search for a postgraduate programme', 'Research degrees (MPhil, PhD, Professional Doctorates)'],
  },
  'university-of-lancashire': {
    url: 'https://www.lancashire.ac.uk/courses/a-z',
    pageTitle: 'A-Z Course List - Find Your Course',
    requiredText: ['Postgraduate taught A-Z', 'Postgraduate research A-Z'],
  },
  'university-of-roehampton': {
    url: 'https://www.roehampton.ac.uk/study/postgraduate-study/',
    pageTitle: 'Postgraduate Study | University of Roehampton, London',
    requiredText: ['postgraduate taught and research programmes', 'Research degrees'],
  },
  'university-of-salford': {
    url: 'https://www.salford.ac.uk/postgraduate',
    pageTitle: 'Postgraduate | University of Salford',
    requiredText: ['Postgraduate taught courses', 'Postgraduate research courses'],
  },
  'university-of-wolverhampton': {
    url: 'https://www.wlv.ac.uk/courses/',
    pageTitle: 'Courses - University of Wolverhampton',
    requiredText: ['Postgraduate Courses', 'Research (PhD)'],
  },
  'queen-margaret-university-edinburgh': {
    url: 'https://www.qmu.ac.uk/study-here/course-a-z/',
    pageTitle: 'Course A-Z | Queen Margaret University, Edinburgh',
    requiredText: ['postgraduate taught courses', 'research degrees'],
  },
  'university-of-northampton': {
    url: 'https://www.northampton.ac.uk/postgraduate/',
    pageTitle: "Master's Study | University of Northampton",
    requiredText: ["Master's and Postgraduate Courses", 'Research Degrees'],
  },
  'university-of-derby': {
    url: 'https://www.derby.ac.uk/postgraduate/courses/',
    pageTitle: 'Courses - Postgraduate - University of Derby',
    requiredText: ['Postgraduate course search', 'Research degrees'],
  },
  'university-of-south-wales': {
    url: 'https://www.southwales.ac.uk/courses/',
    pageTitle: 'Courses - University of South Wales',
    requiredText: ['Find a course', 'Postgraduate Research Degrees'],
  },
  'canterbury-christ-church-university': {
    url: 'https://www.canterbury.ac.uk/study-here/explore-postgraduate',
    pageTitle: 'Explore postgraduate | CCCU',
    requiredText: ['Explore postgraduate', 'Find your perfect postgraduate course using our search.', 'Research subject areas'],
  },
} as const;

function parseResearchRows(markdown: string) {
  return markdown.split(/\r?\n/)
    .filter((line) => /^\| [a-z0-9-]+ \| https:\/\//.test(line))
    .map((line) => {
      const cells = line.replace(/^\| /, '').replace(/ \|$/, '')
        .split(/ (?<!\\)\| /)
        .map((cell) => cell.replaceAll('\\|', '|'));
      return {
        universityId: cells[0],
        url: cells[2],
        pageTitle: cells[3],
        requiredText: [cells[4], cells[5]].flatMap((cell) => cell.split('<br>')),
        reviewedAt: cells[6],
      };
    });
}

function productionRecord(row: ReturnType<typeof parseResearchRows>[number]) {
  return {
    id: `masters-${row.universityId}`,
    universityId: row.universityId,
    labelZh: '查看全部硕士课程',
    url: row.url,
    pageTitle: row.pageTitle,
    reviewedAt: row.reviewedAt,
    requiredText: row.requiredText,
    monitorMode: 'page-identity',
  };
}

describe('masters course directory batch 4', () => {
  it('contains every batch university and the fixed record contract', () => {
    const records = loadMastersCourseDirectories();
    const byUniversityId = new Map(records.map((record) => [record.universityId, record]));

    expect(batch4UniversityIds.every((id) => byUniversityId.has(id))).toBe(true);
    for (const id of batch4UniversityIds) {
      const record = byUniversityId.get(id)!;
      expect(record.id).toBe(`masters-${id}`);
      expect(record.labelZh).toBe('查看全部硕士课程');
      expect(record.monitorMode).toBe('page-identity');
      expect(record.requiredText.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(Object.entries(verifiedExpectations))('pins reviewed evidence for %s', (universityId, expected) => {
    const record = loadMastersCourseDirectories().find((entry) => entry.universityId === universityId);
    expect(record).toEqual({
      id: `masters-${universityId}`,
      universityId,
      labelZh: '查看全部硕士课程',
      ...expected,
      reviewedAt: '2026-08-11',
      monitorMode: 'page-identity',
    });
  });

  it('keeps research, test expectations, and production evidence in exact parity', () => {
    const researchRows = parseResearchRows(batch4ResearchMarkdown);
    expect(researchRows.map((row) => row.universityId)).toEqual(batch4UniversityIds);
    expect(researchRows).toEqual(batch4UniversityIds.map((universityId) => ({
      universityId,
      ...verifiedExpectations[universityId],
      reviewedAt: '2026-08-11',
    })));

    const byUniversityId = new Map(loadMastersCourseDirectories().map((record) => [record.universityId, record]));
    expect(researchRows.map((row) => byUniversityId.get(row.universityId))).toEqual(
      researchRows.map(productionRecord),
    );
  });

  it('keeps all 76 previous records deeply unchanged', () => {
    const frozenPreviousRecords = [
      ...parseResearchRows(batch1ResearchMarkdown),
      ...parseResearchRows(batch2ResearchMarkdown),
      ...parseResearchRows(batch3ResearchMarkdown),
    ].map(productionRecord);
    const previousIds = new Set(frozenPreviousRecords.map((record) => record.universityId));
    const actualPreviousRecords = loadMastersCourseDirectories()
      .filter((record) => previousIds.has(record.universityId));

    expect(frozenPreviousRecords).toHaveLength(76);
    expect(actualPreviousRecords).toEqual(frozenPreviousRecords);
  });
});
