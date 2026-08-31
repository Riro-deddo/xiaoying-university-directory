import { describe, expect, it } from 'vitest';
import audit from '../src/data/china-rule-audit.json';
import sources from '../src/data/sources.json';
import statuses from '../src/data/status.json';
import universities from '../src/data/universities.json';
import { expectUnacceptedLinkOnlyStatus } from './helpers/source-status';

const university = universities.find((item) => item.id === 'durham-university');
const source = sources.find((item) => item.id === 'durham-china');
const auditRow = audit.find((item) => item.universityId === 'durham-university');

describe('Durham Mainland China postgraduate requirements', () => {
  it('uses the current official Mainland China page and published grade bands', () => {
    expect(university).toMatchObject({
      state: 'china-requirements',
      sourceIds: ['durham-china'],
    });
    expect(source).toMatchObject({
      universityId: 'durham-university',
      url: 'https://www.durham.ac.uk/study/international/regional-pages/mainland-china-/',
      kind: 'china-requirements',
      scope: 'university',
      institutionRule: {
        type: 'grade-threshold',
        listedMeaningZh: expect.stringContaining('75%–85%'),
        unlistedMeaningZh: expect.stringContaining('90%'),
        caveatZh: expect.stringContaining('完整校名名单'),
        verification: {
          reviewedAt: '2026-08-31',
          url: 'https://www.durham.ac.uk/study/international/regional-pages/mainland-china-/',
          requiredText: [
            'A standard full-time bachelor’s degree (4 years minimum)',
            'minimum average grade of between 75% - 85%',
            'minimum grade of 90% or above will be considered on a case-by-case basis',
          ],
        },
      },
      parser: {
        mode: 'link-only',
        guard: { minimumRecords: 0, maximumRecords: 0, maximumRemovalRatio: 0 },
      },
    });
  });

  it('records the recheck without pretending Durham publishes its institution membership', () => {
    expect(source?.institutionRule.summaryZh).toContain('未公开“高声誉大学”的完整校名名单');
    expect(auditRow).toMatchObject({
      expectedState: 'china-requirements',
      reviewDate: '2026-08-31',
      reviewStatus: 'reviewed',
    });
    expect(auditRow?.finding).toContain('75%–85%');
    expect(auditRow?.finding).toContain('90%');
  });

  it('allows daily probe metadata to refresh without treating the source as reviewed content', () => {
    expectUnacceptedLinkOnlyStatus(statuses['durham-china'], 'durham-china');
  });
});
