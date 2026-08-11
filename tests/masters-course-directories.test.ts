import { describe, expect, it } from 'vitest';
import mastersCourseDirectories from '../src/data/masters-course-directories.json';
import universitiesJson from '../src/data/universities.json';
import {
  DataValidationError,
  loadMastersCourseDirectories,
  validateMastersCourseDirectories,
  validateUniversities,
} from '../src/lib/data';
import type { MastersCourseDirectory, University } from '../src/lib/types';

const universities: University[] = validateUniversities([{
  id: 'imperial-college-london',
  nameZh: '帝国理工学院',
  nameEn: 'Imperial College London',
  aliases: ['Imperial'],
  directoryCategory: 'qs-directory',
  qsDirectory: { firstEdition: 2027, verifiedEdition: 2027, current: true },
  state: 'china-requirements',
  officialDomain: 'https://www.imperial.ac.uk',
  sourceIds: [],
}]);

const valid: MastersCourseDirectory[] = [{
  id: 'masters-imperial-college-london',
  universityId: 'imperial-college-london',
  labelZh: '查看全部硕士课程',
  url: 'https://www.imperial.ac.uk/study/courses/',
  pageTitle: 'Postgraduate courses',
  reviewedAt: '2026-08-11',
  requiredText: ['Postgraduate', 'Courses'],
  monitorMode: 'page-identity',
}];

const greenwichUniversity: University = {
  ...universities[0],
  id: 'university-of-greenwich',
  nameZh: '格林威治大学',
  nameEn: 'University of Greenwich',
  aliases: ['Greenwich'],
  officialDomain: 'https://www.greenwich.ac.uk',
};

const greenwichValid: MastersCourseDirectory = {
  ...valid[0],
  id: 'masters-university-of-greenwich',
  universityId: 'university-of-greenwich',
  url: 'https://www.gre.ac.uk/postgraduate-courses',
};

describe('masters course directory registry', () => {
  it('loads the validated independent production registry', () => {
    expect(loadMastersCourseDirectories()).toEqual(mastersCourseDirectories);
  });

  it('covers the exact 101-university catalog once', () => {
    const catalog = validateUniversities(universitiesJson);
    const records = loadMastersCourseDirectories();

    expect(records).toHaveLength(101);
    expect(new Set(records.map((record) => record.universityId)))
      .toEqual(new Set(catalog.map((university) => university.id)));
  });

  it.each([
    ['imperial-college-london', 'https://www.imperial.ac.uk/study/courses/?courseType=postgraduate+taught'],
    ['university-of-oxford', 'https://www.ox.ac.uk/admissions/graduate/courses/find-your-course'],
    ['university-of-manchester', 'https://www.manchester.ac.uk/study/'],
    ['university-of-greenwich', 'https://www.gre.ac.uk/postgraduate-courses'],
    ['royal-college-of-art', 'https://www.rca.ac.uk/study/programme-finder/'],
  ])('keeps the reviewed representative entry for %s', (universityId, url) => {
    expect(loadMastersCourseDirectories().find((record) => record.universityId === universityId))
      .toMatchObject({ id: `masters-${universityId}`, universityId, url });
  });

  it('accepts a complete official course-directory entry', () => {
    expect(validateMastersCourseDirectories(valid, universities)).toEqual(valid);
  });

  it('rejects duplicate stable IDs', () => {
    expect(() => validateMastersCourseDirectories([...valid, ...valid], universities))
      .toThrow(/duplicate/i);
  });

  it('rejects a directory that references an unregistered university', () => {
    expect(() => validateMastersCourseDirectories([{ ...valid[0], universityId: 'unknown' }], universities))
      .toThrow(/unregistered university/i);
  });

  it.each([
    ['non-HTTPS URL', { url: 'http://example.com' }],
    ['non-fixed Chinese label', { labelZh: '查看硕士课程' }],
    ['duplicate identity anchors', { requiredText: ['Postgraduate', 'Postgraduate'] }],
    ['unexpected field', { extra: true }],
  ])('rejects schema-invalid %s', (_label, change) => {
    expect(() => validateMastersCourseDirectories([{ ...valid[0], ...change }], universities))
      .toThrow(/schema/i);
  });

  it('rejects an ID that is not derived from the university ID', () => {
    expect(() => validateMastersCourseDirectories([{ ...valid[0], id: 'masters-imperial' }], universities))
      .toThrow(/derived/i);
  });

  it('reports a malformed HTTPS URL as a data validation error', () => {
    expect(() => validateMastersCourseDirectories([{ ...valid[0], url: 'https://' }], universities))
      .toThrow(DataValidationError);
    try {
      validateMastersCourseDirectories([{ ...valid[0], url: 'https://' }], universities);
    } catch (error) {
      expect(error).toMatchObject({
        dataset: 'Masters course directory',
        paths: expect.arrayContaining([expect.stringContaining('/0/url')]),
      });
    }
  });

  it('accepts an official subdomain course directory', () => {
    expect(validateMastersCourseDirectories([{
      ...valid[0],
      url: 'https://courses.imperial.ac.uk/postgraduate/',
    }], universities)).toHaveLength(1);
  });

  it('accepts Greenwich’s explicitly reviewed gre.ac.uk first-party alias', () => {
    expect(validateMastersCourseDirectories(
      [greenwichValid],
      [greenwichUniversity],
    )).toEqual([greenwichValid]);
  });

  it('does not permit Greenwich’s first-party alias for another university', () => {
    expect(() => validateMastersCourseDirectories([{
      ...valid[0],
      url: 'https://www.gre.ac.uk/postgraduate-courses',
    }], universities)).toThrow(/official domain/i);
  });

  it.each([
    'https://gre.ac.uk.evil.test/postgraduate-courses',
    'https://evil.gre.ac.uk/postgraduate-courses',
  ])('rejects a Greenwich alias lookalike: %s', (url) => {
    expect(() => validateMastersCourseDirectories([{
      ...greenwichValid,
      url,
    }], [greenwichUniversity])).toThrow(/official domain/i);
  });

  it('rejects a URL outside the university official domain', () => {
    expect(() => validateMastersCourseDirectories([{
      ...valid[0],
      url: 'https://official.ac.uk.evil.test/postgraduate/',
    }], [{ ...universities[0], officialDomain: 'https://official.ac.uk' }]))
      .toThrow(/official domain/i);
  });
});
