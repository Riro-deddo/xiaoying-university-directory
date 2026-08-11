import { describe, expect, it } from 'vitest';
import batch1ResearchMarkdown from '../docs/research/masters-course-directory-batch-1.md?raw';
import batch2ResearchMarkdown from '../docs/research/masters-course-directory-batch-2.md?raw';
import batch3ResearchMarkdown from '../docs/research/masters-course-directory-batch-3.md?raw';
import { loadMastersCourseDirectories } from '../src/lib/data';

const batch3UniversityIds = [
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
] as const;

const verifiedExpectations = {
  'university-of-essex': {
    url: 'https://www.essex.ac.uk/postgraduate',
    pageTitle: 'Postgraduate study at Essex | University of Essex',
    requiredText: ['Masters courses', 'research degrees'],
  },
  'university-of-dundee': {
    url: 'https://www.dundee.ac.uk/postgraduate',
    pageTitle: 'Postgraduate | University of Dundee, UK',
    requiredText: ['Postgraduate taught courses and postgraduate research degrees', "Find a PhD or Master's by Research opportunity"],
  },
  'soas-university-of-london': {
    url: 'https://www.soas.ac.uk/study/find-course',
    pageTitle: 'Find a course | SOAS',
    requiredText: ['Explore our courses', 'Choose from our list of undergraduate, postgraduate, online learning, research and short courses.'],
  },
  'royal-holloway-university-of-london': {
    url: 'https://www.royalholloway.ac.uk/studying-here/',
    pageTitle: 'Find the right course for you',
    requiredText: ['Search course or subject', 'MSc by Research'],
  },
  'university-of-bradford': {
    url: 'https://www.bradford.ac.uk/postgraduate/',
    pageTitle: 'Postgraduate - Study - University of Bradford',
    requiredText: ['Postgraduate taught (PGT) courses', 'Postgraduate research (PGR) degrees'],
  },
  'university-of-huddersfield': {
    url: 'https://courses.hud.ac.uk/',
    pageTitle: 'Coursefinder - University of Huddersfield',
    requiredText: ['Search a course', 'Search for undergraduate, postgraduate, research degrees and apprenticeships.'],
  },
  'northumbria-university': {
    url: 'https://www.northumbria.ac.uk/study-at-northumbria/',
    pageTitle: 'Study an Undergraduate or Postgraduate Course in the UK | Northumbria',
    requiredText: ['FIND YOUR COURSE', 'Postgraduate Research Degrees'],
  },
  'university-of-stirling': {
    url: 'https://www.stir.ac.uk/courses/',
    pageTitle: 'Find a course | University of Stirling',
    requiredText: ['View full postgraduate taught course listing', 'View full postgraduate research degree listing'],
  },
  'bangor-university': {
    url: 'https://www.bangor.ac.uk/postgraduate',
    pageTitle: 'Postgraduate Study | Bangor University',
    requiredText: ['Search Postgraduate Taught Courses', 'Search Postgraduate Research Courses'],
  },
  'university-of-hull': {
    url: 'https://www.hull.ac.uk/study/types-of-postgraduate-qualifications',
    pageTitle: 'Type of Postgraduate Qualification | University of Hull',
    requiredText: ['Search for your perfect postgraduate degree', 'All postgraduate research degrees'],
  },
  'coventry-university': {
    url: 'https://www.coventry.ac.uk/study-at-coventry/postgraduate-study/',
    pageTitle: 'Postgraduate Study | Coventry University',
    requiredText: ['Postgraduate A-Z course list', 'Research degrees'],
  },
  'ulster-university': {
    url: 'https://www.ulster.ac.uk/courses',
    pageTitle: 'Courses at Ulster University | Courses at Ulster University',
    requiredText: ['Course Finder', 'PG Research'],
  },
  'manchester-metropolitan-university': {
    url: 'https://www.mmu.ac.uk/study/postgraduate/options',
    pageTitle: 'Postgraduate study options | Manchester Metropolitan University',
    requiredText: ['Find a postgraduate course', 'Postgraduate research'],
  },
  'nottingham-trent-university': {
    url: 'https://www.ntu.ac.uk/study-and-courses/courses/find-your-course',
    pageTitle: 'Course search | Nottingham Trent University',
    requiredText: ['Course search', 'Masters'],
  },
  'university-of-portsmouth': {
    url: 'https://www.port.ac.uk/study/postgraduate',
    pageTitle: 'Portsmouth: Perfect for postgraduates | University of Portsmouth',
    requiredText: ["Master's and postgraduate taught courses", 'PhDs and postgraduate research'],
  },
  'kingston-university-london': {
    url: 'https://www.kingston.ac.uk/study/postgraduate',
    pageTitle: 'Postgraduate study | Kingston University London',
    requiredText: ['Search all postgraduate courses', 'We offer a wide range of taught and research masters courses.'],
  },
  'university-of-plymouth': {
    url: 'https://www.plymouth.ac.uk/study/postgraduate',
    pageTitle: 'Postgraduate study - University of Plymouth',
    requiredText: ['Search for a course', 'Research degrees backed by a UK top-20 experience*'],
  },
  'goldsmiths-university-of-london': {
    url: 'https://www.gold.ac.uk/pg/',
    pageTitle: 'Postgraduate | Goldsmiths, University of London',
    requiredText: ['Postgraduate courses', 'Research degrees'],
  },
  'university-of-the-west-of-england': {
    url: 'https://courses.uwe.ac.uk/Search',
    pageTitle: 'Find a course - UWE Bristol: Courses',
    requiredText: ['Course search', 'Postgraduate Research'],
  },
  'university-of-greenwich': {
    url: 'https://www.gre.ac.uk/postgraduate-courses',
    pageTitle: 'Postgraduate courses | University of Greenwich, London',
    requiredText: ['Course search:', 'Research degrees'],
  },
  'aberystwyth-university': {
    url: 'https://www.aber.ac.uk/en/study-with-us/pg-studies/',
    pageTitle: 'Postgraduate Studies  : Aberystwyth University',
    requiredText: ['Find your course', 'The Doctoral Academy'],
  },
  'bournemouth-university': {
    url: 'https://www.bournemouth.ac.uk/study/postgraduate',
    pageTitle: 'Postgraduate study | Bournemouth University',
    requiredText: ['Browse our courses', 'PhDs and postgraduate research degrees'],
  },
  'edinburgh-napier-university': {
    url: 'https://www.napier.ac.uk/courses',
    pageTitle: 'Courses',
    requiredText: ['Find the course that’s right for you at Edinburgh Napier University.', 'Find out how to become a postgraduate researcher'],
  },
  'keele-university': {
    url: 'https://www.keele.ac.uk/study/postgraduatestudy/',
    pageTitle: 'Postgraduate study - Keele University',
    requiredText: ['Postgraduate courses A-Z', 'Postgraduate research'],
  },
  'de-montfort-university': {
    url: 'https://www.dmu.ac.uk/study/courses/postgraduate-courses/postgraduate-courses.aspx',
    pageTitle: 'Postgraduate courses at De Montfort University',
    requiredText: ['Postgraduate courses at De Montfort University', 'DMU Courses'],
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
        requiredText: [cells[4], cells[5]],
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

describe('masters course directory batch 3', () => {
  it('contains every batch university and the fixed record contract', () => {
    const records = loadMastersCourseDirectories();
    const byUniversityId = new Map(records.map((record) => [record.universityId, record]));

    expect(batch3UniversityIds.every((id) => byUniversityId.has(id))).toBe(true);
    for (const id of batch3UniversityIds) {
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
    const researchRows = parseResearchRows(batch3ResearchMarkdown);
    expect(researchRows.map((row) => row.universityId)).toEqual(batch3UniversityIds);
    expect(researchRows).toEqual(batch3UniversityIds.map((universityId) => ({
      universityId,
      ...verifiedExpectations[universityId],
      reviewedAt: '2026-08-11',
    })));

    const byUniversityId = new Map(loadMastersCourseDirectories().map((record) => [record.universityId, record]));
    expect(researchRows.map((row) => byUniversityId.get(row.universityId))).toEqual(
      researchRows.map(productionRecord),
    );
  });

  it('keeps all 51 previous records deeply unchanged', () => {
    const frozenPreviousRecords = [
      ...parseResearchRows(batch1ResearchMarkdown),
      ...parseResearchRows(batch2ResearchMarkdown),
    ].map(productionRecord);
    const previousIds = new Set(frozenPreviousRecords.map((record) => record.universityId));
    const actualPreviousRecords = loadMastersCourseDirectories()
      .filter((record) => previousIds.has(record.universityId));

    expect(frozenPreviousRecords).toHaveLength(51);
    expect(actualPreviousRecords).toEqual(frozenPreviousRecords);
  });
});
