import { describe, expect, it } from 'vitest';
import batch1ResearchMarkdown from '../docs/research/masters-course-directory-batch-1.md?raw';
import batch2ResearchMarkdown from '../docs/research/masters-course-directory-batch-2.md?raw';
import { loadMastersCourseDirectories } from '../src/lib/data';

const batch2UniversityIds = [
  'cardiff-university',
  'university-of-reading',
  'cranfield-university',
  'london-business-school',
  'london-school-of-hygiene-and-tropical-medicine',
  'royal-college-of-art',
  'royal-veterinary-college',
  'royal-college-of-music',
  'institute-of-cancer-research-london',
  'liverpool-school-of-tropical-medicine',
  'loughborough-university',
  'university-of-strathclyde',
  'university-of-surrey',
  'university-of-sussex',
  'university-of-aberdeen',
  'university-of-leicester',
  'swansea-university',
  'heriot-watt-university',
  'brunel-university-of-london',
  'birkbeck-university-of-london',
  'city-st-georges-university-of-london',
  'university-of-east-anglia',
  'oxford-brookes-university',
  'university-of-kent',
  'aston-university',
] as const;

const verifiedExpectations = {
  'cardiff-university': {
    url: 'https://www.cardiff.ac.uk/study/postgraduate',
    pageTitle: 'Postgraduate - Study - Cardiff University',
    requiredText: ['Find your course', 'A-Z of research programmes'],
  },
  'university-of-reading': {
    url: 'https://www.reading.ac.uk/ready-to-study/study/postgraduate-study',
    pageTitle: 'Postgraduate study',
    requiredText: ["Find a master's course", 'Postgraduate research'],
  },
  'cranfield-university': {
    url: 'https://www.cranfield.ac.uk/courses',
    pageTitle: 'Our courses',
    requiredText: ['Find a course', 'Our courses and research programmes'],
  },
  'london-business-school': {
    url: 'https://www.london.edu/masters-degrees',
    pageTitle: 'Masters Degrees | London Business School',
    requiredText: ["Find the masters programme that's right for you.", 'Our Programmes'],
  },
  'london-school-of-hygiene-and-tropical-medicine': {
    url: 'https://www.lshtm.ac.uk/study/courses',
    pageTitle: 'Courses | Study with us | LSHTM',
    requiredText: ['Course finder', "LSHTM offers a wide range of Master's and Research degrees."],
  },
  'royal-college-of-art': {
    url: 'https://www.rca.ac.uk/study/programme-finder/',
    pageTitle: 'Programme finder | Royal College of Art',
    requiredText: [
      'Programme finder',
      'We offer a range of Graduate Diploma, MA, MArch, MEd, MFA, MDes, MRes, MPhil and PhD degree programmes across the art and design disciplines.',
    ],
  },
  'royal-veterinary-college': {
    url: 'https://www.rvc.ac.uk/study/postgraduate',
    pageTitle: 'Postgraduate Courses',
    requiredText: ['Courses', 'Research'],
  },
  'royal-college-of-music': {
    url: 'https://www.rcm.ac.uk/courses/',
    pageTitle: 'Courses | Royal College of Music',
    requiredText: ['Taught postgraduate', 'Research degrees'],
  },
  'institute-of-cancer-research-london': {
    url: 'https://www.icr.ac.uk/study-and-careers',
    pageTitle: 'Study and careers',
    requiredText: ['Studying at the ICR', 'MSc in Oncology'],
  },
  'liverpool-school-of-tropical-medicine': {
    url: 'https://lstmed.ac.uk/study/',
    pageTitle: 'Study | Liverpool School of Tropical Medicine',
    requiredText: ['Master’s degrees', 'Research degrees'],
  },
  'loughborough-university': {
    url: 'https://www.lboro.ac.uk/study/postgraduate/',
    pageTitle: 'Postgraduate study | Loughborough University',
    requiredText: ["Master's degrees", 'PhD opportunities'],
  },
  'university-of-strathclyde': {
    url: 'https://www.strath.ac.uk/courses/',
    pageTitle: 'University Courses in Scotland, UK - University of Strathclyde',
    requiredText: ['Find your course', 'Postgraduate research'],
  },
  'university-of-surrey': {
    url: 'https://www.surrey.ac.uk/prospectus-and-guides',
    pageTitle: 'Create your Surrey prospectus | University of Surrey',
    requiredText: ['Postgraduate courses', 'Research courses'],
  },
  'university-of-sussex': {
    url: 'https://www.sussex.ac.uk/study/masters/',
    pageTitle: 'Masters Courses, Degrees : Study : University of Sussex',
    requiredText: ['Masters courses', 'Find a course'],
  },
  'university-of-aberdeen': {
    url: 'https://www.abdn.ac.uk/study/postgraduate-taught/',
    pageTitle: 'Where will your quest for knowledge take you? | Study Here | The University of Aberdeen',
    requiredText: ['Degree Search', 'Explore our Masters by Research'],
  },
  'university-of-leicester': {
    url: 'https://le.ac.uk/courses?q=postgraduate',
    pageTitle: 'Courses | University of Leicester',
    requiredText: ['Search for a course', 'Postgraduate'],
  },
  'swansea-university': {
    url: 'https://www.swansea.ac.uk/postgraduate/',
    pageTitle: 'Postgraduate - Swansea University',
    requiredText: ['Search our Postgraduate Taught courses', 'Postgraduate Research Courses'],
  },
  'heriot-watt-university': {
    url: 'https://www.hw.ac.uk/study',
    pageTitle: 'Study | Heriot-Watt University',
    requiredText: ['Search our programmes', 'Research'],
  },
  'brunel-university-of-london': {
    url: 'https://www.brunel.ac.uk/study/courses',
    pageTitle: 'Explore our courses | Brunel University of London',
    requiredText: ['Explore our courses', 'PhD & Research'],
  },
  'birkbeck-university-of-london': {
    url: 'https://www.bbk.ac.uk/courses/postgraduate',
    pageTitle: 'Postgraduate - Birkbeck, University of London',
    requiredText: ['Browse courses by name, subject and study options', 'A - Z of Postgraduate courses'],
  },
  'city-st-georges-university-of-london': {
    url: 'https://www.citystgeorges.ac.uk/prospective-students/courses',
    pageTitle: "All Degree, Foundation & Short Courses • City St George's, University of London",
    requiredText: ['Search courses', 'Postgraduate research degrees'],
  },
  'university-of-east-anglia': {
    url: 'https://www.uea.ac.uk/search/courses',
    pageTitle: 'Find your course',
    requiredText: ['Refine by Postgraduate', 'Refine by PhD or other doctorate'],
  },
  'oxford-brookes-university': {
    url: 'https://www.brookes.ac.uk/study/courses/postgraduate',
    pageTitle: 'Postgraduate - Oxford Brookes University',
    requiredText: ["Master's and postgraduate courses", 'PhDs and postgraduate research'],
  },
  'university-of-kent': {
    url: 'https://www.kent.ac.uk/courses/postgraduate',
    pageTitle: 'Postgraduate courses - University of Kent',
    requiredText: ['Postgraduate courses', 'Research'],
  },
  'aston-university': {
    url: 'https://www.aston.ac.uk/postgraduate/courses',
    pageTitle: 'Postgraduate courses | Aston University',
    requiredText: ['Find your course', 'Research degrees/PhD'],
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

describe('masters course directory batch 2', () => {
  it('contains every batch university and the fixed record contract', () => {
    const records = loadMastersCourseDirectories();
    const byUniversityId = new Map(records.map((record) => [record.universityId, record]));

    expect(batch2UniversityIds.every((id) => byUniversityId.has(id))).toBe(true);
    for (const id of batch2UniversityIds) {
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

  it('keeps every research row exactly aligned with production evidence', () => {
    const researchRows = parseResearchRows(batch2ResearchMarkdown);
    expect(researchRows.map((row) => row.universityId)).toEqual(batch2UniversityIds);

    const byUniversityId = new Map(loadMastersCourseDirectories().map((record) => [record.universityId, record]));
    expect(researchRows.map((row) => byUniversityId.get(row.universityId))).toEqual(
      researchRows.map(productionRecord),
    );
  });

  it('keeps the frozen batch 1 records deeply unchanged', () => {
    const frozenBatch1Records = parseResearchRows(batch1ResearchMarkdown).map(productionRecord);
    const batch1Ids = new Set(frozenBatch1Records.map((record) => record.universityId));
    const actualBatch1Records = loadMastersCourseDirectories()
      .filter((record) => batch1Ids.has(record.universityId));

    expect(actualBatch1Records).toEqual(frozenBatch1Records);
  });
});
